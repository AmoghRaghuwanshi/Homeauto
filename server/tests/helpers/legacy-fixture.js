const initSqlJs = require('sql.js');
const {devices} = require('../../lib/registry');
// Reconstruct the documented version0 shape with synthetic rows, never household data.
async function legacyBytes() {
  const SQL=await initSqlJs();const db=new SQL.Database();
  try {
    db.run(`CREATE TABLE devices(id TEXT PRIMARY KEY,name TEXT NOT NULL,type TEXT NOT NULL,location TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'off',is_online INTEGER NOT NULL DEFAULT 0,last_seen TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE rfid_cards(uid TEXT PRIMARY KEY,owner_name TEXT NOT NULL,is_authorized INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE activity_log(id INTEGER PRIMARY KEY AUTOINCREMENT,timestamp TEXT NOT NULL DEFAULT (datetime('now')),device_id TEXT,event_type TEXT NOT NULL,details TEXT);`);
    for(const device of devices)db.run('INSERT INTO devices(id,name,type,location,status) VALUES(?,?,?,?,?)',[device.id,device.name,device.type,device.location,device.status]);
    for(let i=0;i<44;i++)db.run('INSERT INTO activity_log(timestamp,device_id,event_type,details) VALUES(?,?,?,?)',['2001-01-01T00:00:00.000Z',devices[i%devices.length].id,'synthetic_legacy',JSON.stringify({synthetic_fixture:i})]);
    return Buffer.from(db.export());
  } finally {db.close();}
}
module.exports={legacyBytes};
