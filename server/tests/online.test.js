const { test } = require("node:test");
const assert = require("node:assert/strict");
const { onlineFixture } = require("./helpers/online-fixture");
const { assertOnlineRole, scoped } = require("../online/db");
const { createCloudAuth, fn, hash } = require("../online/auth");
const http = require("http");
const crypto = require("crypto");
const { createRepository } = require("../db/repository");
const { Home } = require("../services/home");
const { createOnlineApp } = require("../online/app");
const { createGatewayWorker, buildExchange } = require("../online/gateway");
test("online PostgreSQL schema and durable identity", async (t) => {
  const fixture = await onlineFixture();
  t.after(() => fixture.close());
  const { pool } = fixture;
  const auth = createCloudAuth(pool, { secure: false });
  await t.test(
    "restricted role, forced tenant isolation and private credential tables",
    async () => {
      await assertOnlineRole(pool);
      assert.equal(
        (await pool.query("SELECT * FROM homeauto_online.devices")).rows.length,
        0,
      );
      await assert.rejects(pool.query("SELECT * FROM homeauto_online.users"));
      await assert.rejects(
        pool.query("SELECT * FROM homeauto_online.gateway_keys"),
      );
    },
  );
  await t.test(
    "session login is durable, scoped, CSRF-equipped and revocable",
    async () => {
      const login = await auth.login(
        "cloud-owner",
        fixture.password,
        "fixture-ip",
      );
      assert.equal(login.session.role, "owner");
      assert.equal(login.session.household_id, fixture.household);
      assert.ok(login.session.csrf_token);
      assert.equal((await auth.actor(login.token)).user_id, fixture.owner);
      await auth.logout(login.token);
      assert.equal(await auth.actor(login.token), null);
    },
  );
  await t.test(
    "household rotation preserves expiry and logout revokes the whole token lineage",
    async () => {
      await fixture.admin((db) =>
        db.query(
          "INSERT INTO homeauto_online.memberships(household_id,user_id,role) VALUES($1,$2,'viewer')",
          [fixture.otherHousehold, fixture.owner],
        ),
      );
      const login = await auth.login(
        "cloud-owner",
        fixture.password,
        "rotate-fixture",
      );
      const switched = await auth.switchHousehold(
        login.session,
        login.token,
        fixture.otherHousehold,
      );
      assert.equal(switched.session.role, "viewer");
      assert.equal(switched.session.expires_at, login.session.expires_at);
      assert.equal(await auth.actor(login.token), null);
      const back = await auth.switchHousehold(
        switched.session,
        switched.token,
        fixture.household,
      );
      assert.equal(back.session.role, "owner");
      await auth.logout(login.token);
      assert.equal(await auth.actor(back.token), null);
      assert.equal(
        await fn(pool, "valid_controller", [
          fixture.owner,
          fixture.household,
          hash(back.token),
        ]),
        false,
      );
      await assert.rejects(
        auth.switchHousehold(back.session, back.token, fixture.otherHousehold),
        { code: "LOGIN_REQUIRED" },
      );
    },
  );
  await t.test(
    "session reads do not renew idle expiry; activity renews only within its bound",
    async () => {
      const login = await auth.login(
        "cloud-owner",
        fixture.password,
        "idle-fixture",
      );
      await fixture.admin((db) =>
        db.query(
          "UPDATE homeauto_online.sessions SET last_active_at=now()-interval '29 minutes' WHERE token_hash=$1",
          [hash(login.token)],
        ),
      );
      const before = await fixture.admin(
        async (db) =>
          (
            await db.query(
              "SELECT last_active_at FROM homeauto_online.sessions WHERE token_hash=$1",
              [hash(login.token)],
            )
          ).rows[0].last_active_at,
      );
      assert.ok(await auth.actor(login.token));
      assert.ok(await auth.actor(login.token));
      const after = await fixture.admin(
        async (db) =>
          (
            await db.query(
              "SELECT last_active_at FROM homeauto_online.sessions WHERE token_hash=$1",
              [hash(login.token)],
            )
          ).rows[0].last_active_at,
      );
      assert.equal(String(before), String(after));
      await auth.touch(login.token);
      assert.ok(await auth.actor(login.token));
      await fixture.admin((db) =>
        db.query(
          "UPDATE homeauto_online.sessions SET last_active_at=now()-interval '31 minutes' WHERE token_hash=$1",
          [hash(login.token)],
        ),
      );
      await auth.touch(login.token);
      assert.equal(await auth.actor(login.token), null);
      assert.equal(
        await fn(pool, "issue_session", [
          fixture.owner,
          fixture.household,
          hash("stale-verification"),
          new Date(),
          new Date(Date.now() + 10000),
          null,
          "obsolete-password-hash",
        ]),
        false,
      );
    },
  );
  await t.test(
    "gateway credentials are scoped, private and checked against revocation/expiry",
    async () => {
      assert.deepEqual(await auth.gateway(fixture.token), {
        household_id: fixture.household,
        gateway_id: fixture.gateway,
      });
      assert.equal(await auth.gateway("f".repeat(64)), null);
    },
  );
});

