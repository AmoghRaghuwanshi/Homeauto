const { validateOperation, reject } = require('./protocol');
const { identity } = require('./config');
function poolOptions(connectionString, { allowLoopback = false } = {}) {
  let url; try { url = new URL(connectionString); } catch { throw new Error('A server-side PostgreSQL URL is required.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.pathname.slice(1)) throw new Error('A server-side PostgreSQL URL is required.');
  // Parse individual fields: URL SSL parameters cannot replace verification settings.
  const supported = new Set(['sslmode', 'channel_binding', 'options', 'sslrootcert']);
  if ([...url.searchParams.keys()].some(k => !supported.has(k) || url.searchParams.getAll(k).length !== 1)) throw new Error('Unsupported PostgreSQL URL parameters.');
  const endpointOptions = url.searchParams.get('options');
  if (endpointOptions !== null && !/^endpoint=ep-[a-z0-9-]+$/.test(endpointOptions)) throw new Error('Only Neon endpoint routing is supported in PostgreSQL options.');
  if (url.searchParams.has('sslrootcert') && url.searchParams.get('sslrootcert') !== 'system') throw new Error('Use system trust roots; certificate paths are not read from database URLs.');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  return { host: url.hostname.replace(/^\[|\]$/g, ''), port: Number(url.port || 5432), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: decodeURIComponent(url.pathname.slice(1)),
    ssl: allowLoopback && loopback ? false : { rejectUnauthorized: true }, enableChannelBinding: true, ...(endpointOptions ? { options: endpointOptions } : {}),
    max: 4, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10000, query_timeout: 6000,
    statement_timeout: 5000, idle_in_transaction_session_timeout: 5000, application_name: 'homeauto-catalog' };
}
function createPool(connectionString, options) {
  const { Pool } = require('pg'); const pool = new Pool(poolOptions(connectionString, options));
  // Never let an idle connection error become an unhandled EventEmitter exception.
  pool.on('error', () => {}); return pool;
}
async function assertRuntimeRole(pool) {
  const { rows } = await pool.query(`SELECT r.rolsuper,r.rolbypassrls,
    EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='homeauto_cloud' AND c.relowner=r.oid) AS owns_tables
    FROM pg_roles r WHERE r.rolname=current_user`);
  if (rows.length !== 1 || rows[0].rolsuper || rows[0].rolbypassrls || rows[0].owns_tables) throw new Error('Cloud runtime requires a non-owner role without superuser or RLS bypass.');
  const policies = await pool.query("SELECT count(*)::integer AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='homeauto_cloud' AND c.relname IN ('households','hubs','catalogs','receipts') AND c.relrowsecurity AND c.relforcerowsecurity");
  if (policies.rows[0]?.n !== 4) throw new Error('Cloud schema and forced row-level security must be installed before serving.');
}
function createPostgresCatalog(pool) {
  async function transaction(scope, work) {
    identity({ ...scope, consent: 'catalog-v1' });
    const client = await pool.connect(); let begun = false, broken = false;
    try {
      await client.query('BEGIN'); begun = true;
      await client.query("SELECT set_config('homeauto.household_id',$1,true),set_config('homeauto.hub_id',$2,true),set_config('lock_timeout','1000',true),set_config('statement_timeout','5000',true)", [scope.householdId, scope.hubId]);
      // One enrolled writer per household; serialize uploads, including an empty catalog.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [scope.householdId]);
      const hub = await client.query('SELECT hub_id FROM homeauto_cloud.hubs WHERE household_id=$1 AND hub_id=$2 AND revoked_at IS NULL', [scope.householdId, scope.hubId]);
      if (!hub.rows.length) reject('HUB_NOT_ENROLLED', 403);
      const result = await work(client); await client.query('COMMIT'); return result;
    } catch (error) {
      if (begun) try { await client.query('ROLLBACK'); } catch { broken = true; }
      throw error;
    } finally { client.release(broken); }
  }
  return {
    async ingest(scope, input) {
      const op = validateOperation(input);
      if (op.household_id !== scope.householdId || op.hub_id !== scope.hubId) reject('SYNC_SCOPE_MISMATCH', 403);
      return transaction(scope, async client => {
        const previous = await client.query('SELECT operation_id,revision,digest,status FROM homeauto_cloud.receipts WHERE household_id=$1 AND operation_id=$2', [scope.householdId, op.operation_id]);
        if (previous.rows.length) {
          const receipt = previous.rows[0];
          if (receipt.digest !== op.digest || Number(receipt.revision) !== op.revision) reject('OPERATION_CONFLICT', 409);
          return { ...receipt, revision: Number(receipt.revision) };
        }
        const collision = await client.query('SELECT operation_id FROM homeauto_cloud.receipts WHERE household_id=$1 AND hub_id=$2 AND revision=$3', [scope.householdId, scope.hubId, op.revision]);
        if (collision.rows.length) reject('REVISION_CONFLICT', 409);
        const current = await client.query('SELECT revision FROM homeauto_cloud.catalogs WHERE household_id=$1', [scope.householdId]);
        const status = current.rows.length && Number(current.rows[0].revision) >= op.revision ? 'stale' : 'accepted';
        if (status === 'accepted') await client.query(`INSERT INTO homeauto_cloud.catalogs(household_id,hub_id,revision,catalog) VALUES($1,$2,$3,$4::jsonb)
          ON CONFLICT(household_id) DO UPDATE SET revision=EXCLUDED.revision,catalog=EXCLUDED.catalog,received_at=now()`, [scope.householdId, scope.hubId, op.revision, JSON.stringify(op.catalog)]);
        await client.query('INSERT INTO homeauto_cloud.receipts(household_id,operation_id,hub_id,revision,digest,status) VALUES($1,$2,$3,$4,$5,$6)', [scope.householdId, op.operation_id, scope.hubId, op.revision, op.digest, status]);
        return { operation_id: op.operation_id, revision: op.revision, digest: op.digest, status };
      });
    },
    async read(scope) { return transaction(scope, async client => {
      const { rows } = await client.query('SELECT revision,catalog,received_at FROM homeauto_cloud.catalogs WHERE household_id=$1', [scope.householdId]);
      return rows.length ? { schema_version: 1, source: 'cloud_metadata', revision: Number(rows[0].revision), catalog: rows[0].catalog, received_at: rows[0].received_at } : null;
    }); },
  };
}
module.exports = { poolOptions, createPool, assertRuntimeRole, createPostgresCatalog };
