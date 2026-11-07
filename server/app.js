const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { DomainError, fail, fields, text, uid, version, uuid } = require('./lib/errors');
const { authorize, secureEqual } = require('./auth/sessions');
const { byId } = require('./lib/registry');
const { defaults } = require('./services/home');

function createApp({ repo, home, sessions, assistant, speech, config = {}, cloudStatus = () => ({ enabled: false, state: 'disabled' }) }) {
  if (!repo || !home || !sessions || !assistant || !speech) throw new Error('Explicit application dependencies required');
  const app = express(); app.disable('x-powered-by'); app.set('query parser', 'simple');
  const allowedHosts = new Set(config.ALLOWED_HOSTS || ['localhost', '127.0.0.1', '[::1]']);
  function boundary(req) {
    if (typeof req.headers.host !== 'string' || !/^[A-Za-z0-9.\-:\[\]]+$/.test(req.headers.host)) fail('INVALID_HOST', 403);
    let parsed; try { parsed = new URL('http://' + req.headers.host); } catch { fail('INVALID_HOST', 403); }
    if (!allowedHosts.has(parsed.hostname) || parsed.username || parsed.password) fail('INVALID_HOST', 403);
    if (req.headers.origin) {
      let origin; try { origin = new URL(req.headers.origin); } catch { fail('INVALID_ORIGIN', 403); }
      if (origin.origin !== `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`) fail('INVALID_ORIGIN', 403);
    }
  }
  app.locals.boundary = boundary;
  app.use((req, res, next) => {
    req.requestId = crypto.randomUUID(); res.setHeader('X-Request-Id', req.requestId);
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self';script-src 'self';style-src 'self';connect-src 'self';img-src 'self' data:;font-src 'self';media-src 'self' blob:;object-src 'none';base-uri 'self';frame-ancestors 'none';form-action 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Permissions-Policy', 'microphone=(self),camera=(),geolocation=()');
    try { boundary(req); next(); } catch (e) { next(e); }
  });
  app.use(express.json({ limit: '16kb', strict: true }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
  app.get('/api/runtime', (req, res) => res.json({ mode: 'local', transport: 'websocket' }));
  const asyncRoute = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
  const sessionDTO = s => ({ user: s.user, csrf_token: s.csrf_token, expires_at: new Date(s.expires_at).toISOString(), reauth_until: s.reauth_at ? new Date(s.reauth_at + 300000).toISOString() : null });
  function mutation(req) { if (!req.headers.origin) fail('ORIGIN_REQUIRED', 403); if (!req.is('application/json')) fail('JSON_REQUIRED', 415); }
  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    mutation(req); fields(req.body, ['username', 'password'], ['username', 'password']);
    const result = await sessions.login(req.body.username, req.body.password, req.socket.remoteAddress);
    res.setHeader('Set-Cookie', sessions.cookie(result.token)); res.json(sessionDTO(result));
  }));
  app.get('/api/auth/setup-status', (req, res) => {
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    res.json({ setup_required: !repo.one('SELECT id FROM users LIMIT 1') });
  });
  const counts = new Map();
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const { token, session } = sessions.readRequest(req); authorize(session, 'read'); req.actor = session; req.token = token;
      if (!['GET', 'HEAD'].includes(req.method)) {
        mutation(req); if (!secureEqual(req.headers['x-csrf-token'], session.csrf_token)) fail('INVALID_CSRF', 403);
        const now = home.now(); const r = counts.get(session.user_id); const entry = r && r.until > now ? r : { count: 0, until: now + 60000 }; entry.count++;
        counts.set(session.user_id, entry); if (entry.count > 90) fail('RATE_LIMITED', 429);
      }
      next();
    } catch (e) { next(e); }
  });
  app.get('/api/auth/session', (req, res) => res.json(sessionDTO(req.actor)));
  app.post('/api/auth/activity', (req, res) => { fields(req.body, []); if (!sessions.touch(req.token)) fail('LOGIN_REQUIRED', 401); res.json({ success: true }); });
  app.post('/api/auth/logout', (req, res) => { sessions.logout(req.token); home.emit('revoke', req.actor.token_hash); res.setHeader('Set-Cookie', sessions.cookie('', true)); res.json({ success: true }); });
  app.post('/api/auth/reauth', asyncRoute(async (req, res) => { fields(req.body, ['password'], ['password']); const result = await sessions.reauth(req.actor, req.token, req.body.password); home.emit('revoke', req.actor.token_hash); res.setHeader('Set-Cookie', sessions.cookie(result.token)); res.json({ ...sessionDTO(result), reauth_until: new Date(result.reauth_at + 300000).toISOString() }); }));
  app.get('/api/snapshot', (req, res) => res.json(home.snapshot(req.actor, speech.readiness())));
  app.get('/api/devices', (req, res) => res.json(home.snapshot(req.actor).devices));
  app.get('/api/devices/:id', (req, res) => { const d = home.device(req.params.id); if (!d) fail('NOT_FOUND', 404); res.json(d); });
  app.post('/api/devices', (req, res) => { authorize(req.actor, 'owner'); fail('PROVISIONING_UNSUPPORTED', 422); });
  app.delete('/api/devices/:id', (req, res) => { authorize(req.actor, 'owner'); if (!byId[req.params.id]) fail('NOT_FOUND', 404); fail('FIXED_HARDWARE_DEVICE', 409); });
  app.put('/api/devices/:id', (req, res) => {
    authorize(req.actor, 'owner'); fields(req.body, ['name', 'room_id', 'version'], ['version']);
    const d = home.device(req.params.id); if (!d) fail('NOT_FOUND', 404); version(req.body.version, d.version);
    const room = repo.one('SELECT * FROM rooms WHERE id=?', [req.body.room_id || d.room_id]); if (!room) fail('ROOM_NOT_FOUND', 404);
    const name = req.body.name === undefined ? d.name : text(req.body.name);
    repo.transaction(tx => { tx.run('UPDATE devices SET name=?,room_id=?,location=?,version=version+1 WHERE id=?', [name, room.id, room.name, d.id]); repo.log(d.id, 'device_updated', { name, room: room.name }, req.actor.user_id, null, tx); }); home.emitChange(); res.json(home.device(d.id));
  });
  app.post('/api/devices/:id/command', (req, res) => { fields(req.body, ['action', 'idempotency_key', 'confirmation_id'], ['action', 'idempotency_key']); const command = home.request(req.params.id, req.body, req.actor); res.status(command.already_reported ? 200 : 202).json({ command }); });
  app.get('/api/commands/:id', (req, res) => { const command = home.command(req.params.id); if (!command || command.actor_id !== req.actor.user_id && req.actor.role !== 'owner') fail('NOT_FOUND', 404); res.json({ command }); });
  app.post('/api/security/unlock-challenges', (req, res) => { fields(req.body, ['device_id'], ['device_id']); if (req.body.device_id !== 'door-1') fail('NOT_FOUND', 404); res.status(201).json(home.challenge(req.actor)); });
  app.get('/api/rooms', (req, res) => res.json(home.rooms()));
  app.post('/api/rooms', (req, res) => {
    authorize(req.actor, 'owner'); fields(req.body, ['name', 'cover_key', 'idempotency_key'], ['name', 'idempotency_key']); if (!uuid(req.body.idempotency_key)) fail('INVALID_IDEMPOTENCY_KEY');
    if (req.body.cover_key) fail('UNSUPPORTED_COVER', 422);
    const name = text(req.body.name, 60); const key = name.toLowerCase(); const fingerprint = JSON.stringify({ name });
    const old = repo.one("SELECT * FROM idempotency_records WHERE scope='room' AND actor_id=? AND key=?", [req.actor.user_id, req.body.idempotency_key]);
    if (old) { if (old.request_hash !== fingerprint) fail('IDEMPOTENCY_CONFLICT', 409); return res.status(201).json(JSON.parse(old.response_json)); }
    if (repo.one('SELECT id FROM rooms WHERE name_key=?', [key]) || repo.one('SELECT alias FROM room_aliases WHERE alias=?', [key])) fail('ROOM_NAME_CONFLICT', 409);
    const room = { id: crypto.randomUUID(), name, cover_key: null, sort_order: home.rooms().length, version: 1 };
    repo.transaction(({ run }) => { run('INSERT INTO rooms(id,name,name_key,sort_order) VALUES(?,?,?,?)', [room.id, name, key, room.sort_order]); run('INSERT INTO idempotency_records(scope,actor_id,key,request_hash,response_json,expires_at) VALUES(?,?,?,?,?,?)', ['room', req.actor.user_id, req.body.idempotency_key, fingerprint, JSON.stringify(room), home.now() + 86400000]); }); home.emitChange(); res.status(201).json(room);
  });
  app.put('/api/rooms/:id', (req, res) => {
    authorize(req.actor, 'owner'); fields(req.body, ['name', 'cover_key', 'sort_order', 'version'], ['version']); const room = repo.one('SELECT * FROM rooms WHERE id=?', [req.params.id]); if (!room) fail('NOT_FOUND', 404); version(req.body.version, room.version);
    const name = req.body.name === undefined ? room.name : text(req.body.name, 60);
    if (req.body.cover_key || req.body.sort_order !== undefined && (!Number.isInteger(req.body.sort_order) || req.body.sort_order < 0)) fail('VALIDATION_ERROR');
    if (repo.one('SELECT id FROM rooms WHERE name_key=? AND id<>?', [name.toLowerCase(), room.id]) || repo.one('SELECT alias FROM room_aliases WHERE alias=? AND room_id<>?', [name.toLowerCase(), room.id])) fail('ROOM_NAME_CONFLICT', 409);
    repo.transaction(({ run }) => { run('UPDATE rooms SET name=?,name_key=?,sort_order=?,version=version+1 WHERE id=?', [name, name.toLowerCase(), req.body.sort_order ?? room.sort_order, room.id]); run('UPDATE devices SET location=?,version=version+1 WHERE room_id=?', [name, room.id]); }); home.emitChange(); res.json(repo.one('SELECT * FROM rooms WHERE id=?', [room.id]));
  });
  app.delete('/api/rooms/:id', (req, res) => { authorize(req.actor, 'owner'); if (!repo.one('SELECT id FROM rooms WHERE id=?', [req.params.id])) fail('NOT_FOUND', 404); if (repo.one('SELECT id FROM devices WHERE room_id=?', [req.params.id])) fail('ROOM_NOT_EMPTY', 409); repo.transaction(({ run }) => { run('DELETE FROM room_aliases WHERE room_id=?', [req.params.id]); run('DELETE FROM rooms WHERE id=?', [req.params.id]); }); home.emitChange(); res.json({ success: true }); });
  app.get('/api/preferences', (req, res) => res.json(home.preferences(req.actor)));
  app.put('/api/preferences', (req, res) => {
    fields(req.body, [...Object.keys(defaults), 'version'], ['version']); const old = home.preferences(req.actor); version(req.body.version, old.version); const value = { ...old, ...req.body }; delete value.version;
    if (!Array.isArray(value.favorites) || value.favorites.length > 7 || value.favorites.some(id => !byId[id]) || new Set(value.favorites).size !== value.favorites.length) fail('VALIDATION_ERROR');
    for (const k of ['input_language', 'reply_language']) if (!['auto', 'en', 'hi'].includes(value[k])) fail('VALIDATION_ERROR');
    if (typeof value.spoken_replies !== 'boolean' || typeof value.voice_rate !== 'number' || value.voice_rate < .8 || value.voice_rate > 1.2 || !Array.isArray(value.notification_categories) || value.notification_categories.some(k => !['gas', 'motion', 'access_denied', 'device'].includes(k))) fail('VALIDATION_ERROR');
    repo.write('INSERT OR REPLACE INTO user_preferences(user_id,value_json,version) VALUES(?,?,?)', [req.actor.user_id, JSON.stringify(value), old.version + 1]); home.emitChange(); res.json(home.preferences(req.actor));
  });
  app.get('/api/settings/home', (req, res) => res.json(home.homeSettings()));
  app.put('/api/settings/home', (req, res) => { authorize(req.actor, 'owner'); fields(req.body, ['home_name', 'version'], ['home_name', 'version']); version(req.body.version, home.homeSettings().version); repo.write("UPDATE home_settings SET value_json=?,version=version+1 WHERE key='home_name'", [JSON.stringify(text(req.body.home_name, 60))]); home.emitChange(); res.json(home.homeSettings()); });
  app.get('/api/logs/rfid-cards', (req, res) => { authorize(req.actor, 'owner'); res.json(repo.all('SELECT * FROM rfid_cards ORDER BY created_at DESC')); });
  app.post('/api/logs/rfid-cards', (req, res) => {
    authorize(req.actor, 'sensitive', home.now()); fields(req.body, ['uid', 'owner_name', 'is_authorized'], ['uid', 'owner_name', 'is_authorized']); const cardUid = uid(req.body.uid); const name = text(req.body.owner_name);
    if (typeof req.body.is_authorized !== 'boolean') fail('VALIDATION_ERROR'); if (repo.one('SELECT uid FROM rfid_cards WHERE uid=?', [cardUid])) fail('CARD_EXISTS', 409);
    repo.transaction(tx => { tx.run('INSERT INTO rfid_cards(uid,owner_name,is_authorized) VALUES(?,?,?)', [cardUid, name, +req.body.is_authorized]); repo.log('door-1', 'rfid_card_added', { uid: cardUid, owner_name: name }, req.actor.user_id, null, tx); }); home.emitChange(); res.status(201).json(repo.one('SELECT * FROM rfid_cards WHERE uid=?', [cardUid]));
  });
  app.put('/api/logs/rfid-cards/:uid', (req, res) => {
    authorize(req.actor, 'sensitive', home.now()); fields(req.body, ['owner_name', 'is_authorized', 'version'], ['version']); const cardUid = uid(req.params.uid); const card = repo.one('SELECT * FROM rfid_cards WHERE uid=?', [cardUid]); if (!card) fail('NOT_FOUND', 404); version(req.body.version, card.version);
    const name = req.body.owner_name === undefined ? card.owner_name : text(req.body.owner_name); if (req.body.is_authorized !== undefined && typeof req.body.is_authorized !== 'boolean') fail('VALIDATION_ERROR');
    repo.transaction(tx => { tx.run('UPDATE rfid_cards SET owner_name=?,is_authorized=?,version=version+1 WHERE uid=?', [name, req.body.is_authorized === undefined ? card.is_authorized : +req.body.is_authorized, cardUid]); repo.log('door-1', 'rfid_card_updated', { uid: cardUid, authorized: req.body.is_authorized ?? !!card.is_authorized }, req.actor.user_id, null, tx); }); home.emitChange(); res.json(repo.one('SELECT * FROM rfid_cards WHERE uid=?', [cardUid]));
  });
  app.delete('/api/logs/rfid-cards/:uid', (req, res) => { authorize(req.actor, 'sensitive', home.now()); const cardUid = uid(req.params.uid); if (!repo.one('SELECT uid FROM rfid_cards WHERE uid=?', [cardUid])) fail('NOT_FOUND', 404); repo.transaction(tx => { tx.run('DELETE FROM rfid_cards WHERE uid=?', [cardUid]); repo.log('door-1', 'rfid_card_removed', { uid: cardUid }, req.actor.user_id, null, tx); }); home.emitChange(); res.json({ success: true }); });
  function activity(req) {
    const q = req.query; const limit = q.limit === undefined ? 30 : Number(q.limit); if (!Number.isInteger(limit) || limit < 1 || limit > 100) fail('INVALID_LIMIT');
    const where = [], args = []; const category = q.category || 'all'; if (!['all', 'doors', 'lights', 'sensors', 'system'].includes(category)) fail('INVALID_CATEGORY');
    if (category !== 'all') { where.push(category === 'system' ? 'device_id IS NULL' : 'device_id LIKE ?'); if (category !== 'system') args.push(({ doors: 'door-%', lights: 'light-%', sensors: 'sensor-%' })[category]); }
    if (q.device_id) { if (!byId[q.device_id]) fail('NOT_FOUND', 404); where.push('device_id=?'); args.push(q.device_id); }
    if (q.type) { where.push('event_type=?'); args.push(text(q.type, 60)); }
    if (q.cursor) { if (!/^\d+$/.test(q.cursor)) fail('INVALID_CURSOR'); where.push('id<?'); args.push(Number(q.cursor)); }
    for (const k of ['from', 'to']) if (q[k]) { if (!Number.isFinite(Date.parse(q[k]))) fail('INVALID_DATE'); where.push(`datetime(timestamp) ${k === 'from' ? '>=' : '<='} datetime(?)`); args.push(q[k]); }
    if (q.from && q.to && Date.parse(q.from) > Date.parse(q.to)) fail('INVALID_DATE');
    if (q.q) { const value = text(q.q, 100); where.push('(event_type LIKE ? OR device_id LIKE ?)'); args.push('%' + value + '%', '%' + value + '%'); }
    const rows = repo.all(`SELECT * FROM activity_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`, [...args, limit + 1]);
    const next = rows.length > limit ? String(rows[limit - 1].id) : null;
    return { items: rows.slice(0, limit).map(row => { let details; try { details = JSON.parse(row.details); } catch {} if(!details||typeof details!=='object'||Array.isArray(details))details={}; if (req.actor.role !== 'owner') { delete details.uid; delete details.owner_name; delete details.owner; delete details.transcript; } return { ...row, details, summary_key: row.event_type }; }), next_cursor: next };
  }
  app.get('/api/activity', (req, res) => res.json(activity(req)));
  app.get('/api/logs', (req, res) => res.json(activity(req).items));
  app.get('/api/alerts', (req, res) => { const state = req.query.state || 'all'; if (!['active', 'resolved', 'all'].includes(state)) fail('VALIDATION_ERROR'); res.json({ items: home.alerts(req.actor).filter(a => state === 'all' || a.state === state), next_cursor: null }); });
  for (const action of ['read', 'acknowledge']) app.post(`/api/alerts/:id/${action}`, (req, res) => {
    if (action === 'acknowledge') authorize(req.actor, 'control'); if (!repo.one('SELECT id FROM alerts WHERE id=?', [req.params.id])) fail('NOT_FOUND', 404);
    repo.transaction(({ run }) => { run('INSERT OR IGNORE INTO alert_receipts(alert_id,user_id) VALUES(?,?)', [req.params.id, req.actor.user_id]); run(`UPDATE alert_receipts SET ${action === 'read' ? 'read_at' : 'acknowledged_at'}=COALESCE(${action === 'read' ? 'read_at' : 'acknowledged_at'},?) WHERE alert_id=? AND user_id=?`, [new Date(home.now()).toISOString(), req.params.id, req.actor.user_id]); }); home.emitChange(); res.json({ receipt: repo.one('SELECT read_at,acknowledged_at FROM alert_receipts WHERE alert_id=? AND user_id=?', [req.params.id, req.actor.user_id]) });
  });
  app.post('/api/assistant/interpret', (req, res) => { fields(req.body, ['text', 'language'], ['text']); if (req.body.language && !['auto', 'hi', 'en'].includes(req.body.language)) fail('VALIDATION_ERROR'); res.json(assistant.interpret(text(req.body.text, 500), req.actor)); });
  app.post('/api/assistant/execute', (req, res) => { fields(req.body, ['intent_id', 'idempotency_key'], ['intent_id', 'idempotency_key']); const result = assistant.execute(req.body.intent_id, req.body.idempotency_key, req.actor); res.status(result.answer ? 200 : 202).json(result); });
  app.post('/api/assistant/voice-tickets', (req, res) => res.status(201).json(speech.ticket(req.actor)));
  app.post('/api/assistant/speech', asyncRoute(async (req, res) => {
    fields(req.body, ['result_id', 'test_phrase', 'language', 'voice_id'], ['language']); if (!['en', 'hi'].includes(req.body.language) || !!req.body.result_id === !!req.body.test_phrase || req.body.test_phrase && req.body.test_phrase !== 'voice_check') fail('VALIDATION_ERROR');
    const value = req.body.test_phrase ? req.body.language === 'hi' ? 'नमस्ते। मैं श्रीमान हूँ। आपकी आवाज़ यहीं घर पर संसाधित होती है।' : 'Hello. I am Shrimaan. Your voice is processed here at home.' : assistant.speechText(req.body.result_id, req.actor, req.body.language);
    res.status(202).json(await speech.synthesize(value, req.body.language, req.actor));
  }));
  app.get('/api/assistant/speech/:id', (req, res) => res.json(speech.job(req.params.id, req.actor)));
  app.get('/api/assistant/audio/:id', (req, res) => { res.type('wav').send(speech.audio(req.params.id, req.actor)); });
  app.get('/api/ai/models', (req, res) => { authorize(req.actor, 'owner'); res.json({ assets: speech.assets() }); });
  app.post('/api/ai/models/:id/activate', asyncRoute(async (req, res) => { authorize(req.actor, 'sensitive', home.now()); res.json(await speech.activate(req.params.id)); }));
  app.get('/api/system', (req, res) => { authorize(req.actor, 'owner'); res.json({ version: require('./package.json').version, broker: { connected: home.connected, enabled: !!config.MQTT_ENABLED }, boards: home.snapshot(req.actor).espBoards, database: { healthy: repo.healthy(), schema_version: 5 }, speech: speech.readiness(), door_enabled: home.allowDoor, simulation: home.simulation, cloud_sync: cloudStatus(), resources: { scope: 'local_hub', uptime_seconds: Math.floor(process.uptime()), rss_bytes: process.memoryUsage().rss } }); });
  app.use('/api', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found', retryable: false }, request_id: req.requestId }));
  // Available only in the explicit in-memory simulator, never production.
  if (home.simulation) app.get('/__qa/axe.js', (req, res) => res.sendFile(require.resolve('axe-core')));
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: 0, index: false }));
  app.get('*', (req, res) => { if (path.extname(req.path)) return res.sendStatus(404); res.sendFile(path.join(__dirname, '..', 'public', 'index.html')); });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const known = error instanceof DomainError; const status = known ? error.status : error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
    if (status === 429) res.setHeader('Retry-After', '60');
    res.status(status).json({ error: { code: known ? error.code : status === 413 ? 'BODY_TOO_LARGE' : status === 400 ? 'INVALID_JSON' : 'INTERNAL_ERROR', message: known ? error.message : 'The request could not be completed.', retryable: status >= 500, fields: known ? error.fields : {} }, request_id: req.requestId });
  });
  return app;
}
module.exports = { createApp };
