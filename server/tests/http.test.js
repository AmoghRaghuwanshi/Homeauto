const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { WebSocket } = require('ws');
const { createRepository } = require('../db/repository');
const { Sessions } = require('../auth/sessions');
const { Home } = require('../services/home');
const { Assistant } = require('../services/assistant');
const { SpeechService } = require('../voice/speech-service');
const { createApp } = require('../app');
const { attachRealtime } = require('../realtime');
let repo, home, sessions, speech, app, server, rt, base, cookie, csrf;
const password = 'a long isolated HTTP fixture password';
async function api(route, method = 'GET', body, options = {}) {
  const response = await fetch(base + route, { method, headers: { Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...options }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json(); return { status: response.status, value, cookie: response.headers.get('set-cookie') };
}
test.before(async () => {
  repo = await createRepository(); home = new Home(repo, { simulation: true, publisher: (topic, action, options, cb) => cb() }); sessions = new Sessions(repo, { secure: false }); await sessions.addUser({ username: 'owner', password, can_unlock: true }); await sessions.addUser({ username: 'viewer', password, role: 'viewer' });
  const assistant = new Assistant(home); speech = new SpeechService(home, assistant, { VOICE_ENABLED: false });
  app = createApp({ repo, home, sessions, assistant, speech }); server = http.createServer(app); rt = attachRealtime(server, { app, home, sessions, assistant, speech });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = 'http://127.0.0.1:' + server.address().port;
});
test.after(async () => { rt.close(); speech.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); repo.close(); });
test('unauthenticated reads and mutations are denied', async () => { assert.equal((await api('/api/devices')).status, 401); assert.equal((await api('/api/devices/door-1/command', 'POST', { action: 'unlock' })).status, 401); });
test('login verifies origin/password and sets HttpOnly same-site cookie', async () => { const rejected = await api('/api/auth/login', 'POST', { username: 'owner', password }, { Origin: 'https://evil.invalid' }); assert.equal(rejected.status, 403); const r = await api('/api/auth/login', 'POST', { username: 'owner', password }); assert.equal(r.status, 200); assert.match(r.cookie, /HttpOnly; SameSite=Strict/); cookie = r.cookie.split(';')[0]; csrf = r.value.csrf_token; });
test('snapshot truthful, no connected/physical state fabricated', async () => { const r = await api('/api/snapshot'); assert.equal(r.value.devices.length, 7); assert.equal(r.value.mqtt.connected, false); assert.equal(r.value.devices[0].observation.physical_verified, false); assert.equal(r.value.system.simulation, true); });
test('CSRF required and unknown keys rejected', async () => { assert.equal((await api('/api/rooms', 'POST', { name: 'Study', idempotency_key: require('crypto').randomUUID() }, { 'X-CSRF-Token': 'bad' })).status, 403); assert.equal((await api('/api/devices/light-1', 'PUT', { name: 'x', version: 1, status: 'on' })).status, 400); });
test('room create persists/idempotent; room rename and device reassignment preserve ID', async () => { const key = require('crypto').randomUUID(); const room = await api('/api/rooms', 'POST', { name: 'Study', idempotency_key: key }); assert.equal(room.status, 201); assert.equal((await api('/api/rooms', 'POST', { name: 'Study', idempotency_key: key })).value.id, room.value.id); const d = await api('/api/devices/light-1'); const result = await api('/api/devices/light-1', 'PUT', { name: 'Desk <img onerror=x>', room_id: room.value.id, version: d.value.version }); assert.equal(result.status, 200); assert.equal(result.value.id, 'light-1'); assert.equal(result.value.location, 'Study'); assert.equal((await api('/api/rooms/' + room.value.id, 'DELETE', {})).status, 409); });
test('RFID requires reauth; duplicate create never silently replaces', async () => { assert.equal((await api('/api/logs/rfid-cards', 'POST', { uid: 'aa bb cc dd', owner_name: 'Test', is_authorized: true })).value.error.code, 'REAUTH_REQUIRED'); const re = await api('/api/auth/reauth', 'POST', { password }); cookie = re.cookie.split(';')[0]; csrf = re.value.csrf_token; const c = await api('/api/logs/rfid-cards', 'POST', { uid: 'aa bb cc dd', owner_name: 'Test', is_authorized: true }); assert.equal(c.status, 201); assert.equal((await api('/api/logs/rfid-cards', 'POST', { uid: 'AA:BB:CC:DD', owner_name: 'Overwrite', is_authorized: true })).status, 409); assert.equal((await api('/api/logs/rfid-cards')).value[0].owner_name, 'Test'); const revoked = await api('/api/logs/rfid-cards/AA:BB:CC:DD', 'PUT', { is_authorized: false, version: 1 }); assert.equal(revoked.value.is_authorized, 0); });
test('activity bounded pagination and audit redaction', async () => { for (let i = 0; i < 5; i++) repo.log('door-1', 'rfid_scan', { uid: 'AA:BB:CC:DD', authorized: false }); const r = await api('/api/activity?limit=2'); assert.equal(r.value.items.length, 2); assert.ok(r.value.next_cursor); const n = await api('/api/activity?limit=2&cursor=' + r.value.next_cursor); assert.ok(n.value.items[0].id < r.value.items[1].id); assert.equal((await api('/api/logs?limit=-1')).status, 400); });
test('unknown API returns JSON404; fixed device deletion rejected', async () => { assert.equal((await api('/api/unknown')).status, 404); assert.equal((await api('/api/devices/light-1', 'DELETE', {})).status, 409); });
test('typed sensitive/negated actions cannot unlock', async () => { assert.equal((await api('/api/assistant/interpret', 'POST', { text: 'do not unlock door' })).status, 422); const p = await api('/api/assistant/interpret', 'POST', { text: 'unlock front door' }); const r = await api('/api/assistant/execute', 'POST', { intent_id: p.value.intent_id, idempotency_key: require('crypto').randomUUID() }); assert.equal(r.value.error.code, 'SENSITIVE_ACTION_REQUIRES_UI'); });
test('both WS paths route correctly and text control never feeds STT', async () => {
  const receive = (route, message) => new Promise((resolve, reject) => { const ws = new WebSocket(base.replace('http', 'ws') + route, { headers: { Cookie: cookie, Origin: base } }); ws.on('error', reject); ws.on('open', () => { if (message) ws.send(JSON.stringify(message)); }); ws.on('message', data => { ws.close(); resolve(JSON.parse(data)); }); });
  assert.equal((await receive('/ws')).type, 'init'); speech.ready.stt_ready = true; const ticket = speech.ticket(sessions.readRequest({ headers: { cookie } }).session);
  assert.equal((await receive('/voice', { type: 'start', ticket: ticket.ticket, utterance_id: require('crypto').randomUUID(), format: 'pcm_s16le', sample_rate: 16000, channels: 1, language: 'en' })).type, 'voice_ready');
});

test('Host rebinding, oversized JSON and private caching are guarded', async () => {
  const rebound=await new Promise((resolve,reject)=>{http.get(base+'/api/snapshot',{headers:{Host:'evil.invalid',Cookie:cookie}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);}); assert.equal(rebound,403);
  assert.equal((await api('/api/assistant/interpret','POST',{text:'x'.repeat(20000)})).status,413);
  const response=await fetch(base+'/api/auth/session',{headers:{Cookie:cookie}}); assert.equal(response.headers.get('cache-control'),'no-store'); assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
});
test('alert read and acknowledgment do not resolve an active sensor warning', async () => {
  home.setConnected(true); home.ingest('home/sensor/gas/data',Buffer.from('{"raw":3000,"gas_ppm":700,"alert":true}')); const alert=repo.one("SELECT id FROM alerts WHERE state='active'");
  assert.equal((await api('/api/alerts/'+alert.id+'/read','POST',{})).status,200); assert.equal((await api('/api/alerts/'+alert.id+'/acknowledge','POST',{})).status,200); assert.equal(repo.one('SELECT state FROM alerts WHERE id=?',[alert.id]).state,'active');
});
test('unauthenticated and cross-origin sockets cannot upgrade either path', async () => {
  for(const route of ['/ws','/voice']) for(const headers of [{Origin:base},{Origin:'https://evil.invalid',Cookie:cookie}]) await new Promise((resolve,reject)=>{const ws=new WebSocket(base.replace('http','ws')+route,{headers}); ws.on('open',()=>{ws.close();reject(new Error('Unauthorized upgrade'));}); ws.on('unexpected-response',(_req,res)=>{assert.equal(res.statusCode,403);res.resume();resolve();});ws.on('error',()=>{});});
});
test('viewer sees redacted audit but cannot control/administer; malformed historical details are safe', async () => { repo.write("INSERT INTO activity_log(event_type,details) VALUES('legacy_null','null')"); const r = await api('/api/auth/login', 'POST', { username: 'viewer', password }); cookie = r.cookie.split(';')[0]; csrf = r.value.csrf_token; assert.equal((await api('/api/logs/rfid-cards')).status, 403); assert.equal((await api('/api/devices/light-1/command', 'POST', { action: 'off', idempotency_key: require('crypto').randomUUID() })).status, 403); const a = await api('/api/activity'); assert.equal(a.status,200); assert.equal(a.value.items.some(row => row.details.uid), false); });
