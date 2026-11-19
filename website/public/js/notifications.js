/*
 * ═══════════════════════════════════════════════════════════
 *  Browser Notification Manager
 *  Handles permission requests and sends offline notifications
 * ═══════════════════════════════════════════════════════════
 */
const Notifications = {
  permission: 'default',
  audioCtx: null,

  init() {
    if (!('Notification' in window)) {
      console.warn('[Notifications] Not supported in this browser');
      return;
    }

    this.permission = Notification.permission;
    console.log('[Notifications] Permission:', this.permission);

    if (this.permission === 'default') {
      this.showPermissionBanner();
    } else if (this.permission === 'denied') {
      console.warn('[Notifications] Blocked. User must enable in browser settings.');
    }

    // Listen for events from WebSocket
    this._setupListeners();
  },

  // ─── Permission Banner ─────────────────────────────────
  showPermissionBanner() {
    // Don't show if already exists
    if (document.getElementById('notif-permission-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'notif-permission-banner';
    banner.className = 'permission-banner';
    banner.innerHTML = `
      <div class="permission-banner__content">
        <span class="permission-banner__icon">🔔</span>
        <div class="permission-banner__text">
          <strong>Enable Notifications</strong>
          <p>Get alerts for gas leaks, motion detection, door events & voice commands.</p>
        </div>
        <button class="btn btn--primary permission-banner__btn" id="btn-enable-notif">Enable</button>
        <button class="permission-banner__close" id="btn-dismiss-notif">✕</button>
      </div>
    `;
    document.body.prepend(banner);

    document.getElementById('btn-enable-notif').addEventListener('click', () => {
      this.requestPermission();
    });
    document.getElementById('btn-dismiss-notif').addEventListener('click', () => {
      banner.classList.add('permission-banner--hidden');
      setTimeout(() => banner.remove(), 300);
    });
  },

  async requestPermission() {
    try {
      const result = await Notification.requestPermission();
      this.permission = result;
      console.log('[Notifications] Permission result:', result);
      const banner = document.getElementById('notif-permission-banner');
      if (banner) {
        banner.classList.add('permission-banner--hidden');
        setTimeout(() => banner.remove(), 300);
      }
      if (result === 'granted') {
        this.send('Notifications Enabled ✅', 'You will now receive alerts from Home Control.', 'success');
      }
    } catch (err) {
      console.error('[Notifications] Permission error:', err);
    }
  },

  // ─── Send Notification ─────────────────────────────────
  send(title, body, type = 'info') {
    if (this.permission !== 'granted') return;

    const icons = { success: '✅', error: '🔴', warning: '⚠️', info: 'ℹ️', danger: '🚨' };
    const icon = icons[type] || icons.info;

    try {
      const notif = new Notification(`${icon} ${title}`, {
        body,
        tag: `home-auto-${Date.now()}`,
        silent: false,
      });

      // Auto-close after 5 seconds
      setTimeout(() => notif.close(), 5000);

      // Play alert sound for danger/warning
      if (type === 'danger' || type === 'error') {
        this._playAlertSound();
      }
    } catch (err) {
      console.error('[Notifications] Send error:', err);
    }
  },

  // ─── WebSocket Event Listeners ─────────────────────────
  _setupListeners() {
    // Gas / Motion alerts
    WS.on('alert', (data) => {
      const type = data.level === 'danger' ? 'danger' : 'warning';
      this.send('Alert', data.message, type);
    });

    // RFID events
    WS.on('rfid_event', (data) => {
      if (data.authorized) {
        this.send('Door Access', `🔓 ${data.owner} — Access Granted`, 'success');
      } else {
        this.send('Door Access Denied', `🚫 Unknown card: ${data.uid}`, 'error');
      }
    });

    // Device updates (only door lock/unlock)
    WS.on('device_update', (device) => {
      if (!device) return;
      if (device.type === 'door') {
        const status = device.status === 'unlocked' ? '🔓 Unlocked' : '🔒 Locked';
        this.send(`${device.name}`, status, 'info');
      }
    });

    // Voice command results
    WS.on('voice_result', (data) => {
      if (data.success) {
        this.send('Voice Command', `🎙️ "${data.transcript}" — Executed ✅`, 'success');
      } else {
        this.send('Voice Command', `🎙️ "${data.transcript}" — ${data.error || 'Failed'}`, 'warning');
      }
    });
  },

  // ─── Alert Sound (Web Audio API, no files needed) ──────
  _playAlertSound() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) { /* ignore audio errors */ }
  },
};
