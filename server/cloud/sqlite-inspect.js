const fs = require('fs'); const crypto = require('crypto');
const { devices, byId } = require('../lib/registry');
const { canonical, hash, validateCatalog } = require('./protocol');
const booleanFields = new Set(['is_online','is_authorized','can_unlock','disabled','retained','already_reported','enabled','confirmed','blocked']);
const epochFields = new Set(['expires_at','last_active_at','reauth_at','consumed_at','next_attempt_at','acknowledged_at']);
const timestampFields = new Set(['timestamp','last_seen','created_at','requested_at','deadline_at','published_at','observed_at','received_at','opened_at','last_seen_at','resolved_at','read_at','verified_at']);
function normalizeTimestamp(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return new Date(value).toISOString();
  if (typeof value !== 'string') throw new Error('Invalid timestamp');
  const normalized = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(normalized) || !Number.isFinite(Date.parse(normalized))) throw new Error('Invalid timestamp');
  // Date.parse normalizes impossible calendar dates; disallow those too.
  const day = normalized.slice(0,10), [year,month,date] = day.split('-').map(Number);
  if (month < 1 || month > 12 || date < 1 || date > new Date(Date.UTC(year, month, 0)).getUTCDate()) throw new Error('Invalid timestamp');
  return new Date(normalized).toISOString();
}
async function inspectSQLite(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 100 * 1024 * 1024 || bytes.subarray(0,16).toString() !== 'SQLite format 3\0') throw new Error('Invalid or oversized SQLite source');
  const SQL = await require('sql.js')(); const db = new SQL.Database(bytes);
  const all = (sql, args = []) => { const stmt = db.prepare(sql); try { stmt.bind(args); const rows=[]; while(stmt.step())rows.push(stmt.getAsObject()); return rows; } finally { stmt.free(); } };
  try {
    db.run('PRAGMA query_only=ON');
    if (all('PRAGMA integrity_check')[0]?.integrity_check !== 'ok') throw new Error('SQLite integrity failed');
    const schemaVersion = all('PRAGMA user_version')[0].user_version;
    if (![0,5].includes(schemaVersion)) throw new Error('Unsupported source schema; expected version 0 or 5');
    if (all('PRAGMA foreign_key_check').length) throw new Error('SQLite referential integrity failed');
    const names = all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(r=>r.name);
    if (names.some(n => !/^[a-z_][a-z0-9_]*$/.test(n))) throw new Error('Unsupported source table identifier');
    const source = {}, tables = [], issues = [];
    if (schemaVersion === 0 && ['devices','rfid_cards','activity_log'].some(name=>!names.includes(name))) throw new Error('Legacy source schema is incomplete');
    if (schemaVersion === 5) {
      const reference = await require('../db/repository').createRepository();
      try {
        for (const {name} of reference.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")) {
          const actual=new Set(names.includes(name) ? all(`PRAGMA table_info("${name}")`).map(c=>c.name) : []);
          if(reference.all(`PRAGMA table_info("${name}")`).some(column=>!actual.has(column.name))) issues.push({table:name,code:'INCOMPLETE_SOURCE_SCHEMA'});
        }
      } finally { reference.close(); }
    }
    for (const name of names) {
      const rows = all(`SELECT * FROM "${name}"`); source[name] = rows;
      const columns = all(`PRAGMA table_info("${name}")`);
      let booleans = 0, timestamps = 0;
      for (let index=0; index<rows.length; index++) for (const [key,value] of Object.entries(rows[index])) {
        if (value === null) continue;
        if (booleanFields.has(key)) { if (![0,1].includes(value)) issues.push({ table: name, row: index, column: key, code: 'INVALID_BOOLEAN' }); else booleans++; }
        if (epochFields.has(key) || timestampFields.has(key)) {
          try { if (epochFields.has(key) && (!Number.isSafeInteger(value) || value < 0)) throw new Error(); normalizeTimestamp(value); timestamps++; }
          catch { issues.push({ table:name,row:index,column:key,code:'INVALID_TIMESTAMP' }); }
        }
      }
      tables.push({ name, count: rows.length, checksum: hash(rows.map(canonical).sort()), columns: columns.map(({name,type,notnull,pk}) => ({name,type,notnull,pk})), foreign_keys: all(`PRAGMA foreign_key_list("${name}")`), boolean_values_checked: booleans, timestamps_checked: timestamps });
    }
    const ids = source.devices?.map(d => d.id) || [];
    if (ids.length !== 7 || new Set(ids).size !== 7 || ids.some(id => !byId[id])) throw new Error('Source must contain exactly the seven supported hardware IDs');
    const locations = new Map(devices.map(d => [d.location,d.room_id]));
    for (const d of source.devices) if (!locations.has(d.location)) locations.set(d.location, 'room-' + crypto.createHash('sha256').update(d.location).digest('hex').slice(0,10));
    const rooms = schemaVersion === 5 ? source.rooms?.map(({id,name,sort_order,version}) => ({id,name,sort_order,version})) : [...locations].map(([name,id]) => ({ id,name:name || 'Unassigned',sort_order:0,version:1 }));
    const setting = source.home_settings?.find(row => row.key==='home_name');
    const byKey = (a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    const catalog = { home: {name:setting ? JSON.parse(setting.value_json) : 'My home',version:setting?.version || 1}, rooms:rooms?.sort(byKey), devices:source.devices.map(d=>({id:d.id,name:d.name,type:d.type,room_id:schemaVersion===5 ? d.room_id : locations.get(d.location),version:d.version || 1})).sort(byKey) };
    let catalogError = null; try { validateCatalog(catalog); } catch { catalogError='INVALID_CATALOG'; }
    if (catalogError) issues.push({code:catalogError});
    const report = { report_version:1,source_schema_version:schemaVersion,source_bytes:bytes.length,source_sha256:crypto.createHash('sha256').update(bytes).digest('hex'),integrity:'ok',foreign_keys:'ok',tables,issues,catalog_ready:issues.length===0,catalog_checksum:catalogError ? null : hash(catalog),excluded_from_cloud:names.filter(n=>!['rooms','devices','home_settings'].includes(n)),note:'All source rows remain local. Checksums do not authorize upload; only the explicit catalog projection is eligible.' };
    return { report, catalog:report.catalog_ready ? catalog : null };
  } finally { db.close(); }
}
async function inspectFile(filename) {
  const stat = fs.statSync(filename); if (!stat.isFile() || stat.size > 100*1024*1024) throw new Error('Invalid or oversized SQLite source');
  const before=fs.readFileSync(filename), result=await inspectSQLite(before), after=fs.readFileSync(filename);
  if (!before.equals(after)) throw new Error('Source changed during inspection; use a stopped-hub backup');
  return result;
}
module.exports = { inspectSQLite, inspectFile, normalizeTimestamp };
