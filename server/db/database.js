const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

// Ensure the db directory exists
const dbDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = null;

// Save database to disk periodically
function saveToDisk() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(config.DB_PATH, buffer);
}

// Auto-save every 10 seconds
let saveInterval = null;

async function init() {
  const SQL = await initSqlJs();

  // Load existing database or create new
  if (fs.existsSync(config.DB_PATH)) {
    const fileBuffer = fs.readFileSync(config.DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('[DB] Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('[DB] Created new database');
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS devices (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL,
      location    TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'off',
      is_online   INTEGER NOT NULL DEFAULT 0,
      last_seen   TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS rfid_cards (
      uid           TEXT PRIMARY KEY,
      owner_name    TEXT NOT NULL,
      is_authorized INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
      device_id   TEXT,
      event_type  TEXT NOT NULL,
      details     TEXT
    );
  `);

  saveToDisk();
  saveInterval = setInterval(saveToDisk, 10000);
  return db;
}

// Helper: run a SELECT and return array of row objects
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run a SELECT and return first row object or null
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper: run INSERT/UPDATE/DELETE
function execute(sql, params = []) {
  db.run(sql, params);
  saveToDisk();
}

module.exports = {
  init,

  // --- Devices ---
  getDevices() {
    return queryAll('SELECT * FROM devices ORDER BY type, location');
  },

  getDevice(id) {
    return queryOne('SELECT * FROM devices WHERE id = ?', [id]);
  },

  addDevice(id, name, type, location, status = 'off') {
    try {
      execute('INSERT INTO devices (id, name, type, location, status) VALUES (?, ?, ?, ?, ?)',
        [id, name, type, location, status]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  updateDevice(id, name, type, location) {
    execute('UPDATE devices SET name = ?, type = ?, location = ? WHERE id = ?',
      [name, type, location, id]);
    return { success: true };
  },

  updateDeviceStatus(id, status) {
    execute('UPDATE devices SET status = ?, last_seen = datetime("now"), is_online = 1 WHERE id = ?',
      [status, id]);
    return { success: true };
  },

  setDeviceOnline(id, isOnline) {
    execute('UPDATE devices SET is_online = ?, last_seen = datetime("now") WHERE id = ?',
      [isOnline ? 1 : 0, id]);
    return { success: true };
  },

  deleteDevice(id) {
    const existing = queryOne('SELECT id FROM devices WHERE id = ?', [id]);
    if (!existing) return { success: false };
    execute('DELETE FROM devices WHERE id = ?', [id]);
    return { success: true };
  },

  // --- RFID Cards ---
  getRfidCards() {
    return queryAll('SELECT * FROM rfid_cards ORDER BY created_at DESC');
  },

  getRfidCard(uid) {
    return queryOne('SELECT * FROM rfid_cards WHERE uid = ?', [uid]);
  },

  addRfidCard(uid, ownerName, isAuthorized = true) {
    try {
      execute('INSERT OR REPLACE INTO rfid_cards (uid, owner_name, is_authorized) VALUES (?, ?, ?)',
        [uid, ownerName, isAuthorized ? 1 : 0]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  deleteRfidCard(uid) {
    const existing = queryOne('SELECT uid FROM rfid_cards WHERE uid = ?', [uid]);
    if (!existing) return { success: false };
    execute('DELETE FROM rfid_cards WHERE uid = ?', [uid]);
    return { success: true };
  },

  // --- Activity Log ---
  addLogEntry(deviceId, eventType, details) {
    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
    execute('INSERT INTO activity_log (device_id, event_type, details) VALUES (?, ?, ?)',
      [deviceId, eventType, detailsStr]);
    return { success: true };
  },

  getRecentLogs(limit = 50) {
    return queryAll('SELECT * FROM activity_log ORDER BY id DESC LIMIT ?', [limit]);
  },

  getLogsByType(type, limit = 50) {
    return queryAll('SELECT * FROM activity_log WHERE event_type = ? ORDER BY id DESC LIMIT ?',
      [type, limit]);
  },

  // Seed default devices (INSERT OR IGNORE so new sensors are added to existing DBs)
  seedDefaultDevices() {
    console.log('[DB] Checking default devices...');
    const devices = [
      ['light-1', 'Light 1', 'light', 'Room 1', 'off'],
      ['light-2', 'Light 2', 'light', 'Room 1', 'off'],
      ['light-3', 'Light 3', 'light', 'Room 2', 'off'],
      ['light-4', 'Light 4', 'light', 'Room 2', 'off'],
      ['door-1', 'Front Door', 'door', 'Entrance', 'locked'],
      ['sensor-gas', 'Gas Sensor', 'sensor', 'Kitchen', 'normal'],
      ['sensor-motion', 'Motion Sensor', 'sensor', 'Hallway', 'clear'],
    ];
    let added = 0;
    for (const d of devices) {
      try {
        db.run('INSERT OR IGNORE INTO devices (id, name, type, location, status) VALUES (?, ?, ?, ?, ?)', d);
        added++;
      } catch (e) { /* already exists */ }
    }
    saveToDisk();
    console.log(`[DB] Default devices ready (${devices.length} total).`);
  },

  close() {
    if (saveInterval) clearInterval(saveInterval);
    saveToDisk();
  },
};
