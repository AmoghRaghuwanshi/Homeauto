function connectBroker(home, config) {
  if (!config.MQTT_ENABLED) return { close: async () => {} };
  if (!config.MQTT_USERNAME || !config.MQTT_PASSWORD) throw new Error('MQTT credentials required; anonymous broker connections are disabled.');
  const brokerUrl = new URL(config.MQTT_BROKER);
  if (brokerUrl.protocol !== 'mqtts:' && !(brokerUrl.protocol === 'mqtt:' && ['localhost', '127.0.0.1', '[::1]'].includes(brokerUrl.hostname))) throw new Error('Remote MQTT requires TLS. A loopback-only test broker may use mqtt.');
  const disconnected = () => { try { home.setConnected(false); } catch { home.connected = false; home.fault = 'PERSISTENCE_UNAVAILABLE'; home.emitChange(); } };
  const client = require('mqtt').connect(config.MQTT_BROKER, { clientId: 'homeauto-' + require('crypto').randomUUID(), username: config.MQTT_USERNAME, password: config.MQTT_PASSWORD, clean: true, reconnectPeriod: 5000, queueQoSZero: false, resubscribe: true, ...(config.MQTT_CA ? { ca: require('fs').readFileSync(config.MQTT_CA) } : {}) });
  home.publisher = (topic, payload, options, callback) => {
    if (!client.connected) return callback(new Error('Broker unavailable'));
    client.publish(topic, payload, options, callback);
  };
  client.on('connect', () => client.subscribe(['home/light/+/status', 'home/door/1/status', 'home/door/1/rfid', 'home/sensor/+/data', 'home/esp32/+/online'], error => home.setConnected(!error)));
  client.on('message', (topic, bytes, packet) => { try { home.ingest(topic, bytes, packet); } catch { home.fault = 'PERSISTENCE_UNAVAILABLE'; disconnected(); } });
  client.on('offline', disconnected); client.on('close', disconnected);
  client.on('error', () => { home.fault = 'BROKER_UNAVAILABLE'; home.emitChange(); });
  return { close: () => new Promise(resolve => client.end(true, {}, resolve)) };
}
module.exports = { connectBroker };
