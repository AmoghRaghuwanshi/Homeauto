const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createRepository } = require('../db/repository');
const { Home } = require('../services/home');
const { Sessions, authorize, hash } = require('../auth/sessions');
const { resolveCommand, detectWakeWord } = require('../voice/intent');
const { uid } = require('../lib/errors');
const { devices } = require('../lib/registry');
const { legacyBytes } = require('./helpers/legacy-fixture');
const rooms = [...new Map(devices.map(d => [d.room_id, { id: d.room_id, name: d.location }])).values()];
const actor = { user_id: 'test-user', role: 'owner', can_unlock: true, token_hash: 'test-session', reauth_at: Date.now() };
async function fixture(t, options = {}) {
  const repo = await createRepository(); t.after(() => repo.close());
  let now = Date.now(); const published = [];
  const home = new Home(repo, { now: () => now, allowDoor: true, publisher: (...args) => { published.push(args); args[3](null); }, ...options });
  home.setConnected(true); home.ingest('home/esp32/lights/online', Buffer.from('true')); home.ingest('home/esp32/door/online', Buffer.from('true'));
  return { repo, home, published, advance: ms => { now += ms; } };
}
const request = (home, id = 'light-1', action = 'on', extra = {}) => home.request(id, { action, idempotency_key: crypto.randomUUID(), ...extra }, actor);
test('HA-002 importing app/lifecycle has no production database writes or sockets', async t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'homeauto-import-'));t.after(()=>fs.rmSync(dir,{recursive:true}));const filename=path.join(dir,'sentinel.db');fs.writeFileSync(filename,await legacyBytes());const before=fs.readFileSync(filename);
  const script=`const fs=require('fs'),net=require('net'),assert=require('assert/strict');process.env.HOMEAUTO_DB_PATH=${JSON.stringify(filename)};const deny=()=>{throw new Error('Import performed filesystem mutation or network operation');};for(const name of ['writeFileSync','writeFile','appendFileSync','appendFile','renameSync','mkdirSync','unlinkSync'])fs[name]=deny;net.Server.prototype.listen=deny;net.Socket.prototype.connect=deny;const {createApp}=require(${JSON.stringify(path.resolve(__dirname,'../app'))});const {startRuntime}=require(${JSON.stringify(path.resolve(__dirname,'../server'))});assert.equal(typeof createApp,'function');assert.equal(typeof startRuntime,'function');`;
  require('child_process').execFileSync(process.execPath,['-e',script],{windowsHide:true,stdio:'pipe'});assert.deepEqual(fs.readFileSync(filename),before);
});
test('migrate a copy of legacy database preserving all IDs/logs; restart idempotent', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'homeauto-migrate-')); t.after(() => fs.rmSync(dir, { recursive: true }));
  const filename = path.join(dir, 'test.db'); fs.writeFileSync(filename,await legacyBytes());
  let repo = await createRepository({ filename }); const count = repo.one('SELECT COUNT(*) AS n FROM activity_log').n; assert.equal(count, 44); assert.equal(repo.getDevices().length, 7); assert.ok(fs.existsSync(filename + '.pre-v5.bak')); repo.close();
  repo = await createRepository({ filename }); assert.equal(repo.one('SELECT COUNT(*) AS n FROM activity_log').n, count); assert.equal(repo.one('PRAGMA user_version').user_version, 5); repo.close();
});
test('failed durable rename rolls back memory and retains valid disk; security writer unhealthy', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'homeauto-failure-')); t.after(() => fs.rmSync(dir, { recursive: true })); let broken = false;
  const io = Object.create(fs); io.renameSync = (...args) => { if (broken) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); fs.renameSync(...args); };
  const filename = path.join(dir, 'test.db'); const repo = await createRepository({ filename, io }); t.after(() => repo.close()); const before = fs.readFileSync(filename); broken = true;
  assert.throws(() => repo.write("UPDATE devices SET name='changed' WHERE id='light-1'")); assert.equal(repo.getDevice('light-1').name, 'Light 1'); assert.deepEqual(fs.readFileSync(filename), before); assert.equal(repo.healthy(), false);
});
test('single writer refuses a second process/repository on same file', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'homeauto-lock-')); const filename = path.join(dir, 'test.db'); const r = await createRepository({ filename }); t.after(() => { r.close(); fs.rmSync(dir, { recursive: true }); });
  await assert.rejects(createRepository({ filename }), /locked/);
});
test('database transaction rollback preserves previous value on validation failure', async t => {
  const { repo } = await fixture(t); assert.throws(() => repo.transaction(({ run }) => { run("UPDATE devices SET name='bad'"); throw new Error('abort'); })); assert.equal(repo.getDevice('light-1').name, 'Light 1');
});
test('command accepts without optimistic state; fresh report completes with limited evidence', async t => {
  const { home, repo, published } = await fixture(t); home.ingest('home/light/1/status', Buffer.from('off'));
  const c = request(home); assert.equal(c.state, 'published'); assert.equal(repo.getDevice('light-1').status, 'off'); assert.equal(published.length, 1); assert.equal(published[0][0], 'home/light/1/command');
  home.ingest('home/light/1/status', Buffer.from('on')); assert.equal(home.command(c.id).state, 'observed'); assert.equal(home.command(c.id).physical_verified, false);
});
test('retained status never completes command or overwrites current report', async t => { const { home } = await fixture(t); home.ingest('home/light/1/status', Buffer.from('off')); const c = request(home); home.ingest('home/light/1/status', Buffer.from('on'), { retain: true }); assert.equal(home.command(c.id).state, 'published'); assert.equal(home.device('light-1').observation.reported_status, 'off'); });
test('timeout is uncertain and a late report never replays command', async t => { const { home, advance, published } = await fixture(t); const c = request(home); advance(8001); home.expire(); assert.equal(home.command(c.id).state, 'uncertain'); home.ingest('home/light/1/status', Buffer.from('on')); assert.equal(home.command(c.id).state, 'uncertain'); assert.equal(published.length, 1); });
test('idempotency replay uses same record; different body and competing action conflict', async t => { const { home, published } = await fixture(t); const key = crypto.randomUUID(); const a = request(home, 'light-1', 'on', { idempotency_key: key }); assert.equal(request(home, 'light-1', 'on', { idempotency_key: key }).id, a.id); assert.throws(() => request(home, 'light-1', 'off', { idempotency_key: key }), e => e.code === 'IDEMPOTENCY_CONFLICT'); assert.throws(() => request(home, 'light-1', 'off'), e => e.code === 'DEVICE_BUSY'); assert.equal(published.length, 1); });
test('light state already reported returns no-op and no publication', async t => { const { home, published } = await fixture(t); home.ingest('home/light/1/status', Buffer.from('off')); const c = request(home, 'light-1', 'off'); assert.equal(c.already_reported, true); assert.equal(published.length, 0); });
test('offline broker/controller fail closed; reconnection never republishes', async t => { const { home, published } = await fixture(t); const c = request(home); home.setConnected(false); assert.equal(home.command(c.id).state, 'uncertain'); assert.throws(() => request(home, 'light-2'), e => e.code === 'DEVICE_UNAVAILABLE'); home.setConnected(true); assert.equal(published.length, 1); assert.equal(home.device('light-1').connectivity, 'offline'); });
test('door needs role/reauth and single-use session-bound confirmation', async t => {
  const { home, published } = await fixture(t); assert.throws(() => request(home, 'door-1', 'unlock'), e => e.code === 'CONFIRMATION_EXPIRED');
  const c = home.challenge(actor); const result = request(home, 'door-1', 'unlock', { confirmation_id: c.confirmation_id }); assert.equal(result.state, 'published'); assert.equal(published[0][2].qos, 0);
  home.ingest('home/door/1/status', Buffer.from('unlocked')); assert.throws(() => request(home, 'door-1', 'unlock', { confirmation_id: c.confirmation_id }), e => e.code === 'CONFIRMATION_EXPIRED');
});
test('door safety flag and voice/typed unlock cannot be bypassed', async t => { const { home } = await fixture(t); assert.throws(() => home.request('door-1', { action: 'unlock', idempotency_key: crypto.randomUUID() }, actor, 'assistant'), e => e.code === 'SENSITIVE_ACTION_REQUIRES_UI'); home.allowDoor = false; assert.throws(() => home.challenge(actor), e => e.code === 'DOOR_SAFETY_SETUP_REQUIRED'); });
test('denied is a security event and never lock position', async t => { const { home } = await fixture(t); home.ingest('home/door/1/status', Buffer.from('unlocked')); home.ingest('home/door/1/status', Buffer.from('denied')); assert.equal(home.device('door-1').observation.reported_status, 'unlocked'); });
test('PIR has no manufactured current clear from board heartbeat', async t => { const { home, advance } = await fixture(t); assert.notEqual(home.device('sensor-motion').observation.freshness, 'current'); home.ingest('home/sensor/motion/data', Buffer.from('{"motion":false}')); advance(66000); home.ingest('home/esp32/lights/online', Buffer.from('true')); assert.equal(home.device('sensor-motion').observation.freshness, 'stale'); });
test('gas alert episodes deduplicate; acknowledgment is independent; fresh normal resolves', async t => { const { home, repo, advance } = await fixture(t); const alert = Buffer.from('{"raw":2000,"gas_ppm":500,"alert":true}'); home.ingest('home/sensor/gas/data', alert); for (let i = 0; i < 7; i++) { advance(2000); home.ingest('home/sensor/gas/data', alert); } assert.equal(repo.one('SELECT COUNT(*) AS n FROM alerts').n, 1); assert.ok(repo.one('SELECT COUNT(*) AS n FROM activity_log').n < 6); home.ingest('home/sensor/gas/data', Buffer.from('{"raw":0,"gas_ppm":0,"alert":false}')); assert.equal(repo.one('SELECT state FROM alerts').state, 'resolved'); });
test('strict MQTT schemas reject unknown/malformed/status and sensor actuation', async t => { const { home } = await fixture(t); for (const [topic, payload] of [['home/light/99/status', 'on'], ['home/light/1/status/extra', 'on'], ['home/light/1/status', 'unlock'], ['home/sensor/gas/data', '{"alert":true}'], ['home/sensor/motion/data', '{"motion":1}'], ['home/esp32/unknown/online', 'true']]) assert.equal(home.ingest(topic, Buffer.from(payload)), false); assert.throws(() => request(home, 'sensor-gas', 'on'), e => e.code === 'UNSUPPORTED_ACTION'); });
test('sessions hash tokens, require password reauth and revoke old token', async t => { const { repo } = await fixture(t); const s = new Sessions(repo, { secure: false }); await s.addUser({ username: 'owner', password: 'a strong local test password', can_unlock: true }); const r = await s.login('owner', 'a strong local test password', 'test'); assert.notEqual(repo.one('SELECT token_hash FROM sessions').token_hash, r.token); assert.equal(repo.one('SELECT token_hash FROM sessions').token_hash, hash(r.token)); assert.throws(() => authorize(r, 'unlock'), e => e.code === 'REAUTH_REQUIRED'); const re = await s.reauth(r, r.token, 'a strong local test password'); assert.equal(s.get(r.token), null); authorize(re, 'unlock'); s.logout(re.token); assert.equal(s.get(re.token), null); });
test('viewer never receives control and resident never owner permissions', () => { assert.throws(() => authorize({ role: 'viewer' }, 'control'), e => e.status === 403); assert.throws(() => authorize({ role: 'resident' }, 'owner'), e => e.status === 403); });
test('canonical card UID accepts 4/7/10 bytes only', () => { assert.equal(uid('aa bb cc dd'), 'AA:BB:CC:DD'); assert.throws(() => uid('abcd')); assert.throws(() => uid("<img onerror=x>")); });
const corpus = [
  ['turn off room 1 lights', 'off', ['light-1', 'light-2']], ['room 1 light band karo', 'off', ['light-1', 'light-2']], ['कमरा १ की बत्ती चालू करो', 'on', ['light-1', 'light-2']], ['sab lights off', 'off', ['light-1','light-2','light-3','light-4']], ['what is the gas status', 'query', ['sensor-gas']], ['gas sensor ka status kya hai', 'query', ['sensor-gas']], ['lock front door', 'lock', ['door-1']], ['दरवाजा खोलो', 'unlock', ['door-1']], ['hey shrimaan light 2 on', 'on', ['light-2']],
];
for (const [input, action, ids] of corpus) test('intent: ' + input, () => { const r = resolveCommand(input, devices, rooms); assert.equal(r.ok, true); assert.equal(r.intent.action, action); assert.deepEqual(r.intent.device_ids, ids); });
for (const input of ['do not unlock door', "don't unlock door", 'darwaza mat kholo', 'दरवाजा मत खोलो', 'light 99 on', 'turn on light', 'on off lights', 'unlock', 'play music', 'turn on bedroom lights']) test('safe rejection: ' + input, () => assert.equal(resolveCommand(input, devices, rooms).ok, false));
test('wake phrase only at explicit prefix, optional for tap/text', () => { assert.equal(detectWakeWord('hey shrimaan light 1 on').found, true); assert.equal(detectWakeWord('a phrase mentioning shrimaan later').found, false); });

