const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { onlineFixture } = require('./helpers/online-fixture');
const { createCloudAuth, fn, passwordHash } = require('../online/auth');
const { scoped, assertOnlineRole } = require('../online/db');
const { createOnlineApp } = require('../online/app');

test('self-service registration preserves private household and credential boundaries', async t => {
  const f = await onlineFixture(); t.after(() => f.close());
  const auth = createCloudAuth(f.pool, { secure: false });
  const password = 'a long synthetic signup password';
  const count = () => f.admin(async db => (await db.query('SELECT (SELECT count(*)::int FROM homeauto_online.users) users,(SELECT count(*)::int FROM homeauto_online.households) homes')).rows[0]);
  await t.test('new account gets a new isolated home, hashed password and working sign-in', async () => {
    const before = await count();
    assert.deepEqual(await auth.register('  New.Owner  ', 'नया उपयोगकर्ता', password, 'registration-one'), { created: true, username: 'new.owner' });
    const login = await auth.login('new.owner', password, 'registration-login');
    assert.equal(login.session.role, 'owner'); assert.notEqual(login.session.household_id, f.household);
    const visible = await scoped(f.pool, login.session, async c => ({ homes: (await c.query('SELECT * FROM homeauto_online.households')).rows, devices: (await c.query('SELECT * FROM homeauto_online.devices')).rows }));
    assert.equal(visible.homes.length, 1); assert.equal(visible.homes[0].name, 'My home'); assert.equal(visible.devices.length, 0);
    await f.admin(async db => { const user = (await db.query("SELECT display_name,password_hash FROM homeauto_online.users WHERE username='new.owner'")).rows[0]; assert.equal(user.display_name, 'नया उपयोगकर्ता'); assert.notEqual(user.password_hash, password); assert.match(user.password_hash, /^scrypt:32768:8:1:/); });
    assert.deepEqual(await count(), { users: before.users + 1, homes: before.homes + 1 }); await auth.logout(login.token);
  });
  await t.test('duplicate case-folded username cannot replace credentials or leave an orphan home', async () => {
    const before = await count(); await assert.rejects(auth.register('NEW.OWNER', 'Replacement', password, 'registration-duplicate'), { code: 'USERNAME_TAKEN', status: 409 }); assert.deepEqual(await count(), before);
  });
  await t.test('concurrent duplicate requests create exactly one account and home', async () => {
    const before = await count(); const result = await Promise.allSettled([auth.register('race-owner', 'Race one', password, 'race-one'), auth.register('race-owner', 'Race two', password, 'race-two')]);
    assert.equal(result.filter(r => r.status === 'fulfilled').length, 1); assert.equal(result.find(r => r.status === 'rejected').reason.code, 'USERNAME_TAKEN'); assert.deepEqual(await count(), { users: before.users + 1, homes: before.homes + 1 });
  });
  await t.test('invalid username and password inputs are rejected without database rows', async () => {
    const before = await count(); for (const name of ['ab', 'a name', '<script>', 'a'.repeat(33)]) await assert.rejects(auth.register(name, 'Test', password, 'invalid-name'), { code: 'INVALID_USERNAME' });
    for (const value of ['short', 'x'.repeat(257), null]) await assert.rejects(auth.register('valid-name', 'Test', value, 'invalid-password'), { code: 'PASSWORD_LENGTH' }); assert.deepEqual(await count(), before);
  });
  await t.test('registration is bounded per IP before further password hashing', async () => {
    for (let i = 0; i < 5; i++) await assert.rejects(auth.register('new.owner', 'Test', password, 'signup-throttle'), { code: 'USERNAME_TAKEN' });
    await assert.rejects(auth.register('another-owner', 'Test', password, 'signup-throttle'), { code: 'SIGNUP_RATE_LIMITED', status: 429 });
  });
  await t.test('credential helper rejects malformed verifiers and is not granted to PUBLIC', async () => {
    const before = await count(); await assert.rejects(fn(f.pool, 'register_user', [crypto.randomUUID(), crypto.randomUUID(), 'invalid-hash', 'Test', 'not-a-password-verifier']), { code: '22023' });
    const acl = await f.pool.query("SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE n.nspname='homeauto_online' AND p.proname='register_user' AND a.grantee=0 AND a.privilege_type='EXECUTE') public_execute");
    assert.equal(acl.rows[0].public_execute, false); assert.deepEqual(await count(), before);
  });
  await t.test('a failed membership insert rolls the whole registration back', async () => {
    const before = await count(); const encoded = await passwordHash(password);
    await f.admin(db => db.exec("CREATE FUNCTION public.reject_signup_membership() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Synthetic membership failure' USING ERRCODE='23514'; END$$; CREATE TRIGGER reject_signup_membership BEFORE INSERT ON homeauto_online.memberships FOR EACH ROW EXECUTE FUNCTION public.reject_signup_membership()"));
    try { await assert.rejects(fn(f.pool, 'register_user', [crypto.randomUUID(), crypto.randomUUID(), 'rollback-owner', 'Test', encoded]), { code: '23514' }); assert.deepEqual(await count(), before); }
    finally { await f.admin(db => db.exec('DROP TRIGGER reject_signup_membership ON homeauto_online.memberships; DROP FUNCTION public.reject_signup_membership()')); }
  });
  await t.test('schema2 keeps sign-in available and registration fails closed during rollout', async () => {
    await f.admin(db => db.exec('DROP FUNCTION homeauto_online.register_user(uuid,uuid,text,text,text); DELETE FROM public.homeauto_online_migrations WHERE version=3'));
    await assertOnlineRole(f.pool); const login = await auth.login('new.owner', password, 'schema2-rollout'); assert.equal(login.session.role, 'owner');
    const before = await count(); await assert.rejects(auth.register('pending-schema', 'Test', password, 'schema2-signup'), { code: 'SIGNUP_UNAVAILABLE', status: 503 }); assert.deepEqual(await count(), before); await auth.logout(login.token);
  });
});