test("cloud HTTP, durable gateway, command lifecycle and isolation", async (t) => {
  const fixture = await onlineFixture();
  t.after(() => fixture.close());
  const config = { origins: new Set(), secure: false, allowCommands: true };
  const app = createOnlineApp({ pool: fixture.pool, config });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = "http://127.0.0.1:" + server.address().port;
  config.origins.add(url);
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const gatewayConfig = {
    householdId: fixture.household,
    gatewayId: fixture.gateway,
    token: fixture.token,
    origin: "https://synthetic-cloud.invalid",
    allowLights: true,
  };
  const repo = await createRepository({ gateway: gatewayConfig });
  t.after(() => repo.close());
  const published = [];
  const home = new Home(repo, {
    publisher: (...args) => {
      published.push(args);
      args[3](null);
    },
  });
  home.setConnected(true);
  home.ingest("home/esp32/lights/online", Buffer.from("true"));
  home.ingest("home/esp32/door/online", Buffer.from("true"));
  for (let i = 1; i <= 4; i++)
    home.ingest("home/light/" + i + "/status", Buffer.from("off"));
  home.ingest("home/door/1/status", Buffer.from("locked"));
  home.ingest(
    "home/sensor/gas/data",
    Buffer.from('{"raw":220,"gas_ppm":53,"alert":false}'),
  );
  home.ingest("home/sensor/motion/data", Buffer.from('{"motion":false}'));
  const worker = createGatewayWorker(home, gatewayConfig, {
    fetchImpl: (endpoint, opts) =>
      fetch(endpoint.replace(gatewayConfig.origin, url), opts),
  });
  t.after(() => worker.stop());
  async function login(username = "cloud-owner") {
    const response = await fetch(url + "/api/auth/login", {
      method: "POST",
      headers: { Origin: url, "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: fixture.password }),
    });
    assert.equal(response.status, 200);
    return {
      cookie: response.headers.get("set-cookie").split(";")[0],
      session: await response.json(),
    };
  }
  let owner = await login();
  const request = async (
    path,
    { actor = owner, method = "GET", body, origin = url } = {},
  ) =>
    fetch(url + path, {
      method,
      headers: {
        Cookie: actor.cookie,
        Origin: origin,
        ...(body !== undefined
          ? {
              "Content-Type": "application/json",
              "X-CSRF-Token": actor.session.csrf_token,
            }
          : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  let commandId;
  await t.test(
    "initial sync registers seven scoped devices without a physical publication",
    async () => {
      assert.equal((await worker.runOnce()).state, "connected");
      assert.equal(published.length, 0);
      const snapshot = await (await request("/api/snapshot")).json();
      assert.equal(snapshot.devices.length, 7);
      assert.equal(snapshot.gateway.connected, true);
      assert.equal(
        snapshot.devices.find((d) => d.id === "light-1").observation.freshness,
        "current",
      );
      assert.equal(snapshot.system.door_enabled, false);
    },
  );
  await t.test(
    "cloud writes are queued, admitted once, then wait for actual simulated status evidence",
    async () => {
      const body = { action: "on", idempotency_key: crypto.randomUUID() };
      const response = await request("/api/devices/light-1/command", {
        method: "POST",
        body,
      });
      assert.equal(response.status, 202);
      const command = (await response.json()).command;
      commandId = command.id;
      assert.equal(command.state, "queued");
      assert.equal(published.length, 0);
      assert.equal((await worker.runOnce()).state, "connected");
      assert.equal(published.length, 1);
      assert.equal(published[0][0], "home/light/1/command");
      assert.equal(published[0][1], "on");
      assert.deepEqual(published[0][2], { qos: 0, retain: false });
      let status = (await (await request("/api/commands/" + commandId)).json())
        .command;
      assert.equal(status.state, "pending_observation");
      assert.equal(status.physical_verified, false);
      await worker.runOnce();
      assert.equal(published.length, 1);
      home.ingest("home/light/1/status", Buffer.from("on"));
      await worker.runOnce();
      status = (await (await request("/api/commands/" + commandId)).json())
        .command;
      assert.equal(status.state, "observed");
      assert.equal(status.physical_verified, false);
      const replay = (
        await (
          await request("/api/devices/light-1/command", {
            method: "POST",
            body,
          })
        ).json()
      ).command;
      assert.equal(replay.id, commandId);
      await worker.runOnce();
      assert.equal(published.length, 1);
    },
  );
  await t.test(
    "viewer, other-household, CSRF, Origin, sensor and door restrictions are server enforced",
    async () => {
      const viewer = await login("cloud-viewer"),
        other = await login("other-owner");
      assert.equal(
        (
          await request("/api/devices/light-2/command", {
            actor: viewer,
            method: "POST",
            body: { action: "on", idempotency_key: crypto.randomUUID() },
          })
        ).status,
        403,
      );
      assert.equal(
        (await request("/api/commands/" + commandId, { actor: other })).status,
        404,
      );
      assert.equal(
        (
          await request("/api/security/unlock-challenges", {
            method: "POST",
            body: { device_id: "door-1" },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/devices/door-1/command", {
            method: "POST",
            body: { action: "unlock", idempotency_key: crypto.randomUUID() },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/devices/sensor-gas/command", {
            method: "POST",
            body: { action: "on", idempotency_key: crypto.randomUUID() },
          })
        ).status,
        422,
      );
      assert.equal(
        (
          await request("/api/devices/light-2/command", {
            method: "POST",
            body: { action: "on", idempotency_key: crypto.randomUUID() },
            origin: "https://attacker.invalid",
          })
        ).status,
        403,
      );
      const csrf = await fetch(url + "/api/auth/logout", {
        method: "POST",
        headers: {
          Cookie: owner.cookie,
          Origin: url,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      assert.equal(csrf.status, 403);
      assert.equal(published.length, 1);
    },
  );
  await t.test(
    "duplicate telemetry is deduplicated and conflicting replays rejected",
    async () => {
      const actor = await app.locals.auth.gateway(fixture.token);
      const ticket = await app.locals.store.ticket(actor);
      const message = buildExchange(home, gatewayConfig, ticket);
      const first = await app.locals.store.exchange(actor, message);
      const second = await app.locals.store.exchange(actor, message);
      assert.equal(first.status, "accepted");
      assert.equal(second.duplicate, true);
      assert.deepEqual(second.commands, []);
      const changed = JSON.parse(JSON.stringify(message));
      changed.catalog.home.name = "Conflicting replay";
      const { digest, ...body } = changed;
      changed.digest = require("../online/protocol").hash(body);
      await assert.rejects(app.locals.store.exchange(actor, changed), {
        code: "GATEWAY_REPLAY_CONFLICT",
      });
    },
  );
  await t.test("expired delivery is never published", async () => {
    const result = await (
      await request("/api/devices/light-2/command", {
        method: "POST",
        body: { action: "on", idempotency_key: crypto.randomUUID() },
      })
    ).json();
    assert.ok(result.command?.id);
    await fixture.admin((db) =>
      db.query(
        "UPDATE homeauto_online.commands SET created_at=now()-interval '1 minute',expires_at=now()-interval '45 seconds' WHERE command_id=$1",
        [result.command.id],
      ),
    );
    await worker.runOnce();
    assert.equal(published.length, 1);
    assert.equal(
      (await (await request("/api/commands/" + result.command.id)).json())
        .command.state,
      "expired",
    );
  });
  await t.test(
    "pending commands are rejected after logout, before gateway admission",
    async () => {
      const result = await (
        await request("/api/devices/light-3/command", {
          method: "POST",
          body: { action: "on", idempotency_key: crypto.randomUUID() },
        })
      ).json();
      assert.equal(result.command.state, "queued");
      assert.equal(
        (await request("/api/auth/logout", { method: "POST", body: {} }))
          .status,
        200,
      );
      await worker.runOnce();
      assert.equal(published.length, 1);
      assert.equal((await request("/api/snapshot")).status, 401);
      owner = await login();
      assert.equal(
        (await (await request("/api/commands/" + result.command.id)).json())
          .command.state,
        "rejected",
      );
    },
  );
  await t.test(
    "gateway, broker and individual controller availability remain distinct",
    async () => {
      home.setConnected(false);
      await worker.runOnce();
      const snapshot = await (await request("/api/snapshot")).json();
      assert.equal(snapshot.gateway.connected, true);
      assert.equal(snapshot.mqtt.connected, false);
      assert.equal(snapshot.espBoards.lights.online, false);
      assert.ok(
        snapshot.devices.every((d) => d.observation.freshness !== "current"),
      );
      assert.equal(
        (
          await request("/api/devices/light-4/command", {
            method: "POST",
            body: { action: "on", idempotency_key: crypto.randomUUID() },
          })
        ).status,
        503,
      );
      home.setConnected(true);
      home.ingest("home/esp32/lights/online", Buffer.from("true"));
      await worker.runOnce();
      await fixture.admin((db) =>
        db.query(
          "UPDATE homeauto_online.gateways SET last_seen_at=now()-interval '20 seconds' WHERE gateway_id=$1",
          [fixture.gateway],
        ),
      );
      const offline = await (await request("/api/snapshot")).json();
      assert.equal(offline.gateway.connected, false);
      assert.ok(
        offline.devices.every((d) => d.observation.freshness !== "current"),
      );
    },
  );
  await t.test(
    "gateway handshake prevents aged captured messages from being accepted as current",
    async () => {
      const actor = await app.locals.auth.gateway(fixture.token);
      const ticket = await app.locals.store.ticket(actor);
      const message = buildExchange(home, gatewayConfig, ticket);
      await fixture.admin((db) =>
        db.query(
          "UPDATE homeauto_online.gateway_tickets SET created_at=now()-interval '20 seconds',expires_at=now()-interval '10 seconds' WHERE ticket_id=$1",
          [ticket.ticket_id],
        ),
      );
      await assert.rejects(app.locals.store.exchange(actor, message), {
        code: "EXCHANGE_TICKET_EXPIRED",
      });
    },
  );
  await t.test(
    "revoked gateway key cannot upload or retrieve commands",
    async () => {
      await fixture.admin((db) =>
        db.query(
          "UPDATE homeauto_online.gateway_keys SET revoked_at=now() WHERE gateway_id=$1",
          [fixture.gateway],
        ),
      );
      assert.equal((await worker.runOnce()).state, "blocked");
      assert.equal(published.length, 1);
    },
  );
});
