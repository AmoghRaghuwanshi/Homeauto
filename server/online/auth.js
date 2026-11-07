const crypto = require("crypto");
const {
  passwordHash,
  verifyPassword,
  secureEqual,
  hash,
} = require("../auth/sessions");
const { text } = require("../lib/errors");
const { fail, scoped } = require("./db");
const fn = async (pool, name, args = []) => {
  const { rows } = await pool.query(
    `SELECT homeauto_online.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) AS value`,
    args,
  );
  return rows[0]?.value;
};
function createCloudAuth(pool, { secure = true } = {}) {
  let busy = 0;
  const cookieName = secure ? "__Host-homeauto-cloud" : "homeauto-cloud-dev";
  const cookie = (token, expired = false) =>
    `${cookieName}=${expired ? "" : token}; Path=/; HttpOnly; SameSite=Strict; ${secure ? "Secure; " : ""}Max-Age=${expired ? 0 : 28800}`;
  const readToken = (req) => {
    const raw = (req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(cookieName + "="));
    const token = raw?.slice(cookieName.length + 1);
    return /^[a-f0-9]{64}$/.test(token || "") ? token : null;
  };
  async function rate(bucket, limit = 90, seconds = 60) {
    if (!(await fn(pool, "take_limit", [hash(bucket), limit, seconds])))
      fail("RATE_LIMITED", 429);
  }
  async function actor(token) {
    if (!token) return null;
    const value = await fn(pool, "session_actor", [hash(token)]);
    return value
      ? { ...value, token_hash: hash(token), csrf_token: hash("csrf:" + token) }
      : null;
  }
  const dto = (a) => ({
    user: {
      id: a.user_id,
      display_name: a.display_name,
      role: a.role,
      can_unlock: false,
    },
    household_id: a.household_id,
    csrf_token: a.csrf_token,
    expires_at: new Date(a.expires_at).toISOString(),
    reauth_until: a.reauth_at
      ? new Date(Date.parse(a.reauth_at) + 300000).toISOString()
      : null,
  });
  async function check(password, encoded) {
    if (busy >= 2) fail("AUTH_BUSY", 429);
    busy++;
    try {
      return await verifyPassword(password, encoded);
    } finally {
      busy--;
    }
  }
  return {
    cookieName,
    cookie,
    readToken,
    actor,
    dto,
    rate,
    async register(username, displayName, password, ip) {
      if (typeof username !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username.trim().toLowerCase()))
        fail('INVALID_USERNAME', 400);
      username = username.trim().toLowerCase();
      displayName = text(displayName, 80);
      if (typeof password !== 'string' || password.length < 12 || password.length > 256)
        fail('PASSWORD_LENGTH', 400);
      try {
        await rate('signup-ip:' + ip, 5, 3600);
        await rate('signup-global', 50, 3600);
      } catch (error) {
        if (error.code === 'RATE_LIMITED') fail('SIGNUP_RATE_LIMITED', 429);
        throw error;
      }
      if (busy >= 2) fail('AUTH_BUSY', 429);
      busy++;
      try {
        const encoded = await passwordHash(password);
        let created;
        try {
          created = await fn(pool, 'register_user', [crypto.randomUUID(), crypto.randomUUID(), username, displayName, encoded]);
        } catch (error) {
          if (error.code === '42883') fail('SIGNUP_UNAVAILABLE', 503);
          throw error;
        }
        if (!created) fail('USERNAME_TAKEN', 409);
        return { created: true, username };
      } finally { busy--; }
    },
    async login(username, password, ip) {
      username = text(username).toLowerCase();
      await rate("login-ip:" + ip, 20, 900);
      await rate("login-user:" + ip + ":" + username, 5, 900);
      const user = await fn(pool, "login_user", [username]);
      const dummy = "scrypt:32768:8:1:homeauto-cloud-dummy:" + "0".repeat(128);
      const valid = await check(password, user?.password_hash || dummy);
      if (!user || user.disabled || !valid) {
        await fn(pool, "log_auth", [
          user?.user_id || null,
          "login_failed",
          false,
        ]);
        fail("INVALID_LOGIN", 401);
      }
      const homes = await fn(pool, "user_households", [user.user_id]);
      if (!homes?.length) fail("NO_HOUSEHOLD_ACCESS", 403);
      const token = crypto.randomBytes(32).toString("hex"),
        created = new Date(),
        expires = new Date(created.getTime() + 28800000);
      const issued = await fn(pool, "issue_session", [
        user.user_id,
        homes[0].household_id,
        hash(token),
        created,
        expires,
        null,
        user.password_hash,
      ]);
      if (!issued) fail("INVALID_LOGIN", 401);
      await fn(pool, "log_auth", [user.user_id, "login", true]);
      return { token, session: await actor(token) };
    },
    async reauth(a, token, password) {
      await rate("reauth:" + a.user_id, 5, 900);
      const user = await fn(pool, "login_user", [a.username]);
      if (!user || !(await check(password, user.password_hash)))
        fail("INVALID_LOGIN", 401);
      const next = crypto.randomBytes(32).toString("hex");
      if (
        !(await fn(pool, "rotate_session", [
          hash(token),
          hash(next),
          a.household_id,
          true,
          user.password_hash,
        ]))
      )
        fail("LOGIN_REQUIRED", 401);
      return { token: next, session: await actor(next) };
    },
    async logout(token) {
      await fn(pool, "revoke_session", [hash(token)]);
    },
    async touch(token) {
      await fn(pool, "touch_session", [hash(token)]);
    },
    async gateway(token) {
      if (!/^[a-f0-9]{64}$/.test(token || "")) return null;
      return fn(pool, "gateway_actor", [hash(token)]);
    },
    async households(a) {
      return fn(pool, "user_households", [a.user_id]);
    },
    async switchHousehold(a, token, id) {
      const homes = await fn(pool, "user_households", [a.user_id]);
      if (!homes.some((h) => h.household_id === id)) fail("FORBIDDEN", 403);
      const next = crypto.randomBytes(32).toString("hex");
      if (
        !(await fn(pool, "rotate_session", [
          hash(token),
          hash(next),
          id,
          false,
          null,
        ]))
      )
        fail("LOGIN_REQUIRED", 401);
      return { token: next, session: await actor(next) };
    },
  };
}
module.exports = {
  createCloudAuth,
  fn,
  passwordHash,
  secureEqual,
  hash,
  scoped,
};