test('public signup HTTP validates origin, shape and account creation without issuing a session', async t => {
  const f = await onlineFixture(); t.after(() => f.close());
  const config = { origins: new Set(), secure: false, allowCommands: false };
  const server = http.createServer(createOnlineApp({ pool: f.pool, config, logger: { info() {} } }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = 'http://127.0.0.1:' + server.address().port; config.origins.add(origin);
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const valid = { username: 'http-owner', display_name: 'HTTP test owner', password: 'a long synthetic HTTP password' };
  const post = (body, headers = {}) => fetch(origin + '/api/auth/signup', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  await t.test('foreign origins and caller-selected roles/households are rejected', async () => {
    assert.equal((await post(valid, { Origin: 'https://other.invalid' })).status, 403);
    assert.equal((await post({ ...valid, role: 'owner' })).status, 400); assert.equal((await post({ ...valid, household_id: f.household })).status, 400);
  });
  await t.test('successful signup is201 with no credential or session leakage; sign-in works separately', async () => {
    const r = await post(valid); assert.equal(r.status, 201); assert.equal(r.headers.get('set-cookie'), null); assert.deepEqual(await r.json(), { created: true, username: valid.username });
    assert.equal((await fetch(origin + '/api/snapshot')).status, 401);
    const login = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: valid.username, password: valid.password }) }); assert.equal(login.status, 200); assert.equal((await login.json()).user.role, 'owner');
  });
  await t.test('duplicate signup returns a useful409 and hour-long throttling has an honest Retry-After', async () => {
    for (let i = 0; i < 4; i++) assert.equal((await post(valid)).status, 409);
    const limited = await post(valid); assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '3600'); assert.equal((await limited.json()).error.code, 'SIGNUP_RATE_LIMITED');
  });
});
