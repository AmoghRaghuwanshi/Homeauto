const { createPool } = require("../cloud/postgres");
class OnlineError extends Error {
  constructor(code, status = 400, message = code) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const fail = (code, status = 400, message) => {
  throw new OnlineError(code, status, message);
};
async function scoped(pool, actor, fn) {
  const client = await pool.connect();
  let begun = false,
    broken = false;
  try {
    await client.query("BEGIN");
    begun = true;
    await client.query(
      "SELECT set_config('homeauto.household_id',$1,true),set_config('homeauto.user_id',$2,true),set_config('homeauto.gateway_id',$3,true),set_config('lock_timeout','1000',true),set_config('statement_timeout','5000',true)",
      [actor.household_id, actor.user_id || "", actor.gateway_id || ""],
    );
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      actor.household_id,
    ]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (begun)
      try {
        await client.query("ROLLBACK");
      } catch {
        broken = true;
      }
    throw error;
  } finally {
    client.release(broken);
  }
}
async function assertOnlineRole(pool) {
  const { rows } = await pool.query(
    "SELECT r.rolsuper,r.rolbypassrls,EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='homeauto_online' AND (c.relowner=r.oid OR pg_has_role(r.oid,c.relowner,'MEMBER'))) AS owns_tables FROM pg_roles r WHERE r.rolname=current_user",
  );
  if (
    rows.length !== 1 ||
    rows[0].rolsuper ||
    rows[0].rolbypassrls ||
    rows[0].owns_tables
  )
    fail(
      "UNSAFE_DATABASE_ROLE",
      503,
      "Configure the restricted cloud runtime database role.",
    );
  const check = await pool.query(
    "SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='homeauto_online' AND c.relrowsecurity AND c.relforcerowsecurity",
  );
  if (check.rows[0]?.n !== 15)
    fail(
      "CLOUD_SCHEMA_REQUIRED",
      503,
      "Apply the reviewed cloud migrations before starting the API.",
    );
  const version = await pool.query(
    "SELECT max(version)::int version FROM public.homeauto_online_migrations",
  );
  if (version.rows[0]?.version !== 2)
    fail(
      "CLOUD_SCHEMA_REQUIRED",
      503,
      "Apply the reviewed cloud migrations before starting the API.",
    );
}
function loadOnlineConfig(env = process.env) {
  let base;
  try {
    base = new URL(
      env.APP_BASE_URL || (env.VERCEL_URL ? "https://" + env.VERCEL_URL : ""),
    );
  } catch {
    fail(
      "CLOUD_CONFIGURATION_REQUIRED",
      503,
      "Set APP_BASE_URL for this deployment.",
    );
  }
  if (
    base.protocol !== "https:" ||
    base.pathname !== "/" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    fail(
      "CLOUD_CONFIGURATION_REQUIRED",
      503,
      "APP_BASE_URL must be an HTTPS origin.",
    );
  const origins = new Set([base.origin]);
  for (const value of (env.ALLOWED_ORIGINS || "").split(",").filter(Boolean)) {
    let origin;
    try {
      origin = new URL(value);
    } catch {
      fail("CLOUD_CONFIGURATION_REQUIRED", 503);
    }
    if (origin.origin !== value || origin.protocol !== "https:")
      fail("CLOUD_CONFIGURATION_REQUIRED", 503);
    origins.add(origin.origin);
  }
  if (!env.DATABASE_URL)
    fail(
      "CLOUD_CONFIGURATION_REQUIRED",
      503,
      "Connect Neon and configure DATABASE_URL in the deployment environment.",
    );
  return {
    baseUrl: base.origin,
    origins,
    secure: true,
    allowCommands:
      env.HOMEAUTO_CLOUD_REMOTE_LIGHTS_ENABLED === "1" &&
      env.HOMEAUTO_REMOTE_LIGHTS_APPROVED === "1",
  };
}
module.exports = {
  OnlineError,
  fail,
  scoped,
  assertOnlineRole,
  loadOnlineConfig,
  createPool,
};
