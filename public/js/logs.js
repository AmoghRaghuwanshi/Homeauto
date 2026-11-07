// Activity log and RFID panel management
const Logs = {
  maxEntries: 100,

  icons: {
    command: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>',
    status_change: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    rfid_scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
    system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  },

  addLogEntry(log) {
    const list = document.getElementById('log-list');
    // Remove "waiting" placeholder
    const placeholder = list.querySelector('.muted');
    if (placeholder) placeholder.remove();

    const entry = document.createElement('div');
    const iconType = this.icons[log.event_type] ? log.event_type : 'system';
    entry.className = 'log-entry';

    let details = '';
    try {
      const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      if (d.action) details = `Action: ${d.action}`;
      else if (d.status) details = `Status: ${d.status}`;
      else if (d.uid) details = `Card: ${d.uid} (${d.authorized ? 'Granted' : 'Denied'})`;
      else details = JSON.stringify(d);
    } catch { details = log.details || ''; }

    const deviceName = log.device_id || 'System';
    const time = this.formatTime(log.timestamp);

    entry.innerHTML = `
      <div class="log-entry__icon log-entry__icon--${iconType}">${this.icons[iconType]}</div>
      <div class="log-entry__text"><strong>${deviceName}</strong> — ${details}</div>
      <span class="log-entry__time">${time}</span>
    `;

    list.insertBefore(entry, list.firstChild);

    // Limit displayed entries
    while (list.children.length > this.maxEntries) {
      list.removeChild(list.lastChild);
    }
  },

  async loadRecentLogs() {
    try {
      const res = await fetch('/api/logs?limit=30');
      const logs = await res.json();
      logs.reverse().forEach(log => this.addLogEntry(log));
    } catch (err) {
      console.error('[Logs] Load error:', err);
    }
  },

  clearDisplay() {
    const list = document.getElementById('log-list');
    list.innerHTML = '<p class="muted">Log cleared.</p>';
  },

  // ── RFID Panel ──
  async loadRfidCards() {
    try {
      const res = await fetch('/api/logs/rfid-cards');
      const cards = await res.json();
      this.renderRfidCards(cards);
    } catch (err) {
      console.error('[RFID] Load error:', err);
    }
  },

  renderRfidCards(cards) {
    const list = document.getElementById('rfid-cards-list');
    if (cards.length === 0) {
      list.innerHTML = '<p class="muted">No cards registered yet.</p>';
      return;
    }
    list.innerHTML = cards.map(card => `
      <div class="rfid-card-item" data-uid="${card.uid}">
        <div class="rfid-card-item__info">
          <span class="rfid-card-item__name">${card.owner_name}</span>
          <span class="rfid-card-item__uid">${card.uid}</span>
        </div>
        <button class="btn--danger-sm" onclick="Logs.removeCard('${card.uid}')">Remove</button>
      </div>
    `).join('');
  },

  async addCard(uid, ownerName) {
    try {
      const res = await fetch('/api/logs/rfid-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, owner_name: ownerName }),
      });
      if (res.ok) {
        App.showToast(`Card added for ${ownerName}`, 'success');
        this.loadRfidCards();
      } else {
        const data = await res.json();
        App.showToast(data.error || 'Failed to add card', 'error');
      }
    } catch (err) {
      App.showToast('Failed to add card', 'error');
    }
  },

  async removeCard(uid) {
    try {
      const res = await fetch(`/api/logs/rfid-cards/${uid}`, { method: 'DELETE' });
      if (res.ok) {
        App.showToast('Card removed', 'success');
        this.loadRfidCards();
      }
    } catch (err) {
      App.showToast('Failed to remove card', 'error');
    }
  },

  addRfidEvent(event) {
    const list = document.getElementById('rfid-events-list');
    const placeholder = list.querySelector('.muted');
    if (placeholder) placeholder.remove();

    const item = document.createElement('div');
    const cls = event.authorized ? 'rfid-event-item--granted' : 'rfid-event-item--denied';
    const label = event.authorized ? '✓ Granted' : '✗ Denied';

    item.className = `rfid-event-item ${cls}`;
    item.innerHTML = `
      <strong>${label}</strong>
      <span>${event.owner || 'Unknown'} (${event.uid})</span>
      <span class="rfid-event-item__time">${this.formatTime(event.timestamp)}</span>
    `;

    list.insertBefore(item, list.firstChild);
    while (list.children.length > 20) list.removeChild(list.lastChild);
  },

  formatTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr.includes('T') ? isoStr : isoStr + 'Z');
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  },
};
