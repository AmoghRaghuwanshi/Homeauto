// Explicitly approved EMPTY staging only. Never provisions, migrates or deploys.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createPool, assertOnlineRole, scoped } = require("../online/db");
const { migrations } = require("../online/migrate");
const { passwordHash, hash } = require("../online/auth");
const { createOnlineStore } = require("../online/store");
const { createOnlinePreview } = require("../tests/helpers/online-preview");

function stagingTarget(args, env) {
  if (
    args.length !== 1 ||
    args[0] !== "--apply" ||
    env.HOMEAUTO_ONLINE_STAGING_APPROVED !== "1" ||
    !env.HOMEAUTO_EXPECTED_DATABASE ||
    !env.HOMEAUTO_EXPECTED_STAGING_HOST
  )
    throw new Error("An explicitly approved empty staging target is required");
  let direct, runtime;
  try {
    direct = new URL(env.DATABASE_URL_UNPOOLED);
    runtime = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("Private direct and restricted pooled URLs are required");
  }
  const host = (value) => value.replace("-pooler.", ".");
  for (const url of [direct, runtime])
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      host(url.hostname) !== env.HOMEAUTO_EXPECTED_STAGING_HOST ||
      decodeURIComponent(url.pathname.slice(1)) !==
        env.HOMEAUTO_EXPECTED_DATABASE
    )
      throw new Error("Staging target identity mismatch");
  if (
    direct.hostname.includes("-pooler") ||
    direct.username === runtime.username
  )
    throw new Error(
      "Separate direct operator and restricted runtime roles are required",
    );
  return { direct: env.DATABASE_URL_UNPOOLED, runtime: env.DATABASE_URL };
}
async function seed(pool, data) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(787431903)");
    const owner = (
      await c.query(
        "SELECT n.nspowner=r.oid AS owned FROM pg_namespace n JOIN pg_roles r ON r.rolname=current_user WHERE n.nspname='homeauto_online'",
      )
    ).rows[0]?.owned;
    if (!owner) throw new Error("Reviewed online schema-owner role required");
    const ledger = (
      await c.query(
        "SELECT version,checksum FROM public.homeauto_online_migrations ORDER BY version",
      )
    ).rows;
    assert.deepEqual(
      ledger,
      migrations().map(({ version, checksum }) => ({ version, checksum })),
    );
    const counts = (
      await c.query(
        "SELECT (SELECT count(*)::int FROM homeauto_online.households) homes,(SELECT count(*)::int FROM homeauto_online.users) users",
      )
    ).rows[0];
    if (counts.homes || counts.users)
      throw new Error("Refusing a non-empty online staging database");
    for (const house of [data.household, data.otherHousehold])
      await c.query(
        "INSERT INTO homeauto_online.households(household_id,name) VALUES($1,'Synthetic staging home')",
        [house],
      );
    const encoded = await passwordHash(data.password);
    for (const [user, name, house, role] of [
      [data.owner, data.username, data.household, "owner"],
      [data.viewer, data.viewerName, data.household, "viewer"],
      [data.otherOwner, data.otherName, data.otherHousehold, "owner"],
    ]) {
      await c.query(
        "INSERT INTO homeauto_online.users(user_id,username,display_name,password_hash) VALUES($1,$2,$2,$3)",
        [user, name, encoded],
      );
      await c.query(
        "INSERT INTO homeauto_online.memberships(household_id,user_id,role) VALUES($1,$2,$3)",
        [house, user, role],
      );
    }
    await c.query(
      "INSERT INTO homeauto_online.gateways(household_id,gateway_id) VALUES($1,$2)",
      [data.household, data.gateway],
    );
    await c.query(
      "INSERT INTO homeauto_online.gateway_keys(key_id,household_id,gateway_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '30 days')",
      [crypto.randomUUID(), data.household, data.gateway, hash(data.token)],
    );
    await c.query("COMMIT");
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }
}
async function clean(pool, data) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const homes = [data.household, data.otherHousehold],
      users = [data.owner, data.viewer, data.otherOwner];
    for (const table of [
      "alert_receipts",
      "preferences",
      "intents",
      "commands",
      "observation_history",
      "observations",
      "alerts",
      "devices",
      "rooms",
      "gateway_inbox",
      "gateway_tickets",
      "events",
      "gateway_keys",
      "sessions",
      "memberships",
      "gateways",
      "households",
    ])
      await c.query(
        `DELETE FROM homeauto_online.${table} WHERE household_id=ANY($1::uuid[])`,
        [homes],
      );
    await c.query(
      "DELETE FROM homeauto_online.audit_events WHERE household_id=ANY($1::uuid[]) OR user_id=ANY($2::uuid[])",
      [homes, users],
    );
    await c.query(
      "DELETE FROM homeauto_online.users WHERE user_id=ANY($1::uuid[])",
      [users],
    );
    await c.query("COMMIT");
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }
}
async function main(
  args = process.argv.slice(2),
  env = process.env,
  { poolFactory = createPool } = {},
) {
  const target = stagingTarget(args, env),
    admin = poolFactory(target.direct),
    pool = poolFactory(target.runtime),
    secondPool = poolFactory(target.runtime);
  const suffix = crypto.randomBytes(8).toString("hex");
  const data = {
    pool,
    close: async () => {},
    household: crypto.randomUUID(),
    otherHousehold: crypto.randomUUID(),
    gateway: crypto.randomUUID(),
    owner: crypto.randomUUID(),
    viewer: crypto.randomUUID(),
    otherOwner: crypto.randomUUID(),
    username: "stage-owner-" + suffix,
    viewerName: "stage-viewer-" + suffix,
    otherName: "stage-other-" + suffix,
    password: crypto.randomBytes(32).toString("hex"),
    token: crypto.randomBytes(32).toString("hex"),
  };
  let seeded = false,
    preview;
  const checks = [];
  try {
    await assertOnlineRole(pool);
    await assertOnlineRole(secondPool);
    await seed(admin, data);
    seeded = true;
    preview = await createOnlinePreview({
      databaseFixture: data,
      startGateway: false,
      autoObserve: false,
    });
    const response = await fetch(preview.url + "/api/auth/login", {
      method: "POST",
      headers: { Origin: preview.url, "Content-Type": "application/json" },
      body: JSON.stringify({
        username: data.username,
        password: data.password,
      }),
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie").split(";")[0],
      session = await response.json();
    const snapshot = await fetch(preview.url + "/api/snapshot", {
      headers: { Cookie: cookie },
    });
    assert.equal(snapshot.status, 200);
    assert.equal((await snapshot.json()).devices.length, 7);
    checks.push(
      "native TLS/pool role, loopback cloud HTTP and seven simulated reports",
    );
    const auth = preview.api.locals.auth,
      owner = (await auth.login(data.username, data.password, "native-owner"))
        .session,
      viewer = (
        await auth.login(data.viewerName, data.password, "native-viewer")
      ).session,
      other = (await auth.login(data.otherName, data.password, "native-other"))
        .session;
    const store = preview.api.locals.store,
      second = createOnlineStore(secondPool, { allowCommands: true });
    assert.equal((await second.snapshot(other)).devices.length, 0);
    await assert.rejects(
      second.snapshot({ ...owner, household_id: data.otherHousehold }),
    );
    await assert.rejects(
      store.request(viewer, "light-1", {
        action: "on",
        idempotency_key: crypto.randomUUID(),
      }),
      { code: "FORBIDDEN" },
    );
    checks.push(
      "tenant isolation and viewer denial across separate native pools",
    );
    const started = Date.now(),
      outcomes = await Promise.allSettled([
        store.request(owner, "light-1", {
          action: "on",
          idempotency_key: crypto.randomUUID(),
        }),
        second.request(owner, "light-1", {
          action: "off",
          idempotency_key: crypto.randomUUID(),
        }),
      ]);
    assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
    assert.equal(
      outcomes.filter((o) => o.status === "rejected")[0].reason.code,
      "DEVICE_BUSY",
    );
    const command = outcomes.find((o) => o.status === "fulfilled").value;
    await preview.worker.runOnce();
    assert.equal(preview.publications.length, 1);
    preview.home.ingest("home/light/1/status", Buffer.from(command.action));
    await preview.worker.runOnce();
    assert.equal((await second.command(owner, command.id)).state, "observed");
    checks.push(
      "native conflicting request serialization, one fake publication and cross-pool reconciliation",
    );
    await assert.rejects(
      scoped(pool, owner, async (c) => {
        await c.query(
          "INSERT INTO homeauto_online.rooms(household_id,room_id,name,name_key,version) VALUES($1,'rollback-probe','Rollback','rollback',1)",
          [data.household],
        );
        throw new Error("injected rollback");
      }),
    );
    const rows = await scoped(secondPool, owner, (c) =>
      c.query(
        "SELECT room_id FROM homeauto_online.rooms WHERE room_id='rollback-probe'",
      ),
    );
    assert.equal(rows.rows.length, 0);
    checks.push("native transaction rollback visible from independent pool");
    await auth.logout(cookie.split("=")[1]);
    assert.equal(await auth.actor(cookie.split("=")[1]), null);
    checks.push("native logout revocation");
    return {
      result: "passed",
      checks,
      controller_report_elapsed_ms: Date.now() - started,
      hardware_publications: 0,
      synthetic_mqtt_publications: preview.publications.length,
      hosted_vercel_tested: false,
    };
  } finally {
    await preview?.stop();
    try {
      if (seeded) await clean(admin, data);
    } finally {
      await Promise.allSettled([admin.end(), pool.end(), secondPool.end()]);
    }
  }
}
if (require.main === module)
  main()
    .then((result) => console.log(JSON.stringify(result)))
    .catch(() => {
      console.error(
        "Native online staging check failed or was not authorized. Check the approved empty target and preserve private logs; no secret is printed.",
      );
      process.exitCode = 1;
    });
module.exports = { main, stagingTarget };
