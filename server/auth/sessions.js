const crypto = require('crypto');
const { promisify } = require('util');
const { fail, text } = require('../lib/errors');
const scrypt = promisify(crypto.scrypt);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const secureEqual = (a, b) => { if(typeof a!=='string'||typeof b!=='string')return false; const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&crypto.timingSafeEqual(left,right); };
async function passwordHash(password, { minimumLength = 12 } = {}) {
  if (!Number.isInteger(minimumLength) || minimumLength < 10 || minimumLength > 256) throw new Error('Invalid password policy');
  if (typeof password !== 'string' || password.length < minimumLength || password.length > 256) fail('PASSWORD_LENGTH');
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  return `scrypt:32768:8:1:${salt}:${key.toString('hex')}`;
}
async function verify(password, encoded) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const [, n, r, p, salt, expected] = encoded.split(':');
  const key = await scrypt(password, salt, 64, { N: +n, r: +r, p: +p, maxmem: 128 * 1024 * 1024 });
  return secureEqual(key.toString('hex'), expected);
}
class Sessions {
  constructor(repo, { now = Date.now, secure = true } = {}) { this.repo = repo; this.now = now; this.secure = secure; this.failures = new Map(); this.lastTouches = new Map(); this.busy = 0; }
  async addUser({ username, password, display_name, role = 'owner', can_unlock = false }) {
    if (!['owner', 'resident', 'viewer'].includes(role)) fail('INVALID_ROLE');
    const user = { id: crypto.randomUUID(), username: text(username).toLowerCase(), display_name: text(display_name || username), role, can_unlock: role !== 'viewer' && !!can_unlock };
    const encoded = await passwordHash(password);
    this.repo.transaction(tx => {
      tx.run('INSERT INTO users(id,username,display_name,password_hash,role,can_unlock,created_at) VALUES(?,?,?,?,?,?,?)', [user.id, user.username, user.display_name, encoded, role, +user.can_unlock, new Date(this.now()).toISOString()]);
      this.repo.log(null, 'user_created', { role }, user.id, null, tx);
    }); return user;
  }
  async check(password, encoded) { if (this.busy >= 2) fail('AUTH_BUSY', 429); this.busy++; try { return await verify(password, encoded); } finally { this.busy--; } }
  async login(username, password, ip) {
    for (const [key, record] of this.failures) if (record.until <= this.now()) this.failures.delete(key);
    username = text(username).toLowerCase(); const key = `${ip}:${username}`; const ipKey = 'ip:' + ip; const now = this.now(); const record = this.failures.get(key); const ipRecord = this.failures.get(ipKey);
    if (record && record.until > now && record.count >= 5 || ipRecord && ipRecord.until > now && ipRecord.count >= 20 || this.failures.size >= 2000) fail('RATE_LIMITED', 429);
    const user = this.repo.one('SELECT * FROM users WHERE username=? AND disabled=0', [username]);
    const dummy = 'scrypt:32768:8:1:homeauto-dummy-salt:' + '0'.repeat(128);
    if (!await this.check(password, user ? user.password_hash : dummy) || !user) {
      this.failures.set(key, { count: record && record.until > now ? record.count + 1 : 1, until: now + 900000 });
      this.failures.set(ipKey, { count: ipRecord && ipRecord.until > now ? ipRecord.count + 1 : 1, until: now + 900000 });
      fail('INVALID_LOGIN', 401);
    }
    this.failures.delete(key); const token = crypto.randomBytes(32).toString('hex');
    this.repo.write('INSERT INTO sessions(token_hash,user_id,created_at,expires_at,last_active_at,reauth_at) VALUES(?,?,?,?,?,?)', [hash(token), user.id, now, now + 28800000, now, 0]);
    return { token, ...this.get(token) };
  }
  get(token) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = this.repo.one('SELECT s.*,u.username,u.display_name,u.role,u.can_unlock,u.disabled FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=?', [hash(token)]);
    if (!row || row.disabled || row.expires_at <= this.now() || row.last_active_at + 1800000 <= this.now()) return null;
    return { ...row, csrf_token: hash('csrf:' + token), user: { id: row.user_id, display_name: row.display_name, role: row.role, can_unlock: !!row.can_unlock } };
  }
  touch(token) {
    const session = this.get(token); if (!session) return null;
    if (session.last_active_at + 60000 <= this.now()) this.repo.write('UPDATE sessions SET last_active_at=? WHERE token_hash=?', [this.now(), session.token_hash]);
    return session;
  }
  readRequest(req) {
    const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(this.cookieName() + '='));
    const token = cookie ? cookie.slice(cookie.indexOf('=') + 1) : null;
    return { token, session: this.get(token) };
  }
  cookieName() { return this.secure ? '__Host-homeauto' : 'homeauto-dev'; }
  cookie(token, expire = false) { return `${this.cookieName()}=${expire ? '' : token}; Path=/; HttpOnly; SameSite=Strict; ${this.secure ? 'Secure; ' : ''}Max-Age=${expire ? 0 : 28800}`; }
  logout(token) { if (token) this.repo.write('DELETE FROM sessions WHERE token_hash=?', [hash(token)]); }
  async reauth(session, token, password) {
    const user = this.repo.one('SELECT password_hash FROM users WHERE id=?', [session.user_id]);
    const key = 'reauth:' + session.user_id; const record = this.failures.get(key);
    if (record && record.until > this.now() && record.count >= 5) fail('RATE_LIMITED', 429);
    if (!await this.check(password, user.password_hash)) { this.failures.set(key, { count: record && record.until > this.now() ? record.count + 1 : 1, until: this.now() + 900000 }); fail('INVALID_LOGIN', 401); }
    this.failures.delete(key); const next = crypto.randomBytes(32).toString('hex');
    this.repo.transaction(({ run }) => { run('DELETE FROM sessions WHERE token_hash=?', [hash(token)]); run('INSERT INTO sessions(token_hash,user_id,created_at,expires_at,last_active_at,reauth_at) VALUES(?,?,?,?,?,?)', [hash(next), session.user_id, session.created_at, session.expires_at, this.now(), this.now()]); });
    return { token: next, ...this.get(next) };
  }
}
function authorize(actor, operation, now = Date.now()) {
  if (!actor) fail('LOGIN_REQUIRED', 401);
  const role = actor.role || actor.user?.role;
  if (operation === 'read' || operation === 'own') return;
  if (['owner', 'sensitive'].includes(operation) && role !== 'owner') fail('FORBIDDEN', 403);
  if (operation === 'control' && !['owner', 'resident'].includes(role)) fail('FORBIDDEN', 403);
  if (operation === 'unlock' && (!['owner', 'resident'].includes(role) || !actor.can_unlock)) fail('FORBIDDEN', 403);
  if (['sensitive', 'unlock'].includes(operation) && (!actor.reauth_at || actor.reauth_at + 300000 <= now)) fail('REAUTH_REQUIRED', 403);
}
module.exports = { Sessions, authorize, hash, secureEqual, passwordHash, verifyPassword: verify };
