const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const { createRepository } = require('../db/repository'); const { dailyBackup } = require('../db/maintenance'); const { loadConfig } = require('../lifecycle');
async function inspectBackup(file) {
  const bytes = fs.readFileSync(file); if (bytes.length > 100 * 1024 * 1024 || bytes.subarray(0, 16).toString() !== 'SQLite format 3\0') throw new Error('Invalid or oversized SQLite backup');
  const SQL = await require('sql.js')(); const db = new SQL.Database(bytes);
  try {
    if (db.exec('PRAGMA integrity_check')[0]?.values[0]?.[0] !== 'ok') throw new Error('Backup integrity check failed');
    if (Number(db.exec('PRAGMA user_version')[0]?.values[0]?.[0]) > 5) throw new Error('Backup schema is newer than this application');
    const rows = db.exec('SELECT id FROM devices')[0]?.values.flat() || [];
    if (!['light-1','light-2','light-3','light-4','door-1','sensor-gas','sensor-motion'].every(id => rows.includes(id))) throw new Error('Backup hardware registry incomplete');
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex'); const sidecar = file + '.sha256';
    if (fs.existsSync(sidecar) && fs.readFileSync(sidecar, 'utf8').trim() !== sha256) throw new Error('Backup checksum mismatch');
    return { bytes, sha256 };
  } finally { db.close(); }
}
async function restoreBackup(filename, source) {
  if (fs.existsSync(filename + '.lock')) throw new Error('Stop the hub and inspect its database lock before restore');
  if (path.resolve(source) === path.resolve(filename)) throw new Error('Choose a separate backup file');
  const { bytes, sha256 } = await inspectBackup(source);
  // Trial migration and schema validation happen away from the target file.
  const trialDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'homeauto-restore-preflight-'));
  let trial, reference;
  try {
    const trialPath = path.join(trialDir, 'trial.db'); fs.writeFileSync(trialPath, bytes);
    trial = await createRepository({ filename: trialPath }); reference = await createRepository();
    for (const { name } of reference.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")) {
      const actual = new Set(trial.all(`PRAGMA table_info(${name})`).map(column => column.name));
      if (reference.all(`PRAGMA table_info(${name})`).some(column => !actual.has(column.name))) throw new Error('Backup schema incomplete: ' + name);
    }
  } finally { trial?.close(); reference?.close(); fs.rmSync(trialDir, { recursive: true, force: true }); }
  const previous = filename + '.before-restore-' + Date.now() + '.bak'; if (fs.existsSync(filename)) fs.copyFileSync(filename, previous, fs.constants.COPYFILE_EXCL);
  const temp = filename + '.restore.tmp'; fs.writeFileSync(temp, bytes, { flag: 'wx', mode: 0o600 });
  try { fs.renameSync(temp, filename); } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  // Opening invalidates restored sessions/challenges and pending actions.
  const repo = await createRepository({ filename }); try { repo.log(null, 'backup_restored', { sha256 }); } finally { repo.close(); }
  return { sha256, previous };
}
async function main() {
  const [operation, source] = process.argv.slice(2); const { DB_PATH } = loadConfig();
  if (operation === 'inspect' && source) { const r = await inspectBackup(path.resolve(source)); console.log('Backup verified: ' + r.sha256); }
  else if (operation === 'backup') { const repo = await createRepository({ filename: DB_PATH }); try { console.log(dailyBackup(repo)); } finally { repo.close(); } }
  else if (operation === 'restore' && source) console.log(await restoreBackup(DB_PATH, path.resolve(source)));
  else throw new Error('Usage: node scripts/recovery.js backup | inspect FILE | restore FILE (stop hub first)');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { inspectBackup, restoreBackup };
