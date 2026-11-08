const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PGlite } = require("@electric-sql/pglite");
const { poolOptions } = require("../cloud/postgres");
const { migrations, migrateOnline } = require("../online/migrate");
const { onlineFixture } = require("./helpers/online-fixture");
test("Neon routing options and system trust do not permit TLS downgrade or SQL startup injection", () => {
  const settings = poolOptions(
    "postgresql://runtime:synthetic@branch.invalid/home?sslmode=require&channel_binding=require&options=endpoint%3Dep-synthetic-123&sslrootcert=system",
  );
  assert.equal(settings.options, "endpoint=ep-synthetic-123");
  assert.deepEqual(settings.ssl, { rejectUnauthorized: true });
  assert.equal(settings.connectionString, undefined);
  for (const query of [
    "options=-c%20row_security%3Doff",
    "options=endpoint%3Dep-test%20-c%20search_path%3Devil",
    "sslrootcert=/private/ca.pem",
    "sslkey=/private/key",
    "options=endpoint%3Dep-one&options=endpoint%3Dep-two",
  ])
    assert.throws(() =>
      poolOptions(
        "postgresql://runtime:synthetic@branch.invalid/home?" + query,
      ),
    );
});
test("forward migration preserves version1 data and moves bounded cleanup off the rate-limit hot path", async () => {
  const db = new PGlite();
  await db.waitReady;
  const query = async (sql, args = []) =>
    args.length || !sql.includes(";")
      ? db.query(sql, args)
      : (await db.exec(sql), { rows: [] });
  const pool = { connect: async () => ({ query, release() {} }) };
  try {
    const first = migrations()[0];
    await db.exec(first.sql);
    await db.exec(
      "CREATE TABLE public.homeauto_online_migrations(version integer PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    await db.query(
      "INSERT INTO public.homeauto_online_migrations(version,checksum) VALUES(1,$1)",
      [first.checksum],
    );
    await db.query(
      "INSERT INTO homeauto_online.households(household_id,name) VALUES('10000000-0000-4000-8000-000000000011','Preserved fixture')",
    );
    await db.exec(
      "INSERT INTO homeauto_online.rate_limits(bucket,count,window_until) VALUES('expired',2,now()-interval '2 days')",
    );
    const result = await migrateOnline(pool);
    assert.deepEqual(result.applied_versions, [2, 3, 4]);
    assert.equal(result.version, 4);
    assert.equal(
      (await db.query("SELECT name FROM homeauto_online.households")).rows[0]
        .name,
      "Preserved fixture",
    );
    assert.equal((await migrateOnline(pool)).applied, false);
    assert.equal(
      (
        await db.query(
          "SELECT homeauto_online.take_limit('fresh',1,60) allowed",
        )
      ).rows[0].allowed,
      true,
    );
    assert.equal(
      (
        await db.query(
          "SELECT homeauto_online.take_limit('fresh',1,60) allowed",
        )
      ).rows[0].allowed,
      false,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM homeauto_online.rate_limits WHERE bucket='expired'",
        )
      ).rows[0].n,
      1,
    );
    await db.query("SELECT homeauto_online.prune_global()");
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM homeauto_online.rate_limits WHERE bucket='expired'",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count FROM homeauto_online.rate_limits WHERE bucket='fresh'",
        )
      ).rows[0].count,
      2,
    );
    await db.exec(
      "UPDATE public.homeauto_online_migrations SET checksum='tampered' WHERE version=1",
    );
    await assert.rejects(migrateOnline(pool), /checksum/);
  } finally {
    await db.close();
  }
});
test("runtime role cannot invoke global maintenance", async () => {
  const fixture = await onlineFixture();
  try {
    await assert.rejects(
      fixture.pool.query("SELECT homeauto_online.prune_global()"),
    );
  } finally {
    await fixture.close();
  }
});
test('browser launch failure closes its disposable cloud fixture',async()=>{
 const {launchBrowserForPreview}=require('../scripts/online-browser-check');let closed=0;
 await assert.rejects(launchBrowserForPreview({stop:async()=>{closed++;}},async()=>{throw new Error('synthetic launch failure');}),/synthetic launch failure/);
 assert.equal(closed,1);
});
