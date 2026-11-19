// WebSocket client with auto-reconnect
const WS = {
  socket: null,
  listeners: {},
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  connected: false,

  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws`;
    console.log('[WS] Connecting to', url);

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log('[WS] Connected');
      this.connected = true;
      this.reconnectDelay = 1000;
      this.emit('connection', { connected: true });
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.emit(msg.type, msg.data);
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    this.socket.onclose = () => {
      console.log('[WS] Disconnected');
      this.connected = false;
      this.emit('connection', { connected: false });
      this._reconnect();
    };

    this.socket.onerror = (err) => {
      console.error('[WS] Error:', err);
      this.socket.close();
    };
  },

  _reconnect() {
    console.log(`[WS] Reconnecting in ${this.reconnectDelay}ms...`);
    setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  },

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  },

  emit(event, data) {
    const cbs = this.listeners[event];
    if (cbs) cbs.forEach(cb => cb(data));
  },
};
