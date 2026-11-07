const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { createRepository } = require('./db/repository');
const { maintain } = require('./db/maintenance');
const { Sessions } = require('./auth/sessions');
const { Home } = require('./services/home');
const { Assistant } = require('./services/assistant');
const { SpeechService } = require('./voice/speech-service');
const { createApp } = require('./app');
const { attachRealtime } = require('./realtime');
const { connectBroker } = require('./mqtt/broker');
const { loadSyncConfig } = require('./cloud/config');
const { createSyncWorker, syncStatus } = require('./cloud/worker');
const { loadGatewayConfig, createGatewayWorker, gatewayStatus } = require('./online/gateway');
function loadConfig(env = process.env) {
  const root = path.join(__dirname, '..'); const local = path.join(root, '.local');
  return {
    CLOUD_SYNC: loadSyncConfig(env),
    GATEWAY: loadGatewayConfig(env),
    HOST: env.HOMEAUTO_HOST || '127.0.0.1', PORT: Number(env.HOMEAUTO_PORT || 3000),
    DB_PATH: env.HOMEAUTO_DB_PATH || path.join(__dirname, 'db', 'home_auto.db'),
    CERT_PATH: env.HOMEAUTO_CERT_PATH || path.join(local, 'tls', 'server.cert'), KEY_PATH: env.HOMEAUTO_KEY_PATH || path.join(local, 'tls', 'server.key'),
    ALLOWED_HOSTS: (env.HOMEAUTO_ALLOWED_HOSTS || 'localhost,127.0.0.1,[::1]').split(',').map(s => s.trim()),
    MQTT_ENABLED: env.HOMEAUTO_MQTT_ENABLED === '1', MQTT_BROKER: env.HOMEAUTO_MQTT_BROKER || 'mqtts://localhost:8883', MQTT_USERNAME: env.HOMEAUTO_MQTT_USERNAME, MQTT_PASSWORD: env.HOMEAUTO_MQTT_PASSWORD, MQTT_CA: env.HOMEAUTO_MQTT_CA,
    DOOR_ENABLED: env.HOMEAUTO_DOOR_ENABLED === '1', VOICE_ENABLED: env.HOMEAUTO_VOICE_ENABLED !== '0', MODELS_DIR: env.HOMEAUTO_MODELS_DIR || path.join(__dirname, 'voice', 'models'),
    TTS_PYTHON: env.HOMEAUTO_TTS_PYTHON || path.join(local, 'speech-venv', 'Scripts', 'python.exe'), TTS_MODEL: env.HOMEAUTO_TTS_MODEL || path.join(local, 'speech-assets', 'kokoro-v1.0.onnx'), TTS_VOICES: env.HOMEAUTO_TTS_VOICES || path.join(local, 'speech-assets', 'voices-v1.0.bin'),
  };
}
async function startRuntime(config = loadConfig(), overrides = {}) {
  const secure = fs.existsSync(config.KEY_PATH) && fs.existsSync(config.CERT_PATH);
  if (!['127.0.0.1', 'localhost', '::1'].includes(config.HOST) && !secure) throw new Error('LAN binding requires newly provisioned TLS certificate/key outside source.');
  const repo = overrides.repo || await createRepository({ filename: config.DB_PATH, sync: config.CLOUD_SYNC, gateway: config.GATEWAY });
  let speech, broker, realtime, server, timer, maintenanceTimer, syncWorker, gatewayWorker, closed = false;
  try {
    const home = overrides.home || new Home(repo, { allowDoor: config.DOOR_ENABLED });
    const sessions = overrides.sessions || new Sessions(repo, { secure });
    const assistant = new Assistant(home); speech = overrides.speech || new SpeechService(home, assistant, config);
    if (config.CLOUD_SYNC) syncWorker = createSyncWorker(repo, config.CLOUD_SYNC);
    if (config.GATEWAY) gatewayWorker = createGatewayWorker(home, config.GATEWAY);
    const app = createApp({ repo, home, sessions, assistant, speech, config, cloudStatus: () => config.GATEWAY ? gatewayStatus(repo,true) : syncStatus(repo, !!config.CLOUD_SYNC) });
    server = secure ? https.createServer({ key: fs.readFileSync(config.KEY_PATH), cert: fs.readFileSync(config.CERT_PATH) }, app) : http.createServer(app);
    realtime = attachRealtime(server, { app, home, sessions, assistant, speech });
    broker = overrides.broker || connectBroker(home, config);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.PORT, config.HOST, resolve); });
    speech.start?.();
    syncWorker?.start();
    gatewayWorker?.start();
    try { maintain(repo); } catch { home.fault = 'MAINTENANCE_UNAVAILABLE'; }
    maintenanceTimer = setInterval(() => { try { maintain(repo); } catch { home.fault = 'MAINTENANCE_UNAVAILABLE'; home.emitChange(); } }, 86400000); maintenanceTimer.unref();
    timer = setInterval(() => { try { home.expire(); speech.prune?.(); home.emitChange(); } catch { home.fault = 'PERSISTENCE_UNAVAILABLE'; } }, 5000); timer.unref();
    return { app, server, repo, home, sessions, speech, assistant,
      async stop() { if (closed) return; closed = true; gatewayWorker?.stop(); syncWorker?.stop(); clearInterval(timer); clearInterval(maintenanceTimer); realtime.close(); speech.close?.(); try { await broker.close(); } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); }); repo.close(); } },
    };
  } catch (error) { gatewayWorker?.stop(); syncWorker?.stop(); clearInterval(timer); clearInterval(maintenanceTimer); realtime?.close(); speech?.close?.(); await broker?.close(); server?.close(); repo.close(); throw error; }
}
module.exports = { startRuntime, loadConfig };
