const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { onlineFixture } = require('./helpers/online-fixture');
const { createCloudAuth, hash } = require('../online/auth');
const { createGatewaySetup } = require('../online/gateway-setup');
const { gatewayEnvironment } = require('../scripts/with-gateway');
const load = name => import('data:text/javascript;base64,' + fs.readFileSync(path.join(__dirname,'../../public/js',name)).toString('base64'));

test('gateway enrollment requires a current reauthenticated owner and isolates private credentials', async t => {
  const f=await onlineFixture();t.after(()=>f.close());const auth=createCloudAuth(f.pool,{secure:false}),setup=createGatewaySetup(f.pool,'https://synthetic.invalid');
  await auth.register('gateway-new','New home',f.password,'enroll-register');
  let login=await auth.login('gateway-new',f.password,'enroll-login');
  const initial=await setup.status(login.session);assert.equal(initial.state,'not_enrolled');assert.equal(initial.available,true);
  await assert.rejects(setup.enroll(login.session,{replace_unused:false}),{code:'REAUTH_REQUIRED'});
  const viewer=await auth.login('cloud-viewer',f.password,'viewer-enroll');await assert.rejects(setup.status(viewer.session),{code:'FORBIDDEN'});await assert.rejects(setup.enroll(viewer.session,{replace_unused:false}),{code:'FORBIDDEN'});
  login=await auth.reauth(login.session,login.token,f.password);
  for(const body of [{replace_unused:false,household_id:f.household},{replace_unused:'false'},{replace_unused:false,role:'owner'}]) await assert.rejects(setup.enroll(login.session,body));
  const results=await Promise.allSettled([setup.enroll(login.session,{replace_unused:false}),setup.enroll(login.session,{replace_unused:false})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'GATEWAY_ALREADY_ENROLLED');
  const enrolled=results.find(r=>r.status==='fulfilled').value;assert.equal(enrolled.household_id,login.session.household_id);assert.notEqual(enrolled.household_id,f.household);assert.match(enrolled.config.gateway_token,/^[a-f0-9]{64}$/);assert.equal(enrolled.config.origin,'https://synthetic.invalid');
  assert.equal((await setup.status(login.session)).state,'awaiting_connection');assert.equal(JSON.stringify(await setup.status(login.session)).includes(enrolled.config.gateway_token),false);
  await assert.rejects(f.pool.query('SELECT token_hash FROM homeauto_online.gateway_keys'),/permission denied/);
  await f.admin(async db=>{const key=(await db.query('SELECT token_hash FROM homeauto_online.gateway_keys WHERE key_id=$1',[enrolled.key_id])).rows[0];assert.equal(key.token_hash,hash(enrolled.config.gateway_token));assert.equal((await db.query("SELECT has_function_privilege('public','homeauto_online.enroll_browser_gateway(text,uuid,uuid,text,boolean)','EXECUTE') AS allowed")).rows[0].allowed,false);});
  const replaced=await setup.enroll(login.session,{replace_unused:true});assert.equal(replaced.gateway_id,enrolled.gateway_id);assert.notEqual(replaced.config.gateway_token,enrolled.config.gateway_token);
  await f.admin(async db=>{assert.ok((await db.query('SELECT revoked_at FROM homeauto_online.gateway_keys WHERE key_id=$1',[enrolled.key_id])).rows[0].revoked_at);await db.query('UPDATE homeauto_online.gateways SET last_seen_at=now() WHERE household_id=$1',[login.session.household_id]);});
  await assert.rejects(setup.enroll(login.session,{replace_unused:true}),{code:'GATEWAY_ALREADY_ENROLLED'});
  await auth.logout(login.token);await assert.rejects(setup.enroll(login.session,{replace_unused:true}),{code:'LOGIN_REQUIRED'});
});

test('gateway launcher validates private files and keeps remote actuation gates off', t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'homeauto-setup-'));const file=path.join(dir,'gateway.json');t.after(()=>{fs.unlinkSync(file);fs.rmdirSync(dir);});
  const config={version:1,expires_at:new Date(Date.now()+60000).toISOString(),household_id:'10000000-0000-4000-8000-000000000001',gateway_id:'20000000-0000-4000-8000-000000000001',gateway_token:'a'.repeat(64),origin:'https://synthetic.invalid'};
  fs.writeFileSync(file,JSON.stringify(config));const env=gatewayEnvironment(file);for(const name of ['HOMEAUTO_REMOTE_LIGHTS_ENABLED','HOMEAUTO_SECURE_GATEWAY_APPROVED','HOMEAUTO_DOOR_ENABLED','HOMEAUTO_CLOUD_SYNC_ENABLED'])assert.equal(env[name],'0');
  for(const invalid of [null,{...config,expires_at:'invalid'},{...config,expires_at:'2000-01-01'},{...config,origin:'http://public.invalid'},{...config,gateway_token:'invalid'}]){fs.writeFileSync(file,JSON.stringify(invalid));assert.throws(()=>gatewayEnvironment(file),e=>!e.message.includes(config.gateway_token));}
});

test('demo is isolated by account and home, persists only simulated preferences and never falls through to hardware',async()=>{
  const {createDemoHome}=await load('demo.js');const {Api}=await load('api.js');const entries=new Map();const storage={getItem:k=>entries.get(k),setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
  const session={user:{id:'synthetic-user',role:'owner'},household_id:'synthetic-home'};const demo=createDemoHome(session,storage);Api.mode='cloud';Api.startDemo(session,demo);
  const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw new Error('No network allowed');};
  try{
    await Api.request('/api/devices/light-1/command',{method:'POST',body:{action:'off'}});assert.equal(demo.snapshot().devices[0].status,'off');assert.equal(calls,0);
    await assert.rejects(Api.request('/api/devices/door-1/command',{method:'POST',body:{action:'unlock'}}),{code:'DEMO_ACTION_UNAVAILABLE'});
    await assert.rejects(Api.request('/api/gateway-setup',{method:'POST',body:{}}),{code:'DEMO_ACTION_UNAVAILABLE'});assert.equal(calls,0);
    const reload=createDemoHome(session,storage);assert.equal(reload.snapshot().devices[0].status,'off');assert.equal(createDemoHome({...session,user:{id:'other',role:'owner'}},storage).snapshot().devices[0].status,'on');
    demo.scenario('gas');assert.equal(demo.snapshot().alerts[0].state,'active');demo.scenario('clear');assert.equal(demo.snapshot().alerts[0].state,'resolved');
    const parsed=await demo.request('/api/assistant/interpret',{method:'POST',body:{text:'turn on sofa light'}});await demo.request('/api/assistant/execute',{method:'POST',body:{intent_id:parsed.intent_id}});assert.equal(demo.snapshot().devices[0].status,'on');
    const events=await demo.request('/api/activity?category=lights');assert.ok(events.items.length);assert.ok(events.items.every(e=>e.timestamp&&e.category==='lights'));assert.equal((await demo.request('/api/activity?category=doors')).items.length,0);
    assert.equal(JSON.stringify([...entries]).includes('csrf'),false);assert.equal(JSON.stringify([...entries]).includes('gateway_token'),false);
    demo.reset();assert.equal(demo.snapshot().alerts.length,0);assert.equal(demo.snapshot().devices[0].status,'on');
    const blocked=createDemoHome(session,{getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}});blocked.reset();assert.equal(blocked.snapshot().demo,true);
    await assert.rejects(createDemoHome({...session,user:{id:'viewer',role:'viewer'}}).request('/api/devices/light-1/command',{method:'POST',body:{action:'off'}}),{code:'FORBIDDEN'});
  }finally{global.fetch=original;Api.exitDemo();}
});
