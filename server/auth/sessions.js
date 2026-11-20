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
  constructor(repo, { now = Date.now, secure = true, gateway = null, fetchImpl = fetch } = {}) { this.repo = repo; this.now = now; this.secure = secure; this.gateway = gateway; this.fetchImpl = fetchImpl; this.failures = new Map(); this.lastTouches = new Map(); this.busy = 0; }
  async addUser({ username, password, display_name, role = 'owner', can_unlock = false, minimumPasswordLength = 12 }) {
    if (!['owner', 'resident', 'viewer'].includes(role)) fail('INVALID_ROLE');
    const user = { id: crypto.randomUUID(), username: text(username).toLowerCase(), display_name: text(display_name || username), role, can_unlock: role !== 'viewer' && !!can_unlock };
    const encoded = await passwordHash(password, { minimumLength: minimumPasswordLength });
    this.repo.transaction(tx => {
      tx.run('INSERT INTO users(id,username,display_name,password_hash,role,can_unlock,created_at) VALUES(?,?,?,?,?,?,?)', [user.id, user.username, user.display_name, encoded, role, +user.can_unlock, new Date(this.now()).toISOString()]);
      this.repo.log(null, 'user_created', { role }, user.id, null, tx);
    }); return user;
  }
  async check(password, encoded) { if (this.busy >= 2) fail('AUTH_BUSY', 429); this.busy++; try { return await verify(password, encoded); } finally { this.busy--; } }
  async login(username, password, ip) {
    if (this.gateway) return this.loginCloud(username, password, ip);
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
  async loginCloud(username, password, ip) {
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 64 || password.length > 256) fail('INVALID_LOGIN', 401);
    const key = `${ip}:${username.toLowerCase()}`;
    const record = this.failures.get(key);
    if (record && record.until > this.now() && record.count >= 5) fail('RATE_LIMITED', 429);
    let response;
    try {
      response = await this.fetchImpl(this.gateway.origin + '/api/gateway/auth/login', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
        headers: { Authorization: 'Bearer ' + this.gateway.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } catch { fail('CLOUD_LOGIN_UNAVAILABLE', 503); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.failures.set(key, { count: record && record.until > this.now() ? record.count + 1 : 1, until: this.now() + 900000 });
        fail('INVALID_LOGIN', 401);
      }
      fail('CLOUD_LOGIN_UNAVAILABLE', 503);
    }
    let identity;
    try { identity = await response.json(); } catch { fail('CLOUD_LOGIN_UNAVAILABLE', 503); }
    if (!identity || identity.household_id !== this.gateway.householdId || !/^[a-f0-9-]{36}$/.test(identity.user_id) || !['owner','resident','viewer'].includes(identity.role) || typeof identity.username !== 'string' || identity.username !== username.trim().toLowerCase() || typeof identity.display_name !== 'string' || identity.display_name.length > 80) fail('CLOUD_LOGIN_UNAVAILABLE', 503);
    this.failures.delete(key);
    const userId = 'cloud:' + identity.user_id;
    const localName = 'cloud:' + identity.username;
    const existing = this.repo.one('SELECT id FROM users WHERE id=?', [userId]);
    if (!existing) {
      const encoded = await passwordHash(crypto.randomBytes(32).toString('hex'));
      this.repo.write('INSERT INTO users(id,username,display_name,password_hash,role,can_unlock,created_at) VALUES(?,?,?,?,?,?,?)', [userId, localName, identity.display_name, encoded, identity.role, +(identity.role !== 'viewer'), new Date(this.now()).toISOString()]);
    } else this.repo.write('UPDATE users SET username=?,display_name=?,role=?,can_unlock=?,disabled=0 WHERE id=?', [localName, identity.display_name, identity.role, +(identity.role !== 'viewer'), userId]);
    const now = this.now(), token = crypto.randomBytes(32).toString('hex');
    this.repo.write('INSERT INTO sessions(token_hash,user_id,created_at,expires_at,last_active_at,reauth_at) VALUES(?,?,?,?,?,?)', [hash(token), userId, now, now + 28800000, now, 0]);
    return { token, ...this.get(token) };
  }
  async importGatewayActor(identity) {
    if (!this.gateway || identity?.role !== 'owner' || !/^[a-f0-9-]{36}$/.test(identity.user_id || '') || typeof identity.username !== 'string' || typeof identity.display_name !== 'string') fail('FORBIDDEN',403);
    const id='cloud:'+identity.user_id;
    if(!this.repo.one('SELECT id FROM users WHERE id=?',[id])){
      const encoded=await passwordHash(crypto.randomBytes(32).toString('hex'));
      this.repo.write('INSERT INTO users(id,username,display_name,password_hash,role,can_unlock,created_at) VALUES(?,?,?,?,?,?,?)',[id,'cloud:'+identity.username,identity.display_name,encoded,'owner',0,new Date(this.now()).toISOString()]);
    } else this.repo.write('UPDATE users SET role=?,display_name=?,disabled=0 WHERE id=?',['owner',identity.display_name,id]);
    const now=this.now(),token=crypto.randomBytes(32).toString('hex'),reauth=Date.parse(identity.reauth_at||'');
    this.repo.write('INSERT INTO sessions(token_hash,user_id,created_at,expires_at,last_active_at,reauth_at) VALUES(?,?,?,?,?,?)',[hash(token),id,now,now+30000,now,Number.isFinite(reauth)?reauth:0]);
    return {token,...this.get(token)};
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
    if (this.gateway && session.user_id.startsWith('cloud:')) {
      const identity = await this.loginCloudReauth(session, password);
      if (!identity) fail('INVALID_LOGIN', 401);
      const next = crypto.randomBytes(32).toString('hex');
      this.repo.transaction(({ run }) => { run('DELETE FROM sessions WHERE token_hash=?', [hash(token)]); run('INSERT INTO sessions(token_hash,user_id,created_at,expires_at,last_active_at,reauth_at) VALUES(?,?,?,?,?,?)', [hash(next), session.user_id, session.created_at, session.expires_at, this.now(), this.now()]); });
      return { token: next, ...this.get(next) };
    }
    const user = this.repo.one('SELECT password_hash FROM users WHERE id=?', [session.user_id]);
    const key = 'reauth:' + session.user_id; const record = this.failures.get(key);
    if (record && record.until > this.now() && record.count >= 5) fail('RATE_LIMITED', 429);
    if (!await this.check(password, user.password_hash)) { this.failures.set(key, { count: record && record.until > this.now() ? record.count + 1 : 1, until: this.now() + 900000 }); fail('INVALID_LOGIN', 401); }
    this.failures.delete(key); const next = crypto.randomBytes(32).toString('hex');
    this.repo.transaction(({ run }) => { run('DELETE FROM sessions WHERE token_hash=?', [hash(token)]); run('INSERT INTO sessions(token_hash,user_id,created_at,expires_at,last_active_at,reauth_at) VALUES(?,?,?,?,?,?)', [hash(next), session.user_id, session.created_at, session.expires_at, this.now(), this.now()]); });
    return { token: next, ...this.get(next) };
  }
  async loginCloudReauth(session, password) {
    const username = this.repo.one('SELECT username FROM users WHERE id=?', [session.user_id]);
    if (!username) return false;
    // Cloud account names are not stored as local passwords; validate against the cloud identity.
    return this.verifyCloudPassword(session.user_id.slice(6), username.username.slice(6), password);
  }
  async verifyCloudPassword(userId, username, password) {
    let response;
    try { response = await this.fetchImpl(this.gateway.origin + '/api/gateway/auth/reauth', { method:'POST', redirect:'error', signal: AbortSignal.timeout(5000), headers:{ Authorization:'Bearer '+this.gateway.token, 'Content-Type':'application/json' }, body:JSON.stringify({ user_id:userId, username, password }) }); } catch { fail('CLOUD_LOGIN_UNAVAILABLE', 503); }
    if (response.status === 401 || response.status === 403) return false;
    if (!response.ok) fail('CLOUD_LOGIN_UNAVAILABLE', 503);
    const result = await response.json();
    return result.user_id === userId && result.household_id === this.gateway.householdId;
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
