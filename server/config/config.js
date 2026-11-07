// Centralised configuration for the Home Automation server
const path = require('path');

module.exports = {
  // Express server port
  PORT: 3000,

  // HTTPS port (for phone mic access)
  HTTPS_PORT: 3443,

  // SSL cert paths
  CERT_PATH: path.join(__dirname, '..', 'certs', 'server.cert'),
  KEY_PATH: path.join(__dirname, '..', 'certs', 'server.key'),

  // MQTT broker connection
  MQTT_BROKER: 'mqtt://localhost:1883',
  MQTT_OPTIONS: {
    clientId: 'home-auto-server-' + Math.random().toString(16).substr(2, 8),
    clean: true,
    reconnectPeriod: 5000,
  },

  // MQTT topic patterns
  TOPICS: {
    // Lights (ESP32-A with 4 relays)
    LIGHT_COMMAND: 'home/light',      // + /{id}/command
    LIGHT_STATUS: 'home/light',       // + /{id}/status

    // Door security (ESP32-B with RFID)
    DOOR_COMMAND: 'home/door',        // + /{id}/command
    DOOR_STATUS: 'home/door',         // + /{id}/status
    RFID_EVENT: 'home/door',          // + /{id}/rfid

    // Sensors (gas + motion on ESP32-A)
    SENSOR_DATA: 'home/sensor',       // + /{id}/data

    // Subscriptions (wildcard)
    SUB_LIGHT_STATUS: 'home/light/+/status',
    SUB_DOOR_STATUS: 'home/door/+/status',
    SUB_RFID_EVENT: 'home/door/+/rfid',
    SUB_SENSOR_DATA: 'home/sensor/+/data',
    SUB_ESP_ONLINE: 'home/esp32/+/online',
  },

  // ESP32 board definitions
  ESP_BOARDS: {
    'lights': { name: 'ESP32-A (Lights + Sensors)', devices: ['light-1','light-2','light-3','light-4','sensor-gas','sensor-motion'] },
    'door':   { name: 'ESP32-B (Door Security)',     devices: ['door-1'] },
  },

  // Heartbeat timeout (ms) — mark offline if no message received within this time
  ESP_TIMEOUT: 60000,

  // SQLite database path
  DB_PATH: __dirname + '/../db/home_auto.db',

  // ─── Voice Assistant Config ─────────────────────────────
  // Vosk model paths
  VOSK_MODELS_DIR: path.join(__dirname, '..', 'voice', 'models'),

  // Room-to-device mapping (customise to match your home)
  ROOMS: {
    'room 1':      ['light-1', 'light-2'],
    'room 2':      ['light-3', 'light-4'],
    'entrance':    ['door-1'],
    'kitchen':     ['sensor-gas'],
    'hallway':     ['sensor-motion'],
  },

  // Room aliases (Hindi names, nicknames, etc.)
  ROOM_ALIASES: {
    // Hindi
    'कमरा 1':      'room 1',
    'कमरा 2':      'room 2',
    'रसोई':        'kitchen',
    'किचन':        'kitchen',
    'बरामदा':      'hallway',
    'गलियारा':     'hallway',
    'दरवाज़ा':     'entrance',
    'दरवाजा':      'entrance',
    'गेट':         'entrance',

    // English aliases
    'bedroom':     'room 1',
    'living room': 'room 2',
    'living':      'room 2',
    'gate':        'entrance',
    'front door':  'entrance',
  },
};
