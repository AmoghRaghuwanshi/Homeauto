const express = require('express'); const crypto = require('crypto');
const { SyncError, MAX_BYTES } = require('./protocol');
const { identity } = require('./config');
function createCloudApp({ store, hubs, now = Date.now }) {
  if (!store || !Array.isArray(hubs) || !hubs.length || hubs.length > 1000) throw new Error('Explicit cloud store and enrolled hub registry required.');
  const enrolled = hubs.map(hub => {
    identity({ ...hub, consent: 'catalog-v1' });
    if (!/^[a-f0-9]{64}$/.test(hub.token || '')) throw new Error('Hub tokens must be 32-byte lowercase hex values.');
    return { householdId: hub.householdId, hubId: hub.hubId, digest: crypto.createHash('sha256').update(hub.token).digest() };
  });
  if (new Set(enrolled.map(h => h.digest.toString('hex'))).size !== enrolled.length || new Set(enrolled.map(h => h.householdId)).size !== enrolled.length) throw new Error('Hub credentials and household enrollments must be unique.');
  const app = express(); app.disable('x-powered-by'); const counts = new Map();
  app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); next(); });
  app.get('/health/live', (req, res) => res.json({ status: 'ok' }));
  app.use((req, res, next) => {
    if (req.headers.origin) return res.status(403).json({ error: { code: 'BROWSER_ORIGIN_FORBIDDEN', retryable: false } });
    const auth = req.headers.authorization;
    const digest = crypto.createHash('sha256').update(typeof auth === 'string' && /^Bearer [a-f0-9]{64}$/.test(auth) ? auth.slice(7) : '').digest();
    const hub = enrolled.find(h => crypto.timingSafeEqual(h.digest, digest));
    if (!hub) return res.status(401).json({ error: { code: 'HUB_AUTH_REQUIRED', retryable: false } });
    req.scope = { householdId: hub.householdId, hubId: hub.hubId };
    const current = counts.get(hub.hubId), entry = current?.until > now() ? current : { until: now() + 60000, count: 0 };
    counts.set(hub.hubId, entry); if (++entry.count > 60) return res.set('Retry-After', '60').status(429).json({ error: { code: 'RATE_LIMITED', retryable: true } });
    next();
  });
  app.use(express.json({ limit: MAX_BYTES, strict: true }));
  const route = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
  app.post('/v1/sync/catalog', route(async (req, res) => {
    if (!req.is('application/json')) throw new SyncError('JSON_REQUIRED', 415);
    res.json(await store.ingest(req.scope, req.body));
  }));
  app.get('/v1/sync/catalog', route(async (req, res) => res.json({ metadata: await store.read(req.scope) })));
  app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', retryable: false } }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error instanceof SyncError ? error.status : error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 503;
    res.status(status).json({ error: { code: error instanceof SyncError ? error.code : status === 413 ? 'BODY_TOO_LARGE' : status === 400 ? 'INVALID_JSON' : 'CLOUD_UNAVAILABLE', retryable: status >= 500 } });
  });
  return app;
}
module.exports = { createCloudApp };
