const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createPreview } = require('../scripts/preview');
const { SpeechService } = require('../voice/speech-service');
const { startRuntime, loadConfig } = require('../lifecycle');

test('voice preview defaults to Automatic/spoken replies and never connects hardware despite inherited settings', async () => {
  const mqtt = require('mqtt'); const connect = mqtt.connect; let hardwareConnections = 0;
  const start = SpeechService.prototype.start;
  const saved = Object.fromEntries(['HOMEAUTO_MQTT_ENABLED','HOMEAUTO_GATEWAY_ENABLED'].map(k => [k, process.env[k]]));
  let fixture;
  try {
    mqtt.connect = () => { hardwareConnections++; throw Error('Real hardware connection forbidden in simulation'); };
    SpeechService.prototype.start = function() {}; // No native inference needed for this isolation test.
    process.env.HOMEAUTO_MQTT_ENABLED = '1'; process.env.HOMEAUTO_GATEWAY_ENABLED = '1';
    fixture = await createPreview({ voice: true });
    const runtime = await (await fetch(fixture.url + '/api/runtime')).json();
    const snapshot = await (await fetch(fixture.url + '/api/snapshot')).json();
    assert.equal(runtime.simulation, true); assert.equal(runtime.device_transport, 'simulated');
    assert.equal(snapshot.preferences.input_language, 'auto'); assert.equal(snapshot.preferences.reply_language, 'auto'); assert.equal(snapshot.preferences.spoken_replies, true);
    const c = fixture.runtime.home.request('light-2', { action: 'on', idempotency_key: crypto.randomUUID() }, { user_id: 'synthetic', role: 'owner' });
    await new Promise(r => setTimeout(r, 650));
    assert.equal(fixture.runtime.home.command(c.id).state, 'observed'); assert.equal(hardwareConnections, 0);
  } finally {
    await fixture?.runtime.stop(); mqtt.connect = connect; SpeechService.prototype.start = start;
    for (const [k,v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});
test('real runtime without a controller stays unavailable and does not manufacture simulation', async () => {
  const config = { ...loadConfig({}), PORT: 0, DB_PATH: ':memory:', CERT_PATH: '', KEY_PATH: '', VOICE_ENABLED: false, MQTT_ENABLED: false, CLOUD_SYNC: null, GATEWAY: null };
  const r = await startRuntime(config);
  try {
    const descriptor = await (await fetch('http://127.0.0.1:' + r.server.address().port + '/api/runtime')).json();
    assert.equal(descriptor.simulation, false); assert.equal(descriptor.device_transport, 'mqtt'); assert.equal(r.home.device('light-1').connectivity, 'offline');
  } finally { await r.stop(); }
});
