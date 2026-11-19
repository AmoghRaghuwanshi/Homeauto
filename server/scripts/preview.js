const crypto = require('crypto');
const { createRepository } = require('../db/repository');
const { Home } = require('../services/home');
const { Sessions, hash } = require('../auth/sessions');
const { startRuntime, loadConfig } = require('../lifecycle');
async function createPreview({ port = 0, voice = false, loginRequired = false, cameraMode = 'disabled', heartbeat = true } = {}) {
  const repo = await createRepository(); const credentials = { username: 'preview-owner', password: crypto.randomBytes(24).toString('base64url') };
  const sessions = new Sessions(repo, { secure: false }); const user = await sessions.addUser({ ...credentials, display_name: 'Local preview', can_unlock: true });
  if (!loginRequired) {
    // Guest access is confined to this loopback, in-memory simulator.
    // The physical-device runtime never installs this session adapter.
    const token = crypto.randomBytes(32).toString('hex');
    sessions.get = candidate => candidate === token ? {
      user_id: user.id, token_hash: hash(token), role: user.role, can_unlock: true,
      created_at: Date.now(), expires_at: Date.now() + 28800000, last_active_at: Date.now(), reauth_at: Date.now(),
      csrf_token: hash('csrf:' + token), user: { ...user, preview: true },
    } : null;
    sessions.readRequest = () => ({ token, session: sessions.get(token) });
  }
  const home = new Home(repo, { simulation: true, allowDoor: true });
  if (voice) {
    const { version, ...settings } = home.preferences({ user_id: user.id });
    repo.write('INSERT INTO user_preferences(user_id,value_json,version) VALUES(?,?,?)', [user.id, JSON.stringify({ ...settings, input_language: 'auto', reply_language: 'auto', spoken_replies: true }), 1]);
  }
  home.publisher = (topic, action, options, callback) => { callback(null); const target = action === 'lock' ? 'locked' : action === 'unlock' ? 'unlocked' : action; setTimeout(() => { if (action !== 'deny') home.ingest(topic.replace('/command', '/status'), Buffer.from(target)); }, 500).unref(); };
  home.setConnected(true);
  for (const [id, value] of [['1', 'on'], ['2', 'off'], ['3', 'off'], ['4', 'on']]) home.ingest(`home/light/${id}/status`, Buffer.from(value));
  home.ingest('home/door/1/status', Buffer.from('locked')); home.ingest('home/sensor/gas/data', Buffer.from('{"raw":220,"gas_ppm":53,"alert":false}')); home.ingest('home/sensor/motion/data', Buffer.from('{"motion":false}'));
  const config = { ...loadConfig({ ...process.env, HOMEAUTO_CLOUD_SYNC_ENABLED: '0', HOMEAUTO_GATEWAY_ENABLED: '0' }), HOST: '127.0.0.1', PORT: port, KEY_PATH: '', CERT_PATH: '', MQTT_ENABLED: false, VOICE_ENABLED: voice, CAMERA_MODE: cameraMode, CLOUD_SYNC: null, GATEWAY: null };
  let moduleSettings = null;
  const moduleStore = { load: () => moduleSettings, save: value => { moduleSettings = structuredClone(value); } };
  // Keep the simulator's door PIN separate from the household's encrypted file.
  let simulatedPin = null;
  const doorConfig = {
    pin: () => simulatedPin,
    configured: () => simulatedPin !== null,
    async setPin(pin) {
      if (typeof pin !== 'string' || !/^[0-9]{4,8}$/.test(pin)) {
        const { fail } = require('../lib/errors'); fail('INVALID_DOOR_PIN', 400);
      }
      simulatedPin = pin;
    },
  };
  const runtime = await startRuntime(config, { repo, home, sessions, moduleStore, doorConfig, broker: { close: async () => {} } });
  // This heartbeat is explicitly an isolated simulator; no TCP/MQTT device link.
  const timer = heartbeat ? setInterval(() => {
    for (const id of ['light-1','light-2','light-3','light-4','door-1']) {
      const current = home.observations.get(id)?.status;
      if (current) home.ingest('home/' + id.replace('-', '/') + '/status', Buffer.from(current));
    }
    const gas = home.device('sensor-gas')?.latest;
    if (gas) home.ingest('home/sensor/gas/data', Buffer.from(JSON.stringify({ raw: gas.raw, gas_ppm: gas.gas_ppm, alert: gas.alert })));
    const motion = home.observations.get('sensor-motion')?.status;
    if (motion) home.ingest('home/sensor/motion/data', Buffer.from(JSON.stringify({ motion: motion === 'detected' })));
  }, 5000) : null; timer?.unref();
  const stop = runtime.stop; runtime.stop = async () => { clearInterval(timer); await stop(); };
  return { runtime, credentials, url: 'http://127.0.0.1:' + runtime.server.address().port };
}
if (require.main === module) {
  console.error('This is a test fixture. Use Start-HomeAuto.bat or npm run simulation for simulation; Start-HomeAuto-Hardware.bat opens the real hub.');
  process.exitCode = 1;
}
module.exports = { createPreview };
