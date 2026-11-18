const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ModuleStore } = require('../modules/store');
const { ModuleService, validateBroker, privateAddress } = require('../modules/service');
const { createPreview } = require('../scripts/preview');
const { createRepository } = require('../db/repository');
const { Home } = require('../services/home');
const { Sessions } = require('../auth/sessions');
const { startRuntime, loadConfig } = require('../lifecycle');

test('module credentials survive restart with encrypted storage and reject corruption', async t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'homeauto-modules-'));
  const filename = path.join(folder, 'modules.enc.json');
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const value = { broker: { url: 'mqtts://broker.example:8883', username: 'test-user', password: 'fixture-private-password' } };
  await new ModuleStore(filename).save(value);
  assert.ok(!fs.readFileSync(filename, 'utf8').includes('fixture-private-password'));
  assert.deepEqual(new ModuleStore(filename).load(), value);
  fs.writeFileSync(filename, '{"version":99}');
  assert.throws(() => new ModuleStore(filename).load());
});

test('broker validation requires TLS off loopback and protects embedded credentials', () => {
  const value = { url: 'mqtts://broker.example:8883', username: 'user', password: 'private' };
  assert.ok(validateBroker(value));
  for (const url of ['mqtt://192.168.1.3', 'http://broker.example', 'mqtts://user:private@broker.example', 'mqtts://broker.example/?password=x']) {
    assert.throws(() => validateBroker({ ...value, url }));
  }
  assert.ok(validateBroker({ ...value, url: 'mqtt://127.0.0.1:1883' }));
  for (const address of ['127.0.0.1','169.254.169.254','8.8.8.8','::1']) assert.equal(privateAddress(address), false);
  for (const address of ['192.168.1.2','10.0.0.2','172.16.1.2']) assert.equal(privateAddress(address), true);
});

test('optional camera configuration does not establish video verification or affect ESP32 readiness', async t => {
  const fixture = await createPreview(); t.after(() => fixture.runtime.stop());
  let saved = null, reconnects = 0;
  const config = { MQTT_BROKER: 'mqtts://localhost:8883' };
  const store = { load: () => saved, save: async value => { saved = structuredClone(value); } };
  const modules = new ModuleService({ home: fixture.runtime.home, config, store, reconnect: async () => { reconnects++; }, probe: async () => true });
  const before = fixture.runtime.home.hardwareReady();
  await modules.configure('camera', { host: '192.168.1.20', port: 554 });
  await modules.connect('camera');
  assert.equal(modules.status().camera.state, 'reachable_unverified');
  assert.equal(modules.status().camera.video_verified, false);
  assert.equal(fixture.runtime.home.hardwareReady(), before);
  await modules.configure('esp32', { url: 'mqtts://broker.example:8883', username: 'user', password: 'fixture-password' });
  assert.equal(reconnects, 1);
  assert.ok(!JSON.stringify(modules.status()).includes('fixture-password'));
  await modules.configure('esp32', { url: config.MQTT_BROKER, username: 'user', password: '' });
  assert.equal(config.MQTT_PASSWORD, 'fixture-password');
  await assert.rejects(modules.configure('esp32', { url: 'mqtts://another.example:8883', username: 'user', password: '' }));
  const restored = new ModuleService({ home: fixture.runtime.home, config: {}, store, reconnect: async () => {} });
  assert.equal(restored.config.MQTT_PASSWORD, 'fixture-password');
  store.save = async () => { throw Error('Disk failure'); };
  await assert.rejects(modules.configure('camera', { host: '192.168.1.30', port: 554 }));
  assert.equal(modules.status().camera.host, '192.168.1.20');
});

