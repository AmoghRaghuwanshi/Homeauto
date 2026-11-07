const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { PGlite } = require("@electric-sql/pglite");
const { onlineFixture } = require("./helpers/online-fixture");
const { createRepository } = require("../db/repository");
const { Home } = require("../services/home");
const { createCloudAuth, fn } = require("../online/auth");
const { createOnlineStore } = require("../online/store");
const {
  createGatewayWorker,
  buildExchange,
  loadGatewayConfig,
} = require("../online/gateway");
const { scoped, assertOnlineRole, loadOnlineConfig } = require("../online/db");
const { migrateOnline } = require("../online/migrate");
const {
  main: operator,
  operate,
  privateOutput,
} = require("../scripts/online-operator");
const quiet = { info: () => {} };
function seed(home) {
  home.setConnected(true);
  for (const board of ["lights", "door"])
    home.ingest("home/esp32/" + board + "/online", Buffer.from("true"));
  for (let i = 1; i <= 4; i++)
    home.ingest("home/light/" + i + "/status", Buffer.from("off"));
  home.ingest("home/door/1/status", Buffer.from("locked"));
  home.ingest(
    "home/sensor/gas/data",
    Buffer.from('{"raw":200,"gas_ppm":49,"alert":false}'),
  );
  home.ingest("home/sensor/motion/data", Buffer.from('{"motion":false}'));
}
function localHome(repo, published) {
  return new Home(repo, {
    publisher: (...args) => {
      published.push(args);
      args[3](null);
    },
  });
}
function bridge(auth, store, config, intercept) {
  return async (url, options) => {
    if (intercept?.before) {
      const result = await intercept.before(url, options);
      if (result) return result;
    }
    const gateway = await auth.gateway(options.headers.Authorization.slice(7));
    if (!gateway)
      return Response.json(
        { error: { code: "GATEWAY_AUTH_REQUIRED" } },
        { status: 401 },
      );
    let result;
    try {
      const pathname = new URL(url).pathname,
        body = JSON.parse(options.body);
      result = pathname.endsWith("/ticket")
        ? await store.ticket(gateway)
        : pathname.endsWith("/exchange")
          ? await store.exchange(gateway, body)
          : await store.redeem(
              gateway,
              pathname.split("/").at(-2),
              body.lease_id,
            );
    } catch (error) {
      return Response.json(
        { error: { code: error.code || "CLOUD_UNAVAILABLE" } },
        { status: error.status || 503 },
      );
    }
    const response = Response.json(result);
    if (intercept?.after) return await intercept.after(url, options, response);
    return response;
  };
}

