const crypto = require("crypto");
const { PGlite } = require("@electric-sql/pglite");
const { migrateOnline, onlineGrants } = require("../../online/migrate");
const { passwordHash } = require("../../online/auth");
const household = "10000000-0000-4000-8000-000000000001",
  otherHousehold = "10000000-0000-4000-8000-000000000002",
  gateway = "20000000-0000-4000-8000-000000000001",
  otherGateway = "20000000-0000-4000-8000-000000000002";
const owner = "30000000-0000-4000-8000-000000000001",
  viewer = "30000000-0000-4000-8000-000000000002",
  otherOwner = "30000000-0000-4000-8000-000000000003";
const password = "synthetic-fixture-password",
  token = "a".repeat(64),
  otherToken = "b".repeat(64);
async function onlineFixture() {
  const db = new PGlite();
  await db.waitReady;
  let tail = Promise.resolve();
  const rawQuery = async (sql, args = []) =>
    args.length || !sql.includes(";")
      ? db.query(sql, args)
      : (await db.exec(sql), { rows: [] });
  const connect = async () => {
    const prior = tail;
    let done;
    tail = new Promise((resolve) => (done = resolve));
    await prior;
    return { query: rawQuery, release: done };
  };
  const pool = {
    connect,
    query: async (sql, args = []) => {
      const c = await connect();
      try {
        return await c.query(sql, args);
      } finally {
        c.release();
      }
    },
    end: async () => {},
  };
  await migrateOnline(pool);
  const encoded = await passwordHash(password);
  for (const [id, name] of [
    [household, "Fixture home"],
    [otherHousehold, "Other fixture"],
  ])
    await db.query(
      "INSERT INTO homeauto_online.households(household_id,name) VALUES($1,$2)",
      [id, name],
    );
  for (const [id, name] of [
    [owner, "cloud-owner"],
    [viewer, "cloud-viewer"],
    [otherOwner, "other-owner"],
  ])
    await db.query(
      "INSERT INTO homeauto_online.users(user_id,username,display_name,password_hash) VALUES($1,$2,$2,$3)",
      [id, name, encoded],
    );
  for (const [home, user, role] of [
    [household, owner, "owner"],
    [household, viewer, "viewer"],
    [otherHousehold, otherOwner, "owner"],
  ])
    await db.query(
      "INSERT INTO homeauto_online.memberships(household_id,user_id,role) VALUES($1,$2,$3)",
      [home, user, role],
    );
  for (const [home, id, key] of [
    [household, gateway, token],
    [otherHousehold, otherGateway, otherToken],
  ]) {
    await db.query(
      "INSERT INTO homeauto_online.gateways(household_id,gateway_id) VALUES($1,$2)",
      [home, id],
    );
    await db.query(
      "INSERT INTO homeauto_online.gateway_keys(key_id,household_id,gateway_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '30 days')",
      [
        crypto.randomUUID(),
        home,
        id,
        crypto.createHash("sha256").update(key).digest("hex"),
      ],
    );
  }
  await db.exec(
    `CREATE ROLE homeauto_online_fixture NOLOGIN NOSUPERUSER NOBYPASSRLS;${onlineGrants("homeauto_online_fixture")} SET ROLE homeauto_online_fixture;`,
  );
  const admin = async (fn) => {
    await tail;
    await db.exec("RESET ROLE");
    try {
      return await fn(db);
    } finally {
      await db.exec("SET ROLE homeauto_online_fixture");
    }
  };
  return {
    db,
    pool,
    admin,
    close: () => db.close(),
    household,
    otherHousehold,
    gateway,
    otherGateway,
    owner,
    viewer,
    otherOwner,
    password,
    token,
    otherToken,
  };
}
module.exports = {
  onlineFixture,
  household,
  otherHousehold,
  gateway,
  otherGateway,
  owner,
  viewer,
  otherOwner,
  password,
  token,
  otherToken,
};
