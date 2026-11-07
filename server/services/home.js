const { EventEmitter } = require('events');
const crypto = require('crypto');
const { byId } = require('../lib/registry');
const { fail, uuid } = require('../lib/errors');
const { authorize, hash } = require('../auth/sessions');
const terminal = new Set(['observed', 'uncertain', 'failed']);
const defaults = { favorites: [], reply_language: 'auto', input_language: 'auto', spoken_replies: false, voice_rate: 1, notification_categories: ['gas', 'motion', 'access_denied'] };
class Home extends EventEmitter {
  constructor(repo, { now = Date.now, publisher = null, allowDoor = false, simulation = false } = {}) {
    super(); this.repo = repo; this.now = now; this.publisher = publisher; this.allowDoor = allowDoor; this.simulation = simulation;
    this.epoch = crypto.randomUUID(); this.connected = false; this.fault = null;
    this.boards = { lights: { name: 'ESP32-A (Lights + Sensors)', online: false, lastSeen: null }, door: { name: 'ESP32-B (Door Security)', online: false, lastSeen: null } };
    this.observations = new Map(); this.scanTimes = new Map();
  }
  emitChange() { this.emit('change'); }
  rooms() { return this.repo.all('SELECT * FROM rooms ORDER BY sort_order,name'); }
  preferences(actor) { const p = this.repo.one('SELECT * FROM user_preferences WHERE user_id=?', [actor.user_id]); return { ...defaults, ...(p ? JSON.parse(p.value_json) : {}), version: p ? p.version : 0 }; }
  homeSettings() { const r = this.repo.one("SELECT * FROM home_settings WHERE key='home_name'"); return { home_name: JSON.parse(r.value_json), version: r.version }; }
  boardOnline(id) { const b = this.boards[id]; return !!(this.connected && b?.online && b.lastSeen !== null && this.now() - b.lastSeen <= 60000); }
  device(id) {
    const d = this.repo.getDevice(id); const reg = byId[id]; if (!d || !reg) return null;
    const obs = this.observations.get(id); const limit = id === 'sensor-gas' ? 10000 : 65000;
    const current = !!(obs && !obs.retained && obs.epoch === this.epoch && this.boardOnline(reg.board_id) && this.now() - obs.time <= limit);
    const pending = this.repo.one("SELECT id FROM commands WHERE device_id=? AND state IN ('accepted','published')", [id]);
    const latest = this.repo.one('SELECT * FROM sensor_latest WHERE device_id=?', [id]);
    return { ...d, type: reg.type, board_id: reg.board_id, capabilities: reg.capabilities, connectivity: this.boardOnline(reg.board_id) ? 'online' : 'offline', is_online: +current,
      observation: { reported_status: obs?.status || d.status || null, received_at: obs ? new Date(obs.time).toISOString() : d.last_seen, freshness: current ? 'current' : obs || d.last_seen ? 'stale' : 'unknown', retained: !!obs?.retained, physical_verified: false, source: obs ? 'controller_report' : 'legacy_db', version: d.version },
      latest: latest ? { ...JSON.parse(latest.payload_json), received_at: latest.received_at } : null, pending_command_id: pending?.id || null };
  }
  command(id) {
    const c = this.repo.one('SELECT * FROM commands WHERE id=?', [id]);
    return c ? { ...c, already_reported: !!c.already_reported, evidence: c.state === 'observed' ? 'controller_report' : null, correlation: c.state === 'observed' ? 'temporal' : null, physical_verified: false } : null;
  }
  alerts(actor) {
    return this.repo.all('SELECT a.*,r.read_at,r.acknowledged_at FROM alerts a LEFT JOIN alert_receipts r ON r.alert_id=a.id AND r.user_id=? ORDER BY (a.state=\'active\') DESC,a.opened_at DESC LIMIT 100', [actor.user_id]).map(a => ({ ...a, receipt: { read_at: a.read_at, acknowledged_at: a.acknowledged_at } }));
  }
  snapshot(actor, speech = {}) {
    return { schema_version: 1, server_epoch: this.epoch, devices: this.repo.getDevices().filter(d => byId[d.id]).map(d => this.device(d.id)), rooms: this.rooms(),
      espBoards: Object.fromEntries(Object.entries(this.boards).map(([id, b]) => [id, { ...b, online: this.boardOnline(id), lastSeen: b.lastSeen === null ? null : new Date(b.lastSeen).toISOString() }])), mqtt: { connected: this.connected },
      commands: this.repo.all("SELECT id FROM commands ORDER BY requested_at DESC LIMIT 40").map(c => this.command(c.id)).filter(c => actor.role === 'owner' || c.actor_id === actor.user_id),
      alerts: this.alerts(actor), session: actor.user, preferences: this.preferences(actor), home: this.homeSettings(), speech,
      system: { simulation: this.simulation, door_enabled: this.allowDoor, persistence_healthy: this.repo.healthy(), fault: this.fault } };
  }
  setConnected(connected) {
    this.connected = connected;
    if (!connected) { for (const b of Object.values(this.boards)) b.online = false; this.expire(true); }
    this.emitChange();
  }
  challenge(actor) {
    authorize(actor, 'unlock', this.now());
    if (!this.allowDoor) fail('DOOR_SAFETY_SETUP_REQUIRED', 503);
    if (!this.boardOnline('door') || !this.repo.healthy()) fail('DEVICE_UNAVAILABLE', 503);
    if (this.repo.one("SELECT id FROM commands WHERE device_id='door-1' AND state IN ('accepted','published')")) fail('DEVICE_BUSY', 409);
    const token = crypto.randomBytes(24).toString('hex');
    this.repo.write('INSERT INTO unlock_challenges(token_hash,session_hash,device_id,expires_at) VALUES(?,?,?,?)', [hash(token), actor.token_hash, 'door-1', this.now() + 30000]);
    return { confirmation_id: token, device_id: 'door-1', expires_at: new Date(this.now() + 30000).toISOString() };
  }
  request(id, input, actor, source = 'manual', admit = null) {
    const reg = byId[id]; if (!reg) fail('NOT_FOUND', 404);
    if (!uuid(input.idempotency_key)) fail('INVALID_IDEMPOTENCY_KEY');
    authorize(actor, 'control', this.now());
    const requestHash = hash(JSON.stringify({ id, action: input.action, confirmation_id: input.confirmation_id || null, source }));
    const existing = this.repo.one('SELECT * FROM commands WHERE actor_id=? AND idempotency_key=?', [actor.user_id, input.idempotency_key]);
    if (existing) { if (existing.request_hash !== requestHash) fail('IDEMPOTENCY_CONFLICT', 409); return this.command(existing.id); }
    let action = input.action;
    const d = this.device(id);
    if (reg.type === 'light' && action === 'toggle') { if (d.observation.freshness !== 'current') fail('STATE_UNKNOWN', 503); action = d.observation.reported_status === 'on' ? 'off' : 'on'; }
    if (!(reg.type === 'light' ? ['on', 'off'] : reg.type === 'door' ? ['lock', 'unlock'] : []).includes(action)) fail('UNSUPPORTED_ACTION', 422);
    if (reg.type === 'door' && !this.allowDoor) fail('DOOR_SAFETY_SETUP_REQUIRED', 503);
    if (action === 'unlock') {
      if (source !== 'manual' && source !== 'rfid') fail('SENSITIVE_ACTION_REQUIRES_UI', 403);
      if (source !== 'rfid') authorize(actor, 'unlock', this.now());
    }
    if (!this.connected || !this.publisher || !this.boardOnline(reg.board_id)) fail('DEVICE_UNAVAILABLE', 503);
    if (!this.repo.healthy()) fail('PERSISTENCE_UNAVAILABLE', 503);
    if (this.repo.one("SELECT id FROM commands WHERE device_id=? AND state IN ('accepted','published')", [id])) fail('DEVICE_BUSY', 409);
    const commandId = crypto.randomUUID(); const now = this.now();
    const target = { on: 'on', off: 'off', lock: 'locked', unlock: 'unlocked' }[action];
    const noop = action !== 'unlock' && d.observation.freshness === 'current' && d.observation.reported_status === target;
    this.repo.transaction(tx => {
      if (action === 'unlock' && source !== 'rfid') {
        const c = tx.one('SELECT * FROM unlock_challenges WHERE token_hash=?', [hash(String(input.confirmation_id || ''))]);
        if (!c || c.session_hash !== actor.token_hash || c.device_id !== id || c.expires_at <= now || c.consumed_at) fail('CONFIRMATION_EXPIRED', 409);
        tx.run('UPDATE unlock_challenges SET consumed_at=? WHERE token_hash=?', [now, c.token_hash]);
      }
      tx.run('INSERT INTO commands(id,device_id,actor_id,source,action,state,idempotency_key,request_hash,requested_at,deadline_at,observed_at,already_reported) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', [commandId, id, actor.user_id, source, action, noop ? 'observed' : 'accepted', input.idempotency_key, requestHash, new Date(now).toISOString(), new Date(now + (reg.type === 'door' ? 3000 : 8000)).toISOString(), noop ? new Date(now).toISOString() : null, +noop]);
      this.repo.log(id, 'command_requested', { action, state: noop ? 'already_reported' : 'accepted' }, actor.user_id, commandId, tx);
    });
    this.emitChange();
    if (!noop) {
      if (admit && !admit()) {
        this.repo.write("UPDATE commands SET state='failed',error_code='COMMAND_EXPIRED' WHERE id=?", [commandId]); this.emitChange(); return this.command(commandId);
      }
      const topic = `home/${reg.type}/${id.split('-')[1]}/command`;
      try {
        // QoS 0 plus queueQoSZero:false avoids an unacknowledged MQTT retry
        // delivering an old action after reconnect. Reports establish outcome.
        this.publisher(topic, action, { qos: 0, retain: false }, error => {
          try {
            const c = this.command(commandId); if (!c || terminal.has(c.state)) return;
            this.repo.write('UPDATE commands SET state=?,published_at=?,error_code=? WHERE id=?', [error ? 'uncertain' : 'published', error ? null : new Date(this.now()).toISOString(), error ? 'PUBLISH_UNCERTAIN' : null, commandId]); this.emitChange();
          } catch { this.fault = 'PERSISTENCE_UNAVAILABLE'; this.emitChange(); }
        });
      } catch {
        this.repo.write("UPDATE commands SET state='uncertain',error_code='PUBLISH_UNCERTAIN' WHERE id=?", [commandId]); this.emitChange();
      }
    }
    return this.command(commandId);
  }
  expire(disconnect = false) {
    const rows = this.repo.all("SELECT * FROM commands WHERE state IN ('accepted','published')"); let changed = false;
    for (const c of rows) if (disconnect || Date.parse(c.deadline_at) <= this.now() || !this.boardOnline(byId[c.device_id].board_id)) { this.repo.write("UPDATE commands SET state='uncertain',error_code=? WHERE id=?", [disconnect ? 'CONNECTION_LOST' : 'CONFIRMATION_TIMEOUT', c.id]); changed = true; }
    if (changed) this.emitChange();
  }
  ingest(topic, bytes, packet = {}) {
    if(!this.ingestWindow||this.now()-this.ingestWindow.time>=1000)this.ingestWindow={time:this.now(),count:0};if(++this.ingestWindow.count>100)return false;
    if (typeof topic !== 'string' || bytes.length > 512) return false;
    const str = bytes.toString(); const parts = topic.split('/'); if (parts.length !== 4 || parts[0] !== 'home') return false;
    if (parts[1] === 'esp32' && parts[3] === 'online') {
      if (!this.boards[parts[2]] || !['true', 'false', '1', '0'].includes(str)) return false;
      const alive = str === 'true' || str === '1'; const board = this.boards[parts[2]];
      if (!alive) { board.online = false; this.expire(); }
      else if (!packet.retain) { board.online = true; board.lastSeen = this.now(); }
      this.emitChange(); return true;
    }
    const id = parts[1] + '-' + parts[2]; const reg = byId[id]; if (!reg) return false;
    let status, data = null;
    if (parts[3] === 'status' && ['light', 'door'].includes(reg.type)) {
      if (!(reg.type === 'light' ? ['on', 'off'] : ['locked', 'unlocked', 'denied']).includes(str)) return false;
      status = str;
    } else if (parts[3] === 'data' && reg.type === 'sensor') {
      try { data = JSON.parse(str); } catch { return false; }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
      if (id === 'sensor-gas') {
        if (!Number.isInteger(data.raw) || data.raw < 0 || data.raw > 4095 || !Number.isInteger(data.gas_ppm) || data.gas_ppm < 0 || data.gas_ppm > 1000 || typeof data.alert !== 'boolean') return false;
        status = data.alert ? 'alert' : 'normal';
      } else { if (typeof data.motion !== 'boolean') return false; status = data.motion ? 'detected' : 'clear'; }
    } else if (parts[3] === 'rfid' && id === 'door-1') {
      if (packet.retain) return false;
      try { data = JSON.parse(str); this.onScan(data); return true; } catch { return false; }
    } else return false;
    if (!packet.retain) { this.boards[reg.board_id].online = true; this.boards[reg.board_id].lastSeen = this.now(); }
    if (status === 'denied') { if (!packet.retain) this.repo.log(id, 'access_denied', { authorized: false }); this.emitChange(); return true; }
    const previous = this.observations.get(id);
    const observation = { status, time: this.now(), epoch: this.epoch, retained: !!packet.retain };
    // Retained snapshots are useful history but can never overwrite a live report.
    if (packet.retain && previous && !previous.retained) return true;
    const pending = !packet.retain && this.repo.one("SELECT * FROM commands WHERE device_id=? AND state IN ('accepted','published')", [id]);
    const expected = pending && ({ on: 'on', off: 'off', lock: 'locked', unlock: 'unlocked' })[pending.action];
    const transition = !previous || previous.status !== status;
    const gasFlush = data && id === 'sensor-gas' && (!previous || this.now() - (previous.persistedAt || 0) >= 10000);
    if (transition || pending || gasFlush || !data) {
      this.repo.transaction(tx => {
        tx.run('UPDATE devices SET status=?,last_seen=?,is_online=? WHERE id=?', [status, new Date(this.now()).toISOString(), +!packet.retain, id]);
        tx.run('INSERT OR REPLACE INTO device_observations(device_id,reported_status,received_at,epoch,retained) VALUES(?,?,?,?,?)', [id, status, new Date(this.now()).toISOString(), this.epoch, +!!packet.retain]);
        if (data) tx.run('INSERT OR REPLACE INTO sensor_latest(device_id,payload_json,received_at) VALUES(?,?,?)', [id, JSON.stringify(data), new Date(this.now()).toISOString()]);
        if (transition && !packet.retain) this.repo.log(id, reg.type === 'sensor' ? 'sensor_data' : 'status_change', { status }, null, null, tx);
        if (pending && expected === status && Date.parse(pending.deadline_at) > this.now()) {
          tx.run("UPDATE commands SET state='observed',observed_at=? WHERE id=?", [new Date(this.now()).toISOString(), pending.id]);
          this.repo.log(id, 'command_observed', { action: pending.action, status, physical_verified: false }, pending.actor_id, pending.id, tx);
        }
        if (!packet.retain && id === 'sensor-gas') this.sensorAlert(id, status === 'alert', 'gas', 'critical', tx);
        if (!packet.retain && id === 'sensor-motion') this.sensorAlert(id, status === 'detected', 'motion', 'info', tx);
      }); observation.persistedAt = this.now();
    } else observation.persistedAt = previous.persistedAt;
    this.observations.set(id, observation); this.emitChange(); return true;
  }
  sensorAlert(id, active, kind, severity, tx) {
    const existing = tx.one("SELECT * FROM alerts WHERE device_id=? AND state='active'", [id]); const time = new Date(this.now()).toISOString();
    if (active && !existing) { const alertId = crypto.randomUUID(); tx.run('INSERT INTO alerts(id,device_id,kind,severity,state,opened_at,last_seen_at) VALUES(?,?,?,?,?,?,?)', [alertId, id, kind, severity, 'active', time, time]); this.repo.log(id, 'alert_opened', { kind }, null, null, tx); }
    else if (active && existing) tx.run('UPDATE alerts SET last_seen_at=?,version=version+1 WHERE id=?', [time, existing.id]);
    else if (existing) tx.run("UPDATE alerts SET state='resolved',resolved_at=?,last_seen_at=?,version=version+1 WHERE id=?", [time, time, existing.id]);
  }
  onScan(data) {
    const uid = require('../lib/errors').uid(data.uid); const last = this.scanTimes.get(uid);
    if (last !== undefined && this.now() - last < 2000) return;
    this.scanTimes.set(uid, this.now()); if (this.scanTimes.size > 1000) this.scanTimes.clear();
    this.boards.door.online = true; this.boards.door.lastSeen = this.now();
    const card = this.repo.one('SELECT * FROM rfid_cards WHERE uid=?', [uid]); const allowed = !!(card?.is_authorized && this.allowDoor && this.repo.healthy());
    this.repo.log('door-1', 'rfid_scan', { authorized: allowed, uid });
    if (allowed) this.request('door-1', { action: 'unlock', idempotency_key: crypto.randomUUID() }, { user_id: 'rfid:door-1', role: 'resident' }, 'rfid');
    else if (this.publisher && this.connected) this.publisher('home/door/1/command', 'deny', { qos: 0, retain: false }, () => {});
    this.emitChange();
  }
}
module.exports = { Home, defaults };
