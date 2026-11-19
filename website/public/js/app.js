// Main application controller
const App = {
  async init() {
    console.log('[App] Initializing Home Control Dashboard...');

    // Start clock
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);

    // Setup WebSocket listeners
    this.setupWebSocket();

    // Load initial data
    await this.loadDevices();
    await Logs.loadRecentLogs();
    await Logs.loadRfidCards();

    // Setup UI event handlers
    this.setupEventHandlers();

    // Initialise notifications
    Notifications.init();

    // Initialise voice assistant (async, non-blocking)
    Voice.init().catch(err => console.warn('[App] Voice init failed:', err));

    console.log('[App] Ready.');
  },

  setupWebSocket() {
    WS.on('connection', (data) => {
      const el = document.getElementById('connection-status');
      const textEl = el.querySelector('.connection-status__text');
      if (data.connected) {
        el.className = 'connection-status connection-status--connected';
        textEl.textContent = 'Connected';
      } else {
        el.className = 'connection-status connection-status--disconnected';
        textEl.textContent = 'Disconnected';
      }
    });

    WS.on('init', (data) => {
      if (data.devices) Devices.setDevices(data.devices);
      if (data.espBoards) this.updateEspStatus(data.espBoards);
    });

    WS.on('esp_status', (boards) => {
      this.updateEspStatus(boards);
    });

    WS.on('device_update', (device) => {
      Devices.updateDevice(device);
    });

    WS.on('rfid_event', (event) => {
      Logs.addRfidEvent(event);
    });

    WS.on('log', (log) => {
      Logs.addLogEntry(log);
    });

    WS.on('mqtt_status', (data) => {
      if (data.connected) {
        this.showToast('MQTT broker connected', 'success');
      } else {
        this.showToast('MQTT broker disconnected', 'error');
      }
    });

    WS.on('sensor_data', (data) => {
      Devices.updateSensorReading(data);
    });

    WS.on('alert', (data) => {
      const type = data.level === 'danger' ? 'error' : 'info';
      this.showToast(data.message, type);
    });

    WS.connect();
  },

  async loadDevices() {
    try {
      const res = await fetch('/api/devices');
      const devices = await res.json();
      Devices.setDevices(devices);
    } catch (err) {
      console.error('[App] Failed to load devices:', err);
      this.showToast('Failed to load devices', 'error');
    }
  },

  setupEventHandlers() {
    // Quick actions
    document.getElementById('btn-all-lights-off').addEventListener('click', () => Devices.allLightsOff());
    document.getElementById('btn-lock-all-doors').addEventListener('click', () => Devices.lockAllDoors());
    document.getElementById('btn-refresh').addEventListener('click', () => this.loadDevices());
    document.getElementById('btn-clear-log').addEventListener('click', () => Logs.clearDisplay());

    // RFID form
    document.getElementById('rfid-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const uid = document.getElementById('rfid-uid').value.trim();
      const owner = document.getElementById('rfid-owner').value.trim();
      if (uid && owner) {
        Logs.addCard(uid, owner);
        document.getElementById('rfid-uid').value = '';
        document.getElementById('rfid-owner').value = '';
      }
    });
  },

  updateClock() {
    const el = document.getElementById('header-time');
    const now = new Date();
    el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  },

  updateEspStatus(boards) {
    const boardMap = { lights: 'esp-board-lights', door: 'esp-board-door' };
    for (const [boardId, status] of Object.entries(boards)) {
      const elId = boardMap[boardId];
      if (!elId) continue;
      const el = document.getElementById(elId);
      if (!el) continue;

      const dot = el.querySelector('.esp-status__dot');
      if (status.online) {
        dot.className = 'esp-status__dot esp-status__dot--online';
        el.title = `${status.name} — Online`;
      } else {
        dot.className = 'esp-status__dot esp-status__dot--offline';
        const lastSeen = status.lastSeen
          ? `Last seen: ${new Date(status.lastSeen).toLocaleTimeString()}`
          : 'Never connected';
        el.title = `${status.name} — Offline (${lastSeen})`;
      }
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast--removing');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },
};

// Boot the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
