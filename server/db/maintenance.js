const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
function dailyBackup(repo, now = Date.now()) {
  if (repo.filename === ':memory:') return null;
  const folder = path.join(path.dirname(repo.filename), 'backups'); fs.mkdirSync(folder, { recursive: true });
  const target = path.join(folder, 'homeauto-' + new Date(now).toISOString().slice(0, 10) + '.db');
  if (!fs.existsSync(target)) {
    fs.copyFileSync(repo.filename, target, fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(target + '.sha256', crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'), { mode: 0o600 });
  }
  // Only names generated here are eligible for rotation, within this folder.
  const files = fs.readdirSync(folder).filter(n => /^homeauto-\d{4}-\d{2}-\d{2}\.db$/.test(n)).sort().reverse();
  for (const name of files.slice(7)) { fs.unlinkSync(path.join(folder, name)); const hash = path.join(folder, name + '.sha256'); if (fs.existsSync(hash)) fs.unlinkSync(hash); }
  return target;
}
function maintain(repo, now = Date.now()) {
  dailyBackup(repo, now); // Never prune before a durable backup succeeds.
  const day = new Date(now - 86400000).toISOString(); const ninetyDays = new Date(now - 90 * 86400000).toISOString();
  const legacy = Number(JSON.parse(repo.one("SELECT value_json FROM home_settings WHERE key='legacy_activity_max_id'")?.value_json || '0'));
  repo.transaction(({ run }) => {
    run('DELETE FROM sessions WHERE expires_at<=? OR last_active_at<=?', [now, now - 1800000]);
    run('DELETE FROM unlock_challenges WHERE expires_at<=? OR consumed_at IS NOT NULL', [now]);
    run('DELETE FROM idempotency_records WHERE expires_at<=?', [now]);
    run("DELETE FROM commands WHERE state NOT IN ('accepted','published') AND requested_at<?", [day]);
    run('DELETE FROM activity_log WHERE id>? AND julianday(timestamp)<julianday(?)', [legacy, ninetyDays]);
    run("DELETE FROM alert_receipts WHERE alert_id IN (SELECT id FROM alerts WHERE state='resolved' AND resolved_at<?)", [ninetyDays]);
    run("DELETE FROM alerts WHERE state='resolved' AND resolved_at<?", [ninetyDays]);
  });
}
module.exports = { maintain, dailyBackup };