test('spoken numerals, multiple explicit lights and exclusions are handled safely', () => {
  for (const input of ['turn off room one lights', 'कमरा एक की लाइट बंद करो', 'लाइट दो चालू करो']) assert.equal(resolveCommand(input, devices, rooms).ok, true);
  assert.deepEqual(resolveCommand('light 1 and light 2 on', devices, rooms).intent.device_ids, ['light-1','light-2']);
  for (const input of ['all lights off except light 1', 'light 1 and light 99 on', 'लाइट 1 चालू ना करो']) assert.equal(resolveCommand(input, devices, rooms).ok, false);
});
test('restart invalidates sessions/challenges and pending actions without publication', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'homeauto-restart-')); t.after(() => fs.rmSync(dir, {recursive:true})); const filename=path.join(dir,'test.db'); let repo=await createRepository({filename});
  const home = new Home(repo, {publisher:(...args)=>args[3](null)}); home.setConnected(true); home.ingest('home/esp32/lights/online',Buffer.from('true')); const c=request(home);
  repo.write('INSERT INTO unlock_challenges(token_hash,session_hash,device_id,expires_at) VALUES(?,?,?,?)',['challenge','session','door-1',Date.now()+30000]); repo.close();
  repo=await createRepository({filename}); assert.equal(repo.one('SELECT state FROM commands WHERE id=?',[c.id]).state,'uncertain'); assert.equal(repo.one('SELECT COUNT(*) AS n FROM unlock_challenges').n,0); repo.close();
});
test('idle/absolute session expiry and expired throttle entries recover', async t => {
  const {repo}=await fixture(t); let now=Date.now(); const s=new Sessions(repo,{secure:false,now:()=>now}); await s.addUser({username:'expiry',password:'an isolated expiry password'});
  for(let i=0;i<2001;i++) s.failures.set(String(i),{until:now-1,count:30}); const r=await s.login('expiry','an isolated expiry password','local'); assert.ok(s.get(r.token)); now+=1800001; assert.equal(s.get(r.token),null);
});
test('retention preserves historical baseline and active alerts; daily backup rotates seven', async t => {
  const {maintain,dailyBackup}=require('../db/maintenance'); const dir=fs.mkdtempSync(path.join(os.tmpdir(),'homeauto-maintain-')); t.after(()=>fs.rmSync(dir,{recursive:true}));
  const filename=path.join(dir,'test.db'); fs.writeFileSync(filename,await legacyBytes()); const repo=await createRepository({filename}); t.after(()=>repo.close());
  repo.write("INSERT INTO activity_log(timestamp,event_type) VALUES('2000-01-01','test_old')");
  repo.write("INSERT INTO alerts(id,kind,severity,state,opened_at,last_seen_at) VALUES('keep','gas','critical','active','2000-01-01','2000-01-01')");
  maintain(repo); assert.equal(repo.one('SELECT COUNT(*) AS n FROM activity_log').n,44); assert.equal(repo.one("SELECT state FROM alerts WHERE id='keep'").state,'active');
  for(let i=0;i<10;i++) dailyBackup(repo,Date.now()+i*86400000); assert.equal(fs.readdirSync(path.join(dir,'backups')).filter(n=>n.endsWith('.db')).length,7);
});
test('restore validates checksum, protects a running writer and records restoration', async t => {
  const {inspectBackup,restoreBackup}=require('../scripts/recovery'); const {dailyBackup}=require('../db/maintenance'); const dir=fs.mkdtempSync(path.join(os.tmpdir(),'homeauto-restore-')); t.after(()=>fs.rmSync(dir,{recursive:true}));
  const filename=path.join(dir,'test.db'); let repo=await createRepository({filename}); const backup=dailyBackup(repo); await assert.rejects(restoreBackup(filename,backup),/Stop the hub/); repo.close();
  await inspectBackup(backup); await restoreBackup(filename,backup); repo=await createRepository({filename}); assert.equal(repo.one("SELECT COUNT(*) AS n FROM activity_log WHERE event_type='backup_restored'").n,1); repo.close();
  fs.writeFileSync(backup+'.sha256','bad'); await assert.rejects(inspectBackup(backup),/checksum/);
});
test('interpreted intents are bound to the current session; negative auto candidate blocks a positive', async t => {
  const {home}=await fixture(t); const {Assistant}=require('../services/assistant'); const {SpeechService}=require('../voice/speech-service'); const assistant=new Assistant(home);
  const parsed=assistant.interpret('light 1 on',actor); assert.throws(()=>assistant.execute(parsed.intent_id,crypto.randomUUID(),{...actor,token_hash:'other'}),e=>e.code==='INTENT_EXPIRED');
  const speech=new SpeechService(home,assistant); speech.run=async()=>({candidates:[{lang:'en',text:'light 1 on'},{lang:'hi',text:'लाइट 1 चालू मत करो'}]}); await assert.rejects(speech.transcribe(Buffer.alloc(6400),'auto'),e=>e.code==='RECOGNITION_AMBIGUOUS'); speech.close();
});
test('remote MQTT rejects plaintext before making a network connection', async t => {
  const {home}=await fixture(t); const {connectBroker}=require('../mqtt/broker'); assert.throws(()=>connectBroker(home,{MQTT_ENABLED:true,MQTT_USERNAME:'test',MQTT_PASSWORD:'test',MQTT_BROKER:'mqtt://192.0.2.1:1883'}),/TLS/);
});
test('query speech uses requested Hindi/English labels and remains a read-only result',async t=>{const{home,published}=await fixture(t);const{Assistant}=require('../services/assistant');home.ingest('home/light/1/status',Buffer.from('on'));const a=new Assistant(home);const p=a.interpret('check light 1 status',actor);const result=a.execute(p.intent_id,crypto.randomUUID(),actor);assert.match(a.speechText(result.answer.result_id,actor,'hi'),/चालू/);assert.match(a.speechText(result.answer.result_id,actor,'en'),/on/);assert.equal(published.length,0);});