test('assistant and speech require a fresh ESP32 and revoke readiness when it disconnects', async t => {
  const fixture = await createPreview({ voice: true }); t.after(() => fixture.runtime.stop());
  const { home, assistant, speech, sessions } = fixture.runtime;
  home.hardwareRequired = true;
  home.setConnected(false);
  const actor = sessions.readRequest().session;
  assert.throws(() => assistant.interpret('Hello', actor), error => error.code === 'ESP32_REQUIRED');
  assert.throws(() => speech.ticket(actor), error => error.code === 'ESP32_REQUIRED');
  assert.equal(speech.readiness().stt_ready, false);
  home.setConnected(true);
  home.ingest('home/esp32/lights/online', Buffer.from('true'), { retain: true });
  assert.equal(home.hardwareReady(), false);
  home.ingest('home/esp32/lights/online', Buffer.from('true'));
  assert.equal(home.hardwareReady(), true);
  assert.equal(speech.readiness().stt_ready, true);
  const intent = assistant.interpret('Hello', actor);
  home.setConnected(false);
  assert.throws(() => assistant.execute(intent.intent_id, require('node:crypto').randomUUID(), actor), error => error.code === 'ESP32_REQUIRED');
  await assert.rejects(speech.synthesize('Hello', 'en', actor), error => error.code === 'ESP32_REQUIRED');
});

test('module HTTP management stays available offline and enforces owner, reauthentication and CSRF', async t => {
  const fixture = await createPreview(); t.after(() => fixture.runtime.stop());
  fixture.runtime.home.hardwareRequired = true;
  fixture.runtime.home.setConnected(false);
  const sessions = fixture.runtime.sessions;
  const original = sessions.readRequest;
  const request = (method, route, body, csrf = original().session.csrf_token) => fetch(fixture.url + route, {
    method, headers: { Origin: fixture.url, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal((await request('GET', '/api/modules')).status, 200);
  assert.equal((await request('PUT', '/api/modules/camera', { host: '192.168.1.10', port: 554 }, 'wrong')).status, 403);
  assert.equal((await request('PUT', '/api/modules/camera', { host: '192.168.1.10', port: 554 })).status, 200);
  sessions.readRequest = () => { const old = original(); return { ...old, session: { ...old.session, reauth_at: 0 } }; };
  assert.equal((await request('POST', '/api/modules/esp32/connect', {})).status, 403);
  sessions.readRequest = () => { const old = original(); return { ...old, session: { ...old.session, role: 'viewer' } }; };
  assert.equal((await request('GET', '/api/modules')).status, 403);
  sessions.readRequest = () => ({ session: null });
  assert.equal((await request('GET', '/api/modules', null, 'none')).status, 401);
  assert.equal(fixture.runtime.repo.one('SELECT COUNT(*) n FROM commands').n, 0);
});

test('first owner setup is loopback and origin protected, one-time, and leads to authenticated offline module setup', async t => {
  const repo = await createRepository();
  const home = new Home(repo);
  const config = { ...loadConfig({ HOMEAUTO_MQTT_ENABLED: '0' }), PORT: 0, KEY_PATH: '', CERT_PATH: '', VOICE_ENABLED: false, CLOUD_SYNC: null, GATEWAY: null };
  const runtime = await startRuntime(config, { repo, home, sessions: new Sessions(repo, { secure: false }),
    broker: { close: async () => {} }, moduleStore: { load: () => null, save: async () => {} } });
  t.after(() => runtime.stop());
  const url = 'http://127.0.0.1:' + runtime.server.address().port;
  const body = { username: 'fixture-owner', display_name: 'Fixture owner', password: 'TenChars12' };
  const setup = (origin, data = body) => fetch(url + '/api/auth/setup', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  assert.equal((await setup('https://other.invalid')).status, 403);
  assert.equal((await setup(url, { ...body, role: 'owner' })).status, 400);
  const response = await setup(url);
  assert.equal(response.status, 201);
  const actor = await response.json(); assert.equal(actor.user.role, 'owner');
  const cookie = response.headers.get('set-cookie').split(';')[0];
  assert.equal((await setup(url)).status, 409);
  assert.equal((await fetch(url + '/api/modules', { headers: { Cookie: cookie } })).status, 200);
  const status = await (await fetch(url + '/api/auth/setup-status')).json();
  assert.equal(status.setup_required, false);
  assert.equal(home.hardwareReady(), false);
  assert.equal(repo.one('SELECT COUNT(*) n FROM commands').n, 0);
});
