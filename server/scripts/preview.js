const crypto = require('crypto');
const { createRepository } = require('../db/repository');
const { Home } = require('../services/home');
const { Sessions, hash } = require('../auth/sessions');
const { startRuntime, loadConfig } = require('../lifecycle');
async function createPreview({ port = 0, voice = false, loginRequired = false } = {}) {
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
  home.publisher = (topic, action, options, callback) => { callback(null); const target = action === 'lock' ? 'locked' : action === 'unlock' ? 'unlocked' : action; setTimeout(() => { if (action !== 'deny') home.ingest(topic.replace('/command', '/status'), Buffer.from(target)); }, 500).unref(); };
  home.setConnected(true);
  for (const [id, value] of [['1', 'on'], ['2', 'off'], ['3', 'off'], ['4', 'on']]) home.ingest(`home/light/${id}/status`, Buffer.from(value));
  home.ingest('home/door/1/status', Buffer.from('locked')); home.ingest('home/sensor/gas/data', Buffer.from('{"raw":220,"gas_ppm":53,"alert":false}')); home.ingest('home/sensor/motion/data', Buffer.from('{"motion":false}'));
  const config = { ...loadConfig({ ...process.env, HOMEAUTO_CLOUD_SYNC_ENABLED: '0', HOMEAUTO_GATEWAY_ENABLED: '0' }), HOST: '127.0.0.1', PORT: port, KEY_PATH: '', CERT_PATH: '', MQTT_ENABLED: false, VOICE_ENABLED: voice, CLOUD_SYNC: null, GATEWAY: null };
  const runtime = await startRuntime(config, { repo, home, sessions, broker: { close: async () => {} } });
  // This heartbeat is explicitly an isolated simulator; no TCP/MQTT device link.
  const timer = setInterval(() => { home.ingest('home/esp32/lights/online', Buffer.from('true')); home.ingest('home/esp32/door/online', Buffer.from('true')); }, 25000); timer.unref();
  const stop = runtime.stop; runtime.stop = async () => { clearInterval(timer); await stop(); };
  return { runtime, credentials, url: 'http://127.0.0.1:' + runtime.server.address().port };
}
if (require.main === module) createPreview({ port: Number(process.env.HOMEAUTO_PREVIEW_PORT || 3001), voice: true }).then(({ runtime, url }) => {
  console.log('ISOLATED SIMULATOR ONLY: ' + url); console.log('Opens directly without login. No production DB or broker is used.');
  process.once('SIGINT', () => runtime.stop()); process.once('SIGTERM', () => runtime.stop());
}).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { createPreview };
