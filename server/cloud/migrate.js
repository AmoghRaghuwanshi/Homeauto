const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const filename = path.join(__dirname, 'migrations', '001_catalog.sql');
const migrationSQL = () => fs.readFileSync(filename, 'utf8');
async function migrate(pool) {
  const sql = migrationSQL(), checksum = crypto.createHash('sha256').update(sql).digest('hex');
  const client = await pool.connect(); let broken = false;
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(787431901)");
    await client.query('CREATE TABLE IF NOT EXISTS public.homeauto_cloud_migrations(version integer PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
    const previous = await client.query('SELECT checksum FROM public.homeauto_cloud_migrations WHERE version=1');
    if (previous.rows.length && previous.rows[0].checksum !== checksum) throw new Error('Migration checksum mismatch; use a new migration.');
    if (!previous.rows.length) { await client.query(sql); await client.query('INSERT INTO public.homeauto_cloud_migrations(version,checksum) VALUES(1,$1)', [checksum]); }
    await client.query('COMMIT'); return { version: 1, checksum, applied: !previous.rows.length };
  } catch (error) { try { await client.query('ROLLBACK'); } catch { broken = true; } throw error; }
  finally { client.release(broken); }
}
// No role creation or credentials in source. A DBA creates the LOGIN role separately.
function grantSQL(role) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(role)) throw new Error('Invalid runtime role name');
  return `GRANT USAGE ON SCHEMA homeauto_cloud TO "${role}";
GRANT SELECT ON homeauto_cloud.households,homeauto_cloud.hubs TO "${role}";
GRANT SELECT,INSERT,UPDATE ON homeauto_cloud.catalogs TO "${role}";
GRANT SELECT,INSERT ON homeauto_cloud.receipts TO "${role}";`;
}
module.exports = { migrate, migrationSQL, grantSQL };
