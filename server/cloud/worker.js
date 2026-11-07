const { endpoint } = require('./config');
const { validateOperation } = require('./protocol');
const { acknowledge } = require('./journal');
function syncStatus(repo, enabled) {
  if (!enabled) return { enabled: false, state: 'disabled' };
  const row = repo.one('SELECT revision,attempts,next_attempt_at,blocked,last_error FROM cloud_outbox LIMIT 1');
  const last = repo.one('SELECT revision,status,acknowledged_at FROM cloud_inbox ORDER BY revision DESC LIMIT 1');
  const capture = repo.one('SELECT capture_error FROM cloud_sync_state WHERE singleton=1');
  return { enabled: true, state: capture?.capture_error || row?.blocked ? 'blocked' : row ? 'pending' : 'idle', pending_revision: row?.revision || null, attempts: row?.attempts || 0, next_attempt_at: row?.next_attempt_at || null, last_error: capture?.capture_error || row?.last_error || null, last_acknowledgment: last || null };
}
async function boundedJSON(response) {
  if (Number(response.headers.get('content-length')) > 2048) throw new Error('Invalid acknowledgment');
  const reader = response.body?.getReader(); if (!reader) throw new Error('Invalid acknowledgment');
  const parts = []; let bytes = 0;
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 2048) throw new Error('Invalid acknowledgment'); parts.push(Buffer.from(value)); } }
  finally { await reader.cancel().catch(() => {}); }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
function createSyncWorker(repo, config, { fetchImpl = fetch, now = Date.now, random = Math.random } = {}) {
  const origin = endpoint(config.origin); let busy = false, stopped = false, timer, controller;
  async function runOnce() {
    if (busy || stopped) return { state: 'skipped' };
    const row = repo.one('SELECT * FROM cloud_outbox LIMIT 1');
    if (row && !row.blocked && row.next_attempt_at > now() + 360000) {
      repo.write('UPDATE cloud_outbox SET next_attempt_at=? WHERE operation_id=?', [now() + 300000, row.operation_id]);
      return { state: 'idle' };
    }
    if (!row || row.blocked || row.next_attempt_at > now()) return { state: row?.blocked ? 'blocked' : 'idle' };
    busy = true; let permanent = false, errorCode = 'CLOUD_UNAVAILABLE';
    controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 5000); timeout.unref();
    try {
      let op;
      try { op = validateOperation(JSON.parse(row.operation_json)); }
      catch { permanent = true; errorCode = 'INVALID_LOCAL_CATALOG'; throw new Error(errorCode); }
      if (op.household_id !== config.householdId || op.hub_id !== config.hubId) { permanent = true; errorCode = 'JOURNAL_SCOPE_MISMATCH'; throw new Error(errorCode); }
      const response = await fetchImpl(origin + '/v1/sync/catalog', { method: 'POST', redirect: 'error', signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.token }, body: row.operation_json });
      if (!response.ok) { permanent = response.status >= 400 && response.status < 500 && ![408, 425, 429].includes(response.status); errorCode = permanent ? 'CLOUD_REJECTED' : 'CLOUD_UNAVAILABLE'; await response.body?.cancel(); throw new Error(errorCode); }
      const ack = await boundedJSON(response);
      if (ack.status === 'stale' && repo.one('SELECT operation_id FROM cloud_outbox LIMIT 1')?.operation_id === op.operation_id) { permanent = true; errorCode = 'CLOUD_AHEAD'; throw new Error(errorCode); }
      acknowledge(repo, op, ack, now()); return { state: 'acknowledged' };
    } catch {
      if (stopped) return { state: 'stopped' };
      const delay = Math.min(300000, 1000 * 2 ** Math.min(row.attempts, 9) * (.8 + .4 * random()));
      repo.write('UPDATE cloud_outbox SET attempts=attempts+1,next_attempt_at=?,blocked=?,last_error=? WHERE operation_id=?', [now() + Math.round(delay), +permanent, errorCode, row.operation_id]);
      return { state: permanent ? 'blocked' : 'retry' };
    } finally { clearTimeout(timeout); busy = false; controller = null; }
  }
  async function tick() {
    try { await runOnce(); } catch { /* Repository health exposes local persistence failures. */ }
    if (!stopped) { timer = setTimeout(tick, 10000); timer.unref(); }
  }
  return { runOnce, start() { if (!timer && !stopped) { timer = setTimeout(tick, 0); timer.unref(); } },
    stop() { stopped = true; clearTimeout(timer); controller?.abort(); }, status: () => syncStatus(repo, true) };
}
module.exports = { createSyncWorker, syncStatus, boundedJSON };
