const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createPool, scoped } = require("../online/db");
const {
  migrateOnline,
  migrationSQL,
  onlineGrants,
} = require("../online/migrate");
const { passwordHash, hash } = require("../online/auth");
const { text, uuid } = require("../lib/errors");
const { inspectFile } = require("../cloud/sqlite-inspect");
function requireUuid(value) {
  if (!uuid(value)) throw new Error("A valid UUID is required");
  return value;
}
function privateOutput(filename) {
  const target = path.resolve(filename || "");
  const root = path.resolve(__dirname, "../..");
  const relative = path.relative(root, target);
  if (
    !relative.startsWith(".." + path.sep) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  )
    throw new Error("Credential output must be outside the source workspace");
  if (fs.existsSync(target))
    throw new Error("Credential output already exists");
  return target;
}
async function operate(client, command, args, env = process.env) {
  const setScope = async (household) => {
    requireUuid(household);
    await client.query(
      "SELECT set_config('homeauto.household_id',$1,true),set_config('homeauto.user_id','',true),set_config('homeauto.gateway_id','',true)",
      [household],
    );
  };
  if (command === "household" && args.length === 1) {
    const id = crypto.randomUUID();
    await client.query(
      "INSERT INTO homeauto_online.households(household_id,name) VALUES($1,$2)",
      [id, text(args[0], 60)],
    );
    return { household_id: id };
  }
  if (command === "create-user" && args.length === 4) {
    const [household, username, display, role] = args;
    requireUuid(household);
    if (!["owner", "resident", "viewer"].includes(role))
      throw new Error("Invalid role");
    const encoded = await passwordHash(env.HOMEAUTO_CLOUD_OPERATOR_PASSWORD);
    const user = crypto.randomUUID();
    await client.query(
      "INSERT INTO homeauto_online.users(user_id,username,display_name,password_hash) VALUES($1,$2,$3,$4)",
      [user, text(username).toLowerCase(), text(display), encoded],
    );
    await client.query(
      "INSERT INTO homeauto_online.memberships(household_id,user_id,role) VALUES($1,$2,$3)",
      [household, user, role],
    );
    await client.query(
      "INSERT INTO homeauto_online.audit_events(household_id,user_id,action,success) VALUES($1,$2,'operator_create_user',true)",
      [household, user],
    );
    return { user_id: user, household_id: household, role };
  }
  if (command === "membership" && args.length === 3) {
    const [household, username, role] = args;
    requireUuid(household);
    if (!["owner", "resident", "viewer", "disabled"].includes(role))
      throw new Error("Invalid role");
    const user = (
      await client.query(
        "SELECT user_id FROM homeauto_online.users WHERE username=$1 FOR UPDATE",
        [text(username).toLowerCase()],
      )
    ).rows[0];
    if (!user) throw new Error("User not found");
    await client.query(
      "INSERT INTO homeauto_online.memberships(household_id,user_id,role,active) VALUES($1,$2,$3,$4) ON CONFLICT(household_id,user_id) DO UPDATE SET role=EXCLUDED.role,active=EXCLUDED.active",
      [
        household,
        user.user_id,
        role === "disabled" ? "viewer" : role,
        role !== "disabled",
      ],
    );
    await client.query(
      "DELETE FROM homeauto_online.sessions WHERE household_id=$1 AND user_id=$2",
      [household, user.user_id],
    );
    return { updated: true };
  }
  if (command === "reset-password" && args.length === 1) {
    const encoded = await passwordHash(env.HOMEAUTO_CLOUD_OPERATOR_PASSWORD);
    const user = (
      await client.query(
        "UPDATE homeauto_online.users SET password_hash=$2 WHERE username=$1 RETURNING user_id",
        [text(args[0]).toLowerCase(), encoded],
      )
    ).rows[0];
    if (!user) throw new Error("User not found");
    await client.query(
      "DELETE FROM homeauto_online.sessions WHERE user_id=$1",
      [user.user_id],
    );
    await client.query(
      "INSERT INTO homeauto_online.audit_events(user_id,action,success) VALUES($1,'operator_reset_password',true)",
      [user.user_id],
    );
    return { password_reset: true, sessions_revoked: true };
  }
  if (command === "disable-user" && args.length === 1) {
    const user = (
      await client.query(
        "UPDATE homeauto_online.users SET disabled=true WHERE username=$1 RETURNING user_id",
        [text(args[0]).toLowerCase()],
      )
    ).rows[0];
    if (!user) throw new Error("User not found");
    await client.query(
      "DELETE FROM homeauto_online.sessions WHERE user_id=$1",
      [user.user_id],
    );
    return { disabled: true };
  }
  if (
    (command === "enroll-gateway" && args.length === 2) ||
    (command === "rotate-gateway-key" && args.length === 3)
  ) {
    const household = requireUuid(args[0]),
      gateway =
        command === "enroll-gateway"
          ? crypto.randomUUID()
          : requireUuid(args[1]);
    const target = privateOutput(args.at(-1));
    if (command === "enroll-gateway")
      await client.query(
        "INSERT INTO homeauto_online.gateways(household_id,gateway_id) VALUES($1,$2)",
        [household, gateway],
      );
    const registered = (
      await client.query(
        "SELECT gateway_id FROM homeauto_online.gateways WHERE household_id=$1 AND gateway_id=$2 AND revoked_at IS NULL",
        [household, gateway],
      )
    ).rows[0];
    if (!registered) throw new Error("Active gateway not found");
    const keys = (
      await client.query(
        "SELECT count(*)::int n FROM homeauto_online.gateway_keys WHERE gateway_id=$1 AND revoked_at IS NULL AND expires_at>now()",
        [gateway],
      )
    ).rows[0].n;
    if (keys >= 2) throw new Error("Revoke an old key before adding another");
    const token = crypto.randomBytes(32).toString("hex"),
      key = crypto.randomUUID();
    const result = (
      await client.query(
        "INSERT INTO homeauto_online.gateway_keys(key_id,household_id,gateway_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '30 days') RETURNING expires_at",
        [key, household, gateway, hash(token)],
      )
    ).rows[0];
    // Exclusive private output is retained if COMMIT has an uncertain outcome.
    fs.writeFileSync(
      target,
      JSON.stringify(
        {
          household_id: household,
          gateway_id: gateway,
          key_id: key,
          gateway_token: token,
          expires_at: new Date(result.expires_at).toISOString(),
          activation:
            "Verify the database operation committed before configuring this key.",
        },
        null,
        2,
      ),
      { flag: "wx", mode: 0o600 },
    );
    return {
      household_id: household,
      gateway_id: gateway,
      key_id: key,
      credential_file_written: true,
      expires_at: result.expires_at,
    };
  }
  if (command === "revoke-key" && args.length === 1) {
    const result = await client.query(
      "UPDATE homeauto_online.gateway_keys SET revoked_at=now() WHERE key_id=$1 RETURNING key_id",
      [requireUuid(args[0])],
    );
    if (!result.rows.length) throw new Error("Key not found");
    return { revoked: true };
  }
  if (command === "revoke-gateway" && args.length === 2) {
    const [household, gateway] = args.map(requireUuid);
    await setScope(household);
    const existing = await client.query(
      "UPDATE homeauto_online.gateways SET revoked_at=now() WHERE household_id=$1 AND gateway_id=$2 RETURNING gateway_id",
      [household, gateway],
    );
    if (!existing.rows.length) throw new Error("Gateway not found");
    await client.query(
      "UPDATE homeauto_online.gateway_keys SET revoked_at=now() WHERE household_id=$1 AND gateway_id=$2",
      [household, gateway],
    );
    await client.query(
      "UPDATE homeauto_online.commands SET state=CASE WHEN state='pending_observation' THEN 'uncertain' ELSE 'rejected' END,error_code='GATEWAY_REVOKED',finished_at=now() WHERE household_id=$1 AND state IN('queued','delivered','pending_observation')",
      [household],
    );
    return { revoked: true };
  }
  if (command === "quarantine" && args.length === 1) {
    const household = requireUuid(args[0]);
    await setScope(household);
    const exists = await client.query(
      "SELECT household_id FROM homeauto_online.households WHERE household_id=$1",
      [household],
    );
    if (!exists.rows.length) throw new Error("Household not found");
    await client.query(
      "DELETE FROM homeauto_online.sessions WHERE household_id=$1",
      [household],
    );
    await client.query(
      "UPDATE homeauto_online.gateway_keys SET revoked_at=now() WHERE household_id=$1 AND revoked_at IS NULL",
      [household],
    );
    await client.query(
      "UPDATE homeauto_online.commands SET state=CASE WHEN state='pending_observation' THEN 'uncertain' ELSE 'rejected' END,error_code='OPERATOR_QUARANTINE',finished_at=now() WHERE household_id=$1 AND state IN('queued','delivered','pending_observation')",
      [household],
    );
    await client.query(
      "DELETE FROM homeauto_online.intents WHERE household_id=$1",
      [household],
    );
    await client.query(
      "DELETE FROM homeauto_online.gateway_tickets WHERE household_id=$1",
      [household],
    );
    await client.query(
      "INSERT INTO homeauto_online.audit_events(household_id,action,success) VALUES($1,'operator_quarantine',true)",
      [household],
    );
    return {
      quarantined: true,
      sessions_revoked: true,
      gateway_keys_revoked: true,
    };
  }
  if (command === "maintain-global" && args.length === 0) {
    await client.query("SELECT homeauto_online.prune_global()");
    return { global_retention_pass: true };
  }
  if (command === "maintain" && args.length === 1) {
    await setScope(args[0]);
    await client.query("SELECT homeauto_online.prune_household($1)", [args[0]]);
    return { retention_pass: true };
  }
  throw new Error("Unsupported operator command or arguments");
}
async function main(
  args = process.argv.slice(2),
  env = process.env,
  { poolFactory = createPool } = {},
) {
  const [command, ...rest] = args;
  if (command === "plan" && !rest.length) {
    process.stdout.write(migrationSQL());
    return;
  }
  if (command === "grants" && rest.length === 1) {
    process.stdout.write(onlineGrants(rest[0]) + "\n");
    return;
  }
  if (command === "inspect-sqlite" && rest.length === 1) {
    const { report } = await inspectFile(path.resolve(rest[0]));
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (rest.at(-1) !== "--apply" || env.HOMEAUTO_ONLINE_ADMIN_APPROVED !== "1")
    throw new Error("Explicit administrative target authorization is required");
  let url;
  try {
    url = new URL(env.DATABASE_URL_UNPOOLED);
  } catch {
    throw new Error("A direct administrative PostgreSQL URL is required");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname.includes("-pooler") ||
    !env.HOMEAUTO_EXPECTED_DATABASE ||
    decodeURIComponent(url.pathname.slice(1)) !== env.HOMEAUTO_EXPECTED_DATABASE
  )
    throw new Error(
      "The database target must match the approved direct database",
    );
  const pool = poolFactory(env.DATABASE_URL_UNPOOLED);
  try {
    if (command === "migrate" && rest.length === 1)
      return await migrateOnline(pool);
    const client = await pool.connect();
    let broken = false;
    try {
      await client.query("BEGIN");
      const owned = (
        await client.query(
          "SELECT n.nspowner=r.oid AS owned FROM pg_namespace n JOIN pg_roles r ON r.rolname=current_user WHERE n.nspname='homeauto_online'",
        )
      ).rows[0]?.owned;
      if (!owned)
        throw new Error("Use the reviewed schema-owner operator role");
      const result = await operate(client, command, rest.slice(0, -1), env);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        broken = true;
      }
      throw error;
    } finally {
      client.release(broken);
    }
  } finally {
    await pool.end();
  }
}
if (require.main === module)
  main()
    .then((result) => {
      if (result) console.log(JSON.stringify(result));
    })
    .catch(() => {
      console.error(
        "Operator action failed or was not authorized. Preserve any credential output and inspect the approved target before retrying. Secrets are not logged.",
      );
      process.exitCode = 1;
    });
module.exports = { main, operate, privateOutput };
