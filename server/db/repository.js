const fs = require('fs');
const path = require('path');
const { devices } = require('../lib/registry');

// Transactions are synchronous: no other writer can interleave an export.
// A failed durable export restores memory as well as preserving the old file.
async function createRepository({ filename = ':memory:', io = fs, sync = null, gateway = null } = {}) {
  if (sync && gateway) throw new Error('Use one cloud transport per local repository.');
  const journal = sync ? require('../cloud/journal').createMetadataJournal(sync) : null;
  const SQL = await require('sql.js')();
  let release = () => {};
  let healthy = true;
  if (filename !== ':memory:') {
    io.mkdirSync(path.dirname(filename), { recursive: true });
    const lock = filename + '.lock';
    if (io.existsSync(lock)) {
      const pid = Number(io.readFileSync(lock, 'utf8'));
      let live = true;
      try { process.kill(pid, 0); } catch (e) { if (e.code === 'ESRCH') live = false; }
      if (live || !Number.isInteger(pid) || pid <= 0) throw new Error('Database locked; inspect the local writer before recovery.');
      io.unlinkSync(lock);
    }
    const fd = io.openSync(lock, 'wx', 0o600);
    io.writeFileSync(fd, String(process.pid)); io.closeSync(fd);
    release = () => { if (io.existsSync(lock)) io.unlinkSync(lock); };
  }
  let db;
  try { db = new SQL.Database(filename !== ':memory:' && io.existsSync(filename) ? io.readFileSync(filename) : undefined); }
  catch (error) { release(); throw error; }
  let closed = false;
  function all(sql, args = []) {
    const stmt = db.prepare(sql);
    try { stmt.bind(args); const rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); return rows; }
    finally { stmt.free(); }
  }
  const one = (sql, args = []) => all(sql, args)[0] || null;
  function persist() {
    if (filename === ':memory:') return;
    const temp = filename + '.tmp'; let fd;
    try {
      fd = io.openSync(temp, 'w', 0o600);
      io.writeFileSync(fd, Buffer.from(db.export())); io.fsyncSync(fd); io.closeSync(fd); fd = undefined;
      if (io.existsSync(filename)) io.copyFileSync(filename, filename + '.bak');
      io.renameSync(temp, filename);
    } finally { if (fd !== undefined) io.closeSync(fd); if (io.existsSync(temp)) io.unlinkSync(temp); }
  }
  function transaction(fn) {
    if (closed) throw new Error('Database closed');
    if (!healthy) throw new Error('Database persistence unavailable; inspect storage before restart');
    const before = db.export();
    try {
      db.run('BEGIN IMMEDIATE');
      const tx = { all, one, run: (sql, args = []) => args.length ? db.run(sql, args) : db.run(sql) };
      const result = fn(tx);
      if (result && typeof result.then === 'function') throw new Error('Database transaction callbacks must be synchronous');
      journal?.capture(tx);
      db.run('COMMIT'); persist(); return result;
    } catch (error) {
      try { db.run('ROLLBACK'); } catch {}
      db.close(); db = new SQL.Database(before); db.run('PRAGMA foreign_keys=ON');
      if (error.code && /ENOSPC|EACCES|EPERM|EIO/.test(error.code)) healthy = false;
      throw error;
    }
  }
  try {
    const previousVersion = Number(one('PRAGMA user_version')?.user_version);
    if (previousVersion > 5) throw new Error('Database schema is newer than this application; use a matching version.');
    if (filename !== ':memory:' && io.existsSync(filename) && !io.existsSync(filename + '.pre-v5.bak')) io.copyFileSync(filename, filename + '.pre-v5.bak');
    db.run('PRAGMA foreign_keys=ON');
    transaction(tx => {
      const { run } = tx;
      run(`CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,name TEXT NOT NULL,type TEXT NOT NULL,location TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'off',is_online INTEGER NOT NULL DEFAULT 0,last_seen TEXT,created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS rfid_cards(uid TEXT PRIMARY KEY,owner_name TEXT NOT NULL,is_authorized INTEGER NOT NULL DEFAULT 1,created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS activity_log(id INTEGER PRIMARY KEY AUTOINCREMENT,timestamp TEXT DEFAULT (datetime('now')),device_id TEXT,event_type TEXT NOT NULL,details TEXT);
      CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY,name TEXT NOT NULL,name_key TEXT UNIQUE,cover_key TEXT,sort_order INTEGER DEFAULT 0,version INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,display_name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('owner','resident','viewer')),can_unlock INTEGER NOT NULL DEFAULT 0,disabled INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,last_active_at INTEGER NOT NULL,reauth_at INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY,device_id TEXT NOT NULL,actor_id TEXT NOT NULL,source TEXT NOT NULL,action TEXT NOT NULL,state TEXT NOT NULL,idempotency_key TEXT NOT NULL,request_hash TEXT NOT NULL,requested_at TEXT NOT NULL,deadline_at TEXT NOT NULL,published_at TEXT,observed_at TEXT,error_code TEXT,already_reported INTEGER DEFAULT 0,UNIQUE(actor_id,idempotency_key));
      CREATE TABLE IF NOT EXISTS device_observations(device_id TEXT PRIMARY KEY,reported_status TEXT,received_at TEXT,epoch TEXT,retained INTEGER,version INTEGER DEFAULT 1);
      CREATE TABLE IF NOT EXISTS unlock_challenges(token_hash TEXT PRIMARY KEY,session_hash TEXT NOT NULL,device_id TEXT NOT NULL,expires_at INTEGER NOT NULL,consumed_at INTEGER);
      CREATE TABLE IF NOT EXISTS home_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,version INTEGER DEFAULT 1);
      CREATE TABLE IF NOT EXISTS user_preferences(user_id TEXT PRIMARY KEY REFERENCES users(id),value_json TEXT NOT NULL,version INTEGER DEFAULT 1);
      CREATE TABLE IF NOT EXISTS alerts(id TEXT PRIMARY KEY,device_id TEXT,kind TEXT NOT NULL,severity TEXT NOT NULL,state TEXT NOT NULL,opened_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,resolved_at TEXT,version INTEGER DEFAULT 1);
      CREATE TABLE IF NOT EXISTS alert_receipts(alert_id TEXT NOT NULL REFERENCES alerts(id),user_id TEXT NOT NULL REFERENCES users(id),read_at TEXT,acknowledged_at TEXT,PRIMARY KEY(alert_id,user_id));
      CREATE TABLE IF NOT EXISTS sensor_latest(device_id TEXT PRIMARY KEY,payload_json TEXT NOT NULL,received_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS model_assets(id TEXT PRIMARY KEY,provider TEXT,version TEXT,path_key TEXT,sha256 TEXT,bytes INTEGER,license_ref TEXT,verified_at TEXT,enabled INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS room_aliases(alias TEXT,language TEXT,room_id TEXT REFERENCES rooms(id),confirmed INTEGER DEFAULT 0,UNIQUE(alias,language));
      CREATE TABLE IF NOT EXISTS idempotency_records(scope TEXT,actor_id TEXT,key TEXT,request_hash TEXT,response_json TEXT,expires_at INTEGER,PRIMARY KEY(scope,actor_id,key));
      CREATE INDEX IF NOT EXISTS activity_device_idx ON activity_log(device_id,id);
      CREATE INDEX IF NOT EXISTS commands_state_idx ON commands(state);`);
      const add = (table, column, definition) => { if (!all(`PRAGMA table_info(${table})`).some(c => c.name === column)) run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); };
      add('devices', 'room_id', 'TEXT REFERENCES rooms(id)'); add('devices', 'version', 'INTEGER NOT NULL DEFAULT 1');
      add('rfid_cards', 'version', 'INTEGER NOT NULL DEFAULT 1');
      for (const column of ['actor_id', 'command_id', 'source']) add('activity_log', column, 'TEXT');
      const locations = new Map(devices.map(d => [d.location, d.room_id]));
      for (const d of all('SELECT location FROM devices')) if (!locations.has(d.location)) locations.set(d.location, 'room-' + require('crypto').createHash('sha256').update(d.location).digest('hex').slice(0, 10));
      if (previousVersion < 5) for (const [name, id] of locations) run('INSERT OR IGNORE INTO rooms(id,name,name_key) VALUES(?,?,?)', [id, name || 'Unassigned', (name || 'Unassigned').normalize('NFC').toLowerCase()]);
      for (const d of devices) run('INSERT OR IGNORE INTO devices(id,name,type,location,status,room_id) VALUES(?,?,?,?,?,?)', [d.id, d.name, d.type, d.location, d.status, d.room_id]);
      for (const [name, id] of locations) run('UPDATE devices SET room_id=? WHERE location=? AND room_id IS NULL', [id, name]);
      run('INSERT OR IGNORE INTO home_settings(key,value_json) VALUES(?,?)', ['home_name', JSON.stringify('My home')]);
      run('INSERT OR IGNORE INTO home_settings(key,value_json) VALUES(?,?)', ['legacy_activity_max_id', JSON.stringify(one('SELECT COALESCE(MAX(id),0) AS n FROM activity_log').n)]);
      run("UPDATE commands SET state='uncertain',error_code='SERVER_RESTARTED' WHERE state IN ('accepted','published')");
      run('DELETE FROM sessions'); run('DELETE FROM unlock_challenges'); run('PRAGMA user_version=5');
      journal?.initialize(tx);
      if (gateway) require('../online/gateway').initializeGatewayJournal(tx, gateway);
    });
  } catch (error) { db.close(); release(); throw error; }
  return {
    all, one, transaction,
    write: (sql, args = []) => transaction(({ run }) => run(sql, args)),
    getDevices: () => all('SELECT * FROM devices ORDER BY type,location,id'),
    getDevice: id => one('SELECT * FROM devices WHERE id=?', [id]),
    log(deviceId, eventType, details, actorId = null, commandId = null, tx = null) {
      const insert = ({ run, one: read }) => {
        run('INSERT INTO activity_log(timestamp,device_id,event_type,details,actor_id,command_id) VALUES(?,?,?,?,?,?)', [new Date().toISOString(), deviceId, eventType, JSON.stringify(details), actorId, commandId]);
        return read('SELECT * FROM activity_log ORDER BY id DESC LIMIT 1');
      };
      return tx ? insert(tx) : transaction(insert);
    },
    healthy: () => healthy, filename,
    close() { if (!closed) { closed = true; db.close(); release(); } },
  };
}
module.exports = { createRepository };
