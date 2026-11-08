const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const migrationFiles = ["001_online.sql", "002_bounded_maintenance.sql", "003_self_service_signup.sql", "004_gateway_onboarding.sql"];
const migrations = () =>
  migrationFiles.map((file, index) => {
    const sql = fs.readFileSync(
      path.join(__dirname, "migrations", file),
      "utf8",
    );
    return {
      version: index + 1,
      sql,
      checksum: crypto.createHash("sha256").update(sql).digest("hex"),
    };
  });
const migrationSQL = () =>
  migrations()
    .map((m) => m.sql)
    .join("\n");
async function migrateOnline(pool) {
  const plan = migrations(),
    appliedVersions = [];
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(787431902)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS public.homeauto_online_migrations(version integer PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const previous = await client.query(
      "SELECT version,checksum FROM public.homeauto_online_migrations ORDER BY version",
    );
    if (
      previous.rows.some(
        (row) =>
          !plan.some(
            (m) => m.version === row.version && m.checksum === row.checksum,
          ),
      )
    )
      throw new Error("Online migration checksum or version mismatch");
    for (const migration of plan) {
      if (previous.rows.some((row) => row.version === migration.version))
        continue;
      await client.query(migration.sql);
      await client.query(
        "INSERT INTO public.homeauto_online_migrations(version,checksum) VALUES($1,$2)",
        [migration.version, migration.checksum],
      );
      appliedVersions.push(migration.version);
    }
    await client.query("COMMIT");
    return {
      version: plan.at(-1).version,
      checksum: plan.at(-1).checksum,
      applied: !!appliedVersions.length,
      applied_versions: appliedVersions,
    };
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
}
function onlineGrants(role) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(role)) throw new Error("Invalid role");
  const r = '"' + role + '"';
  return `GRANT USAGE ON SCHEMA homeauto_online TO ${r};
GRANT SELECT ON homeauto_online.households,homeauto_online.memberships,homeauto_online.gateways TO ${r};
GRANT UPDATE(name,version,event_highwater) ON homeauto_online.households TO ${r};
GRANT UPDATE(epoch,last_sequence,last_seen_at,mqtt_connected,boards,catalog_digest) ON homeauto_online.gateways TO ${r};
GRANT SELECT,INSERT,UPDATE,DELETE ON homeauto_online.rooms TO ${r};
GRANT SELECT,INSERT,UPDATE,DELETE ON homeauto_online.gateway_tickets TO ${r};
GRANT SELECT,INSERT,UPDATE ON homeauto_online.devices,homeauto_online.observations,homeauto_online.commands,homeauto_online.alerts,homeauto_online.alert_receipts,homeauto_online.preferences,homeauto_online.intents TO ${r};
GRANT SELECT,INSERT ON homeauto_online.observation_history,homeauto_online.gateway_inbox,homeauto_online.events TO ${r};
GRANT USAGE ON SEQUENCE homeauto_online.observation_history_history_id_seq,homeauto_online.events_sequence_seq TO ${r};
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA homeauto_online TO ${r};
REVOKE EXECUTE ON FUNCTION homeauto_online.prune_global() FROM ${r};
GRANT SELECT ON public.homeauto_online_migrations TO ${r};`;
}
module.exports = { migrateOnline, migrationSQL, migrations, onlineGrants };
