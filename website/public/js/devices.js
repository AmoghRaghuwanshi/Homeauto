// Device rendering and interaction
const Devices = {
  devices: [],

  // SVG icons
  icons: {
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>',
    door: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg>',
    gas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c-4.97 0-9-2.69-9-6v-2c0-3.31 4.03-6 9-6s9 2.69 9 6v2c0 3.31-4.03 6-9 6z"/><path d="M12 2v6"/><path d="M8 4l4 4 4-4"/></svg>',
    motion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><path d="M10 22V18l-2-4 4-4 4 4-2 4v4"/><path d="M6 11l4-3"/><path d="M18 11l-4-3"/></svg>',
    sensor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>',
  },

  // Store latest sensor readings
  sensorData: {},

  setDevices(devices) {
    this.devices = devices;
    this.render();
  },

  updateDevice(updatedDevice) {
    if (!updatedDevice) return;
    const idx = this.devices.findIndex(d => d.id === updatedDevice.id);
    if (idx >= 0) {
      this.devices[idx] = updatedDevice;
    } else {
      this.devices.push(updatedDevice);
    }
    this.renderSingleDevice(updatedDevice);
    this.updateCount();
  },

  render() {
    const grid = document.getElementById('device-grid');
    const emptyState = document.getElementById('empty-state');

    if (this.devices.length === 0) {
      grid.innerHTML = '';
      emptyState.style.display = 'flex';
      this.updateCount();
      return;
    }

    emptyState.style.display = 'none';
    grid.innerHTML = '';

    this.devices.forEach((device, i) => {
      const card = this.createCard(device);
      card.style.animationDelay = `${i * 0.08}s`;
      grid.appendChild(card);
    });

    this.updateCount();
  },

  renderSingleDevice(device) {
    const existing = document.querySelector(`[data-device-id="${device.id}"]`);
    if (existing) {
      const newCard = this.createCard(device);
      existing.replaceWith(newCard);
    } else {
      const grid = document.getElementById('device-grid');
      const emptyState = document.getElementById('empty-state');
      emptyState.style.display = 'none';
      grid.appendChild(this.createCard(device));
    }
  },

  createCard(device) {
    const card = document.createElement('div');
    card.className = `device-card device-card--${device.status}`;
    card.dataset.deviceId = device.id;

    const isLight = device.type === 'light';
    const isDoor = device.type === 'door';
    const isSensor = device.type === 'sensor';
    const isOn = device.status === 'on';
    const isUnlocked = device.status === 'unlocked';
    const isAlert = device.status === 'alert';
    const isDetected = device.status === 'detected';

    const statusText = device.status.charAt(0).toUpperCase() + device.status.slice(1);

    // Pick the right icon
    let icon;
    if (device.id === 'sensor-gas') icon = this.icons.gas;
    else if (device.id === 'sensor-motion') icon = this.icons.motion;
    else icon = this.icons[device.type] || this.icons.sensor;

    // Build action / display area
    let actionHTML = '';
    if (isLight) {
      actionHTML = `<div class="toggle ${isOn ? 'toggle--active' : ''}" data-action="toggle" data-id="${device.id}" title="Toggle ${device.name}"></div>`;
    } else if (isDoor) {
      const btnClass = isUnlocked ? 'door-btn--lock' : 'door-btn--unlock';
      const btnText = isUnlocked ? 'Lock' : 'Unlock';
      actionHTML = `<button class="door-btn ${btnClass}" data-action="toggle" data-id="${device.id}">${btnText}</button>`;
    } else if (isSensor && device.id === 'sensor-gas') {
      const reading = this.sensorData[device.id] || {};
      const ppm = reading.gas_ppm || 0;
      const maxPpm = 1000;
      const pct = Math.min((ppm / maxPpm) * 100, 100);
      const barColor = isAlert ? 'var(--danger)' : ppm > 400 ? 'var(--warning)' : 'var(--success)';
      actionHTML = `
        <div class="sensor-reading" id="reading-${device.id}">
          <div class="sensor-bar">
            <div class="sensor-bar__fill" style="width: ${pct}%; background: ${barColor};"></div>
          </div>
          <span class="sensor-value">${ppm} PPM</span>
        </div>`;
    } else if (isSensor && device.id === 'sensor-motion') {
      const motionClass = isDetected ? 'sensor-motion--active' : '';
      actionHTML = `
        <div class="sensor-motion-display ${motionClass}" id="reading-${device.id}">
          <span class="sensor-motion-icon">${isDetected ? '🚶' : '✓'}</span>
          <span>${isDetected ? 'Motion Detected!' : 'All Clear'}</span>
        </div>`;
    }

    card.innerHTML = `
      <div class="device-card__top">
        <div class="device-card__icon">${icon}</div>
        <div class="device-card__status">
          <span class="device-card__status-dot"></span>
          ${statusText}
        </div>
      </div>
      <div class="device-card__name">${device.name}</div>
      <div class="device-card__location">${device.location || 'No location'}</div>
      <div class="device-card__actions">
        <span style="font-size: 0.72rem; color: var(--text-muted);">${device.last_seen ? 'Last: ' + Devices.formatTime(device.last_seen) : ''}</span>
        ${actionHTML}
      </div>
    `;

    // Add click handlers for lights/doors
    const actionEl = card.querySelector('[data-action="toggle"]');
    if (actionEl) {
      actionEl.addEventListener('click', () => this.sendCommand(device.id, 'toggle'));
    }

    return card;
  },

  // Update live sensor readings without full re-render
  updateSensorReading(data) {
    this.sensorData[data.device_id] = data;
    // Find and re-render just the sensor card
    const device = this.devices.find(d => d.id === data.device_id);
    if (device) this.renderSingleDevice(device);
  },

  async sendCommand(deviceId, action) {
    try {
      const res = await fetch(`/api/devices/${deviceId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.status === 503 && data.error) {
        // ESP32 board is offline
        App.showToast(`⚠️ ${data.error}`, 'error');
        return;
      }
      if (data.device) {
        this.updateDevice(data.device);
        App.showToast(`${data.device.name}: ${data.device.status}`, 'success');
      } else if (data.error) {
        App.showToast(data.error, 'error');
      }
    } catch (err) {
      App.showToast('Failed to send command', 'error');
      console.error('[Devices] Command error:', err);
    }
  },

  async allLightsOff() {
    const lights = this.devices.filter(d => d.type === 'light' && d.status === 'on');
    for (const light of lights) {
      await this.sendCommand(light.id, 'off');
    }
    if (lights.length === 0) App.showToast('All lights are already off', 'info');
  },

  async lockAllDoors() {
    const doors = this.devices.filter(d => d.type === 'door' && d.status !== 'locked');
    for (const door of doors) {
      await this.sendCommand(door.id, 'lock');
    }
    if (doors.length === 0) App.showToast('All doors are already locked', 'info');
  },

  updateCount() {
    const badge = document.getElementById('device-count');
    badge.textContent = this.devices.length;
  },

  formatTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr.includes('T') ? isoStr : isoStr + 'Z');
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },
};
