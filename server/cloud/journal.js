const crypto = require('crypto');
const { identity } = require('./config');
const { projectCatalog, hash, canonical, validateOperation, SyncError } = require('./protocol');
// This hook runs inside the existing local transaction, before its durable export.
// Whole catalogs coalesce safely: they contain no actions or hardware reports.
function createMetadataJournal(config) {
  const scope = identity(config); let ready = false;
  return {
    initialize(tx) {
      tx.run(`CREATE TABLE IF NOT EXISTS cloud_sync_state(singleton INTEGER PRIMARY KEY CHECK(singleton=1),schema_version INTEGER NOT NULL CHECK(schema_version=1),household_id TEXT NOT NULL,hub_id TEXT NOT NULL,consent TEXT NOT NULL,last_revision INTEGER NOT NULL DEFAULT 0,catalog_hash TEXT,capture_error TEXT);
      CREATE TABLE IF NOT EXISTS cloud_outbox(operation_id TEXT PRIMARY KEY,revision INTEGER NOT NULL UNIQUE,operation_json TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at INTEGER NOT NULL DEFAULT 0,blocked INTEGER NOT NULL DEFAULT 0,last_error TEXT);
      CREATE TABLE IF NOT EXISTS cloud_inbox(operation_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,digest TEXT NOT NULL,status TEXT NOT NULL,acknowledged_at INTEGER NOT NULL);`);
      tx.run('INSERT OR IGNORE INTO cloud_sync_state(singleton,schema_version,household_id,hub_id,consent) VALUES(1,1,?,?,?)', [scope.householdId, scope.hubId, scope.consent]);
      const row = tx.one('SELECT * FROM cloud_sync_state WHERE singleton=1');
      if (row.schema_version !== 1 || row.household_id !== scope.householdId || row.hub_id !== scope.hubId || row.consent !== scope.consent) throw new Error('Cloud identity does not match this local journal; operator recovery is required.');
      ready = true;
    },
    capture(tx) {
      if (!ready) return;
      let catalog;
      try { catalog = projectCatalog(tx); } catch (error) {
        if (!(error instanceof SyncError) && !(error instanceof SyntaxError)) throw error;
        tx.run('UPDATE cloud_sync_state SET catalog_hash=NULL,capture_error=? WHERE singleton=1', [error.code || 'INVALID_CATALOG']);
        tx.run('DELETE FROM cloud_outbox'); return;
      }
      const catalogHash = hash(catalog);
      const row = tx.one('SELECT * FROM cloud_sync_state WHERE singleton=1');
      if (row.catalog_hash === catalogHash) return;
      const body = { schema_version: 1, household_id: scope.householdId, hub_id: scope.hubId, operation_id: crypto.randomUUID(), revision: row.last_revision + 1, catalog };
      const operation = validateOperation({ ...body, digest: hash(body) });
      tx.run('INSERT INTO cloud_outbox(operation_id,revision,operation_json) VALUES(?,?,?)', [operation.operation_id, operation.revision, canonical(operation)]);
      tx.run('DELETE FROM cloud_outbox WHERE operation_id<>?', [operation.operation_id]);
      tx.run('UPDATE cloud_sync_state SET last_revision=?,catalog_hash=?,capture_error=NULL WHERE singleton=1', [operation.revision, catalogHash]);
    },
  };
}
function acknowledge(repo, operation, ack, now) {
  if (!ack || ack.operation_id !== operation.operation_id || ack.revision !== operation.revision || ack.digest !== operation.digest || !['accepted', 'stale'].includes(ack.status)) throw new Error('Invalid cloud acknowledgment');
  repo.transaction(({ run }) => {
    run('INSERT OR IGNORE INTO cloud_inbox(operation_id,revision,digest,status,acknowledged_at) VALUES(?,?,?,?,?)', [operation.operation_id, operation.revision, operation.digest, ack.status, now]);
    // An old in-flight ack must not delete the replacement catalog.
    run('DELETE FROM cloud_outbox WHERE operation_id=?', [operation.operation_id]);
    run('DELETE FROM cloud_inbox WHERE operation_id NOT IN (SELECT operation_id FROM cloud_inbox ORDER BY revision DESC LIMIT 100)');
  });
}
module.exports = { createMetadataJournal, acknowledge };