test("production cloud safety and failure regressions", async (t) => {
  const fixture = await onlineFixture();
  t.after(() => fixture.close());
  const auth = createCloudAuth(fixture.pool, { secure: false }),
    store = createOnlineStore(fixture.pool, { allowCommands: true });
  const owner = (
    await auth.login("cloud-owner", fixture.password, "safety-fixture")
  ).session;
  const config = {
    householdId: fixture.household,
    gatewayId: fixture.gateway,
    token: fixture.token,
    origin: "https://isolated.invalid",
    allowLights: true,
  };
  const repo = await createRepository({ gateway: config });
  t.after(() => repo.close());
  const publications = [];
  const home = localHome(repo, publications);
  seed(home);
  let after;
  const worker = createGatewayWorker(home, config, {
    fetchImpl: bridge(auth, store, config, {
      after: async (...args) => (after ? after(...args) : args[2]),
    }),
  });
  t.after(() => worker.stop());
  assert.equal((await worker.runOnce()).state, "connected");
  await t.test(
    "cloud and gateway configuration is off by default and rejects unsafe enablement",
    () => {
      assert.equal(loadGatewayConfig({}), null);
      assert.throws(() => loadGatewayConfig({ HOMEAUTO_GATEWAY_ENABLED: "1" }));
      const env = {
        HOMEAUTO_GATEWAY_ENABLED: "1",
        HOMEAUTO_GATEWAY_CONSENT: "telemetry-v1",
        HOMEAUTO_HOUSEHOLD_ID: fixture.household,
        HOMEAUTO_GATEWAY_ID: fixture.gateway,
        HOMEAUTO_GATEWAY_TOKEN: fixture.token,
        HOMEAUTO_GATEWAY_ORIGIN: config.origin,
      };
      assert.equal(loadGatewayConfig(env).allowLights, false);
      assert.throws(() =>
        loadGatewayConfig({ ...env, HOMEAUTO_REMOTE_LIGHTS_ENABLED: "1" }),
      );
      assert.throws(() =>
        loadGatewayConfig({ ...env, HOMEAUTO_DOOR_ENABLED: "1" }),
      );
      assert.throws(() =>
        loadGatewayConfig({ ...env, HOMEAUTO_CLOUD_SYNC_ENABLED: "1" }),
      );
      assert.throws(() => loadOnlineConfig({}));
    },
  );
  await t.test(
    "RLS blocks cross-household writes and other users private preferences",
    async () => {
      await assert.rejects(
        scoped(fixture.pool, owner, (c) =>
          c.query(
            "INSERT INTO homeauto_online.rooms(household_id,room_id,name,name_key,version) VALUES($1,$2,$3,$3,1)",
            [fixture.otherHousehold, "forged", "forged"],
          ),
        ),
      );
      await store.preferences(owner, { favorites: ["light-1"] }, 0);
      const viewer = (
        await auth.login("cloud-viewer", fixture.password, "safety-viewer")
      ).session;
      const rows = await scoped(fixture.pool, viewer, (c) =>
        c.query("SELECT * FROM homeauto_online.preferences"),
      );
      assert.equal(rows.rows.length, 0);
      assert.equal(
        (await fixture.pool.query("SELECT * FROM homeauto_online.devices")).rows
          .length,
        0,
      );
    },
  );
  await t.test(
    "inherited ownership is rejected even without direct superuser flags",
    async () => {
      await fixture.admin(async (db) => {
        await db.exec("GRANT postgres TO homeauto_online_fixture");
      });
      await assert.rejects(assertOnlineRole(fixture.pool), {
        code: "UNSAFE_DATABASE_ROLE",
      });
      await fixture.admin((db) =>
        db.exec("REVOKE postgres FROM homeauto_online_fixture"),
      );
      await assertOnlineRole(fixture.pool);
    },
  );
  await t.test(
    "concurrent users cannot queue conflicting operations for one light",
    async () => {
      const results = await Promise.allSettled([
        store.request(owner, "light-1", {
          action: "on",
          idempotency_key: crypto.randomUUID(),
        }),
        store.request(owner, "light-1", {
          action: "off",
          idempotency_key: crypto.randomUUID(),
        }),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        results.find((r) => r.status === "rejected").reason.code,
        "DEVICE_BUSY",
      );
      await fixture.admin((db) =>
        db.query(
          "UPDATE homeauto_online.commands SET state='rejected',finished_at=now() WHERE household_id=$1 AND device_id='light-1' AND state='queued'",
          [fixture.household],
        ),
      );
      assert.equal(publications.length, 0);
    },
  );
  await t.test(
    "database failure rolls back a command and its event together",
    async () => {
      const key = crypto.randomUUID();
      const faulty = {
        connect: async () => {
          const client = await fixture.pool.connect();
          return {
            query: async (sql, args) => {
              if (sql.startsWith("INSERT INTO homeauto_online.events"))
                throw new Error("injected transaction failure");
              return client.query(sql, args);
            },
            release: client.release,
          };
        },
      };
      await assert.rejects(
        createOnlineStore(faulty, { allowCommands: true }).request(
          owner,
          "light-2",
          { action: "on", idempotency_key: key },
        ),
      );
      const count = await scoped(fixture.pool, owner, (c) =>
        c.query(
          "SELECT count(*)::int n FROM homeauto_online.commands WHERE household_id=$1 AND idempotency_key=$2",
          [owner.household_id, key],
        ),
      );
      assert.equal(count.rows[0].n, 0);
      assert.equal(publications.length, 0);
    },
  );
  await t.test(
    "a committed delivery with a lost response is not delivered or published again",
    async () => {
      const command = await store.request(owner, "light-1", {
        action: "on",
        idempotency_key: crypto.randomUUID(),
      });
      let lost = true;
      after = async (url, options, response) => {
        if (lost && url.endsWith("/exchange")) {
          lost = false;
          throw new Error("lost after commit");
        }
        return response;
      };
      assert.equal((await worker.runOnce()).state, "retry");
      after = null;
      await worker.runOnce();
      assert.equal(publications.length, 0);
      const delivered = await store.command(owner, command.id);
      assert.equal(delivered.state, "delivered");
      await fixture.admin((db) =>
        db.query(
          "UPDATE homeauto_online.commands SET created_at=now()-interval '1 minute',expires_at=now()-interval '45 seconds' WHERE command_id=$1",
          [command.id],
        ),
      );
      assert.equal((await store.command(owner, command.id)).state, "uncertain");
    },
  );
  await t.test(
    "a lost admission response produces uncertainty with zero publications",
    async () => {
      const command = await store.request(owner, "light-2", {
        action: "on",
        idempotency_key: crypto.randomUUID(),
      });
      after = async (url, options, response) => {
        if (url.endsWith("/redeem")) throw new Error("lost admission");
        return response;
      };
      await worker.runOnce();
      after = null;
      await worker.runOnce();
      assert.equal((await store.command(owner, command.id)).state, "uncertain");
      assert.equal(publications.length, 0);
    },
  );
  await t.test(
    "logout between delivery and redemption prevents publication",
    async () => {
      const login = await auth.login(
        "cloud-owner",
        fixture.password,
        "logout-race",
      );
      const command = await store.request(login.session, "light-3", {
        action: "on",
        idempotency_key: crypto.randomUUID(),
      });
      after = async (url, options, response) => {
        if (url.endsWith("/exchange")) await auth.logout(login.token);
        return response;
      };
      await worker.runOnce();
      after = null;
      assert.equal((await store.command(owner, command.id)).state, "rejected");
      assert.equal(publications.length, 0);
    },
  );
  await t.test(
    "local commands continue while the Vercel API is unavailable",
    async () => {
      const offline = createGatewayWorker(home, config, {
        fetchImpl: async () =>
          Response.json(
            { error: { code: "CLOUD_UNAVAILABLE" } },
            { status: 503 },
          ),
      });
      try {
        assert.equal((await offline.runOnce()).state, "retry");
        const result = home.request(
          "light-4",
          { action: "on", idempotency_key: crypto.randomUUID() },
          { role: "owner", user_id: "local-fixture" },
        );
        assert.equal(result.state, "published");
        assert.equal(publications.length, 1);
        home.ingest("home/light/4/status", Buffer.from("on"));
      } finally {
        offline.stop();
      }
    },
  );
  await t.test(
    "the final admission guard can cancel after durable acceptance, before MQTT",
    () => {
      const before = publications.length;
      const result = home.request(
        "light-4",
        { action: "off", idempotency_key: crypto.randomUUID() },
        { role: "owner", user_id: "local-fixture" },
        "cloud",
        () => false,
      );
      assert.equal(result.state, "failed");
      assert.equal(result.error_code, "COMMAND_EXPIRED");
      assert.equal(publications.length, before);
    },
  );
  await t.test(
    "invalid, retained or old reports cannot become fresh device evidence",
    async () => {
      const before = home.device("light-4").observation.reported_status;
      home.ingest("home/light/4/status", Buffer.from("garbage"));
      assert.equal(home.device("light-4").observation.reported_status, before);
      home.ingest("home/light/4/status", Buffer.from("off"), { retain: true });
      assert.equal(home.device("light-4").observation.reported_status, before);
      home.observations.delete("light-4");
      home.ingest("home/light/4/status", Buffer.from("off"), { retain: true });
      await worker.runOnce();
      let snapshot = await store.snapshot(owner);
      assert.notEqual(
        snapshot.devices.find((d) => d.id === "light-4").observation.freshness,
        "current",
      );
      home.ingest("home/light/4/status", Buffer.from("on"));
      await worker.runOnce();
      const actor = await auth.gateway(fixture.token),
        ticket = await store.ticket(actor),
        message = buildExchange(home, config, ticket);
      message.devices.find((d) => d.id === "light-4").age_ms = 80000;
      const { digest, ...body } = message;
      message.digest = require("../online/protocol").hash(body);
      await store.exchange(actor, message);
      snapshot = await store.snapshot(owner);
      assert.equal(
        snapshot.devices.find((d) => d.id === "light-4").observation.freshness,
        "stale",
      );
    },
  );
  await t.test(
    "repeated telemetry updates latest state without unbounded duplicate history",
    async () => {
      home.ingest("home/light/4/status", Buffer.from("on"));
      await worker.runOnce();
      const count = async () =>
        Number(
          (
            await scoped(fixture.pool, owner, (c) =>
              c.query(
                "SELECT count(*) n FROM homeauto_online.observation_history WHERE household_id=$1",
                [fixture.household],
              ),
            )
          ).rows[0].n,
        );
      const before = await count();
      for (let i = 0; i < 12; i++) await worker.runOnce();
      assert.equal(await count(), before);
    },
  );
  await t.test(
    "motion alerts retain their original info severity and acknowledgment does not clear them",
    async () => {
      home.ingest("home/sensor/motion/data", Buffer.from('{"motion":true}'));
      await worker.runOnce();
      let snapshot = await store.snapshot(owner);
      const alert = snapshot.alerts.find(
        (a) => a.kind === "motion" && a.state === "active",
      );
      assert.ok(alert);
      assert.equal(alert.severity, "info");
      await store.receipt(owner, alert.id, "acknowledge");
      snapshot = await store.snapshot(owner);
      assert.equal(
        snapshot.alerts.find((a) => a.id === alert.id).state,
        "active",
      );
      assert.ok(
        snapshot.alerts.find((a) => a.id === alert.id).receipt.acknowledged_at,
      );
      home.ingest("home/sensor/motion/data", Buffer.from('{"motion":false}'));
      await worker.runOnce();
      assert.equal(
        (await store.snapshot(owner)).alerts.find((a) => a.id === alert.id)
          .state,
        "resolved",
      );
    },
  );
  await t.test(
    "clock differences use relative report age and server-issued command time",
    async () => {
      home.now = () => Date.now() + 3600000;
      seed(home);
      await worker.runOnce();
      let snapshot = await store.snapshot(owner);
      assert.equal(
        snapshot.devices.find((d) => d.id === "light-3").observation.freshness,
        "current",
      );
      assert.ok(
        Math.abs(
          Date.now() -
            Date.parse(
              snapshot.devices.find((d) => d.id === "light-3").observation
                .received_at,
            ),
        ) < 10000,
      );
      home.now = () => Date.now() - 3600000;
      await worker.runOnce();
      snapshot = await store.snapshot(owner);
      assert.ok(
        snapshot.devices.every((d) => d.observation.freshness !== "current"),
      );
      home.now = Date.now;
      seed(home);
      await worker.runOnce();
    },
  );
  await t.test(
    "independent cloud instances share database events and current state",
    async () => {
      const another = createOnlineStore(fixture.pool, { allowCommands: true });
      const command = await store.request(owner, "light-3", {
        action: "on",
        idempotency_key: crypto.randomUUID(),
      });
      assert.equal((await another.command(owner, command.id)).state, "queued");
      const feed = await another.feed(owner);
      assert.ok(
        feed.events.some((event) => event.payload.command_id === command.id),
      );
      assert.equal(
        new Set(feed.events.map((event) => event.event_id)).size,
        feed.events.length,
      );
      await fixture.admin((db) =>
        db.query(
          "UPDATE homeauto_online.commands SET state='rejected',finished_at=now() WHERE command_id=$1",
          [command.id],
        ),
      );
    },
  );
  await t.test(
    "restored stale gateway sequences block rather than overwriting cloud state",
    async () => {
      await fixture.admin((db) =>
        db.query(
          "UPDATE homeauto_online.gateways SET last_sequence=last_sequence+1000 WHERE gateway_id=$1",
          [fixture.gateway],
        ),
      );
      const before = publications.length;
      assert.equal((await worker.runOnce()).state, "blocked");
      assert.equal(publications.length, before);
    },
  );
});

test("gateway restart, operator recovery and migration safeguards", async (t) => {
  const fixture = await onlineFixture();
  t.after(() => fixture.close());
  const auth = createCloudAuth(fixture.pool, { secure: false }),
    store = createOnlineStore(fixture.pool, { allowCommands: true });
  const login = await auth.login(
    "other-owner",
    fixture.password,
    "restart-test",
  );
  const config = {
    householdId: fixture.otherHousehold,
    gatewayId: fixture.otherGateway,
    token: fixture.otherToken,
    origin: "https://isolated.invalid",
    allowLights: true,
  };
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "homeauto-online-restart-"),
  );
  const filename = path.join(dir, "fixture.db");
  let repo = await createRepository({ filename, gateway: config }),
    home = localHome(repo, []),
    worker;
  const publications = [];
  home.publisher = (...args) => {
    publications.push(args);
    args[3](null);
  };
  seed(home);
  t.after(() => {
    worker?.stop();
    repo?.close();
    assert.ok(
      path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep),
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });
  let stopOnRedeem = false;
  const transport = bridge(auth, store, config, {
    after: async (url, options, response) => {
      if (stopOnRedeem && url.endsWith("/redeem")) worker.stop();
      return response;
    },
  });
  worker = createGatewayWorker(home, config, { fetchImpl: transport });
  await worker.runOnce();
  await t.test(
    "a process restart after admission never replays a physical command",
    async () => {
      const command = await store.request(login.session, "light-1", {
        action: "on",
        idempotency_key: crypto.randomUUID(),
      });
      stopOnRedeem = true;
      await worker.runOnce();
      assert.equal(publications.length, 0);
      assert.equal(
        repo.one(
          "SELECT state FROM online_gateway_commands WHERE command_id=?",
          [command.id],
        ).state,
        "claimed",
      );
      repo.close();
      repo = await createRepository({ filename, gateway: config });
      home = localHome(repo, publications);
      stopOnRedeem = false;
      worker = createGatewayWorker(home, config, { fetchImpl: transport });
      await worker.runOnce();
      assert.equal(publications.length, 0);
      assert.equal(
        (await store.command(login.session, command.id)).state,
        "uncertain",
      );
    },
  );
  await t.test(
    "operator commands require an explicit approved target before connecting",
    async () => {
      let connections = 0;
      const poolFactory = () => {
        connections++;
        throw new Error("should not connect");
      };
      await assert.rejects(
        operator(["migrate", "--apply"], {}, { poolFactory }),
      );
      await assert.rejects(
        operator(
          ["migrate", "--apply"],
          {
            HOMEAUTO_ONLINE_ADMIN_APPROVED: "1",
            DATABASE_URL_UNPOOLED:
              "postgresql://operator@isolated.invalid/wrong",
            HOMEAUTO_EXPECTED_DATABASE: "right",
          },
          { poolFactory },
        ),
      );
      assert.equal(connections, 0);
      assert.throws(() =>
        privateOutput(path.join(__dirname, "accidental-key.json")),
      );
    },
  );
  await t.test(
    "credential rotation writes only a private exclusive file and revokes old keys",
    async () => {
      const output = path.join(dir, "new-key.json");
      let result;
      await fixture.admin(async (db) => {
        await db.exec("BEGIN");
        try {
          result = await operate(
            db,
            "rotate-gateway-key",
            [fixture.otherHousehold, fixture.otherGateway, output],
            {},
          );
          await db.exec("COMMIT");
        } catch (error) {
          await db.exec("ROLLBACK");
          throw error;
        }
      });
      const key = JSON.parse(fs.readFileSync(output, "utf8"));
      assert.ok(!JSON.stringify(result).includes(key.gateway_token));
      assert.equal(
        (await auth.gateway(key.gateway_token)).gateway_id,
        fixture.otherGateway,
      );
      assert.throws(() => privateOutput(output));
      const seq = repo.one(
        "SELECT sequence FROM online_gateway_state",
      ).sequence;
      repo.write("UPDATE online_gateway_state SET blocked=1");
      worker.stop();
      repo.close();
      repo = await createRepository({
        filename,
        gateway: { ...config, token: key.gateway_token },
      });
      assert.equal(
        repo.one("SELECT blocked FROM online_gateway_state").blocked,
        0,
      );
      assert.equal(
        repo.one("SELECT sequence FROM online_gateway_state").sequence,
        seq,
      );
      await fixture.admin((db) => operate(db, "revoke-key", [key.key_id], {}));
      assert.equal(await auth.gateway(key.gateway_token), null);
    },
  );
  await t.test(
    "operator password recovery revokes old sessions without changing local identities",
    async () => {
      const old = (
        await auth.login("cloud-owner", fixture.password, "reset-test")
      ).token;
      await fixture.admin((db) =>
        operate(db, "reset-password", ["cloud-owner"], {
          HOMEAUTO_CLOUD_OPERATOR_PASSWORD: "new-synthetic-password",
        }),
      );
      assert.equal(await auth.actor(old), null);
      const updated = await auth.login(
        "cloud-owner",
        "new-synthetic-password",
        "reset-test-new",
      );
      assert.ok(updated.session);
    },
  );
  await t.test(
    "retention keeps latest observations and monotonic replay protection",
    async () => {
      const cursorBefore = (await store.snapshot(login.session)).cloud_cursor;
      await fixture.admin((db) =>
        db.query(
          "UPDATE homeauto_online.events SET created_at=now()-interval '31 days' WHERE household_id=$1",
          [fixture.otherHousehold],
        ),
      );
      await fixture.admin((db) =>
        db.query(
          "UPDATE homeauto_online.gateway_inbox SET received_at=now()-interval '8 days' WHERE household_id=$1",
          [fixture.otherHousehold],
        ),
      );
      const before = await fixture.admin(
        async (db) =>
          (
            await db.query(
              "SELECT last_sequence FROM homeauto_online.gateways WHERE gateway_id=$1",
              [fixture.otherGateway],
            )
          ).rows[0].last_sequence,
      );
      await fixture.admin(async (db) => {
        await db.exec("BEGIN");
        await operate(db, "maintain", [fixture.otherHousehold], {});
        await db.exec("COMMIT");
      });
      const after = await fixture.admin(
        async (db) =>
          (
            await db.query(
              "SELECT last_sequence FROM homeauto_online.gateways WHERE gateway_id=$1",
              [fixture.otherGateway],
            )
          ).rows[0].last_sequence,
      );
      assert.equal(after, before);
      assert.equal(
        (await store.snapshot(login.session)).cloud_cursor,
        cursorBefore,
      );
      const count = await fixture.admin(
        async (db) =>
          (
            await db.query(
              "SELECT count(*)::int n FROM homeauto_online.gateway_inbox WHERE household_id=$1",
              [fixture.otherHousehold],
            )
          ).rows[0].n,
      );
      assert.equal(count, 0);
      await assert.rejects(
        fixture.pool.query("SELECT homeauto_online.prune_household($1)", [
          fixture.household,
        ]),
      );
    },
  );
  await t.test(
    "operator quarantine invalidates restored sessions, gateway keys and active commands",
    async () => {
      const command = { id: crypto.randomUUID() };
      await fixture.admin((db) =>
        db.query(
          "INSERT INTO homeauto_online.commands(command_id,household_id,device_id,actor_id,session_hash,action,state,idempotency_key,request_hash,expires_at) VALUES($1,$2,'light-2',$3,'synthetic-session','on','queued',$4,'synthetic-request',now()+interval '15 seconds')",
          [
            command.id,
            fixture.otherHousehold,
            fixture.otherOwner,
            crypto.randomUUID(),
          ],
        ),
      );
      await fixture.admin(async (db) => {
        await db.exec("BEGIN");
        try {
          await operate(db, "quarantine", [fixture.otherHousehold], {});
          await db.exec("COMMIT");
        } catch (error) {
          await db.exec("ROLLBACK");
          throw error;
        }
      });
      assert.equal(await auth.actor(login.token), null);
      assert.equal(await auth.gateway(fixture.otherToken), null);
      const saved = await fixture.admin(
        async (db) =>
          (
            await db.query(
              "SELECT state,error_code FROM homeauto_online.commands WHERE command_id=$1",
              [command.id],
            )
          ).rows[0],
      );
      assert.deepEqual(saved, {
        state: "rejected",
        error_code: "OPERATOR_QUARANTINE",
      });
      assert.ok(
        await auth.login(
          "cloud-owner",
          "new-synthetic-password",
          "unaffected-house",
        ),
      );
    },
  );
});

test("interrupted online migration leaves no half-created schema", async () => {
  const db = new PGlite();
  await db.waitReady;
  let fail = true;
  const pool = {
    connect: async () => ({
      query: async (sql, args = []) => {
        if (
          fail &&
          sql.startsWith("INSERT INTO public.homeauto_online_migrations")
        )
          throw new Error("injected migration interruption");
        return args.length || !sql.includes(";")
          ? db.query(sql, args)
          : (await db.exec(sql), { rows: [] });
      },
      release: () => {},
    }),
  };
  try {
    await assert.rejects(migrateOnline(pool));
    assert.equal(
      (await db.query("SELECT to_regnamespace('homeauto_online') AS schema"))
        .rows[0].schema,
      null,
    );
    fail = false;
    assert.equal((await migrateOnline(pool)).applied, true);
    assert.equal((await migrateOnline(pool)).applied, false);
  } finally {
    await db.close();
  }
});
