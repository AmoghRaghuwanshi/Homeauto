const net = require('node:net');
const dns = require('node:dns').promises;
const { fail, fields } = require('../lib/errors');

function validateBroker(value) {
  fields(value, ['url', 'username', 'password'], ['url', 'username', 'password']);
  if (![value.url, value.username, value.password].every(item => typeof item === 'string' && item.length > 0 && item.length <= 2048)) fail('VALIDATION_ERROR');
  let url;
  try { url = new URL(value.url); } catch { fail('VALIDATION_ERROR'); }
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) fail('VALIDATION_ERROR');
  if (url.protocol !== 'mqtts:' && !(url.protocol === 'mqtt:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) fail('MQTT_TLS_REQUIRED', 422);
  return { url: url.toString(), username: value.username, password: value.password };
}

function validateCamera(value) {
  fields(value, ['host', 'port'], ['host', 'port']);
  if (typeof value.host !== 'string' || !/^[a-zA-Z0-9.-]{1,253}$/.test(value.host) || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535) fail('VALIDATION_ERROR');
  return { host: value.host, port: value.port };
}

function privateAddress(address) {
  if (!net.isIPv4(address)) return false;
  const [a,b] = address.split('.').map(Number);
  return a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31;
}

async function probeCamera(camera) {
  const address = (await dns.lookup(camera.host, { family: 4 })).address;
  if (!privateAddress(address)) fail('CAMERA_LAN_REQUIRED', 422);
  return new Promise(resolve => {
    const socket = new net.Socket();
    const finish = reachable => { socket.destroy(); resolve(reachable); };
    socket.setTimeout(3000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(camera.port, address);
  });
}

class ModuleService {
  constructor({ home, config, store, reconnect, probe = probeCamera }) {
    Object.assign(this, { home, config, store, reconnect, probe });
    this.saved = {};
    this.cameraState = 'not_configured';
    this.cameraCheckedAt = null;
    this.busy = false;
    this.warning = null;
    try {
      const saved = store?.load();
      if (saved?.broker) this.saved.broker = validateBroker(saved.broker);
      if (saved?.camera) this.saved.camera = validateCamera(saved.camera);
    } catch { this.warning = 'MODULE_CONFIGURATION_UNAVAILABLE'; }
    if (this.saved.broker) this.applyBrokerConfig(this.saved.broker);
    if (config.MQTT_ENABLED && (!config.MQTT_USERNAME || !config.MQTT_PASSWORD)) {
      config.MQTT_ENABLED = false;
      this.warning = 'MQTT_CREDENTIALS_REQUIRED';
    }
  }

  applyBrokerConfig(value) {
    Object.assign(this.config, { MQTT_ENABLED: true, MQTT_BROKER: value.url, MQTT_USERNAME: value.username, MQTT_PASSWORD: value.password });
  }

  status() {
    const hardwareReady = this.home.hardwareReady();
    let cameraState = 'not_configured';
    if (this.saved.camera) {
      cameraState = this.cameraState;
      if (cameraState === 'not_configured' || this.cameraCheckedAt !== null && this.home.now() - this.cameraCheckedAt > 15000) cameraState = 'unverified';
    }
    let brokerUrl = '';
    try {
      const url = new URL(this.config.MQTT_BROKER);
      url.username = ''; url.password = '';
      brokerUrl = url.toString();
    } catch { /* An unconfigured broker has no usable URL. */ }
    const boards = Object.entries(this.home.boards).map(([id, board]) => ({ id, name: board.name, state: this.home.boardOnline(id) ? 'connected' : 'disconnected', last_seen: board.lastSeen === null ? null : new Date(board.lastSeen).toISOString() }));
    return { version: 1, hardware_ready: hardwareReady, mqtt: { configured: !!this.config.MQTT_ENABLED,
      connected: this.home.connected, url: brokerUrl, username: this.config.MQTT_USERNAME || '', password_saved: !!this.config.MQTT_PASSWORD }, boards,
      camera: { configured: !!this.saved.camera, ...(this.saved.camera || {}), state: cameraState,
        last_checked: this.cameraCheckedAt === null ? null : new Date(this.cameraCheckedAt).toISOString(), video_verified: false },
      sensors: ['sensor-gas','sensor-motion'].map(id => ({ id, connected: this.home.device(id)?.observation.freshness === 'current' })), warning: this.warning };
  }

  async configure(kind, input) {
    if (this.busy) fail('MODULE_BUSY', 409);
    this.busy = true;
    try {
      if (kind === 'esp32' && input.password === '' && input.url === this.config.MQTT_BROKER && input.username === this.config.MQTT_USERNAME) {
        input = { ...input, password: this.config.MQTT_PASSWORD };
      }
      const value = kind === 'esp32' ? validateBroker(input) : validateCamera(input);
      const next = { ...this.saved, [kind === 'esp32' ? 'broker' : 'camera']: value };
      await this.store.save(next);
      this.saved = next;
      this.warning = null;
      if (kind === 'esp32') {
        this.applyBrokerConfig(value);
        await this.reconnect();
      } else { this.cameraState = 'unverified'; this.cameraCheckedAt = null; }
      return this.status();
    } finally { this.busy = false; }
  }

  async connect(kind) {
    if (this.busy) fail('MODULE_BUSY', 409);
    this.busy = true;
    try {
      if (kind === 'esp32') {
        if (!this.config.MQTT_ENABLED) fail('MODULE_NOT_CONFIGURED', 409);
        await this.reconnect();
      } else {
        if (!this.saved.camera) fail('MODULE_NOT_CONFIGURED', 409);
        try { this.cameraState = await this.probe(this.saved.camera) ? 'reachable_unverified' : 'disconnected'; }
        catch (error) { this.cameraState = 'disconnected'; if (error.code === 'CAMERA_LAN_REQUIRED') throw error; }
        finally { this.cameraCheckedAt = this.home.now(); }
      }
      return this.status();
    } finally { this.busy = false; }
  }
}

module.exports = { ModuleService, validateBroker, validateCamera, privateAddress };
