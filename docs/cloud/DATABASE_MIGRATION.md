# Database migration and preservation

Signup adds003_self_service_signup.sql after the unchanged001/002 files. It adds only the registration function; existing identities and household/device data remain. Reapply the reviewed runtime grants after this migration. Deploy the schema2/3-compatible application first, then apply003 and grants atomically. Registration is unavailable until that step; existing sign-in remains compatible during rollout. The ledger checksum, role/RLS checks and snapshot/target verification still apply.

Publication verification adds forward migration002_bounded_maintenance.sql;
001 is unchanged. The runner verifies both checksums/versions, installs missing
migrations atomically and refuses unknown or altered history. Reapply reviewed
runtime grants after upgrade; readiness now requires schema2. Version2 changes
only expiry indexing/functions/maintenance privileges, not household/device or
command data. On an authorized private maintenance scheduler, run the guarded
operator command `maintain-global --apply` hourly; each pass deletes at most
5,000 expired throttle and audit records. It is not run per browser/gateway
request. Large backlogs may need repeated reviewed maintenance. Existing counter
writes/polling still keep active compute awake; this is not a scale-to-zero claim.

No live household data was migrated. SQLite remains the operational store for local identity, RFID, commands, voice, rooms and offline operation. Cloud accounts are explicitly created, not silently copied from local passwords. Cloud data is an approved projection of current metadata/reports, plus new online account/request records.

## Source inventory and dry run

`node server/scripts/online-operator.js inspect-sqlite PATH_TO_BACKUP` reads a supported schema 0/5 backup with query-only SQLite, verifies integrity/foreign keys, seven device IDs, booleans/timestamps and table checksums, and prints counts/issues without row contents or credentials. Use a reviewed backup. The existing `server/scripts/cloud.js export-catalog BACKUP OUTPUT --consent=catalog-v1` produces a validated catalog dry run; see [existing migration mapping](../backend/MIGRATION_PLAN.md). It does not import household users, card identifiers, audio or old physical commands.

Cloud enrollment uploads the gateway's validated catalog into normalized rooms/devices in one transaction, with scoped keys and versions. Repeated identical catalogs do not create duplicates. Device reports are newly qualified using the current upload ticket and relative age; old SQLite hardware state is not imported as current. Existing local history remains local. Bulk historical/account migration is intentionally not implemented or required for this initial topology.

## Reviewed PostgreSQL installation

1. Separately approve an empty/schema-only staging Neon branch. Keep production and preview databases separate. Confirm the target database name and branch in the platform; a matching database name alone does not identify a branch.
2. Inspect `node server/scripts/online-operator.js plan` and `grants homeauto_online_api`. These are read-only SQL outputs, not a deployment.
3. In a private operator environment set `DATABASE_URL_UNPOOLED`, `HOMEAUTO_EXPECTED_DATABASE` and `HOMEAUTO_ONLINE_ADMIN_APPROVED=1`. Do not expose this owner URL in Vercel runtime or gateway configuration.
4. Run `node server/scripts/online-operator.js migrate --apply` only against that approved target. Migration obtains an advisory lock, applies DDL and its SHA-256 ledger in one transaction. Repeated runs are no-ops; altered applied SQL is refused. Add a new numbered migration for future schema changes.
5. Create a dedicated LOGIN role without superuser/BYPASSRLS/owner membership. Configure its password privately, then apply the reviewed grants output with the schema owner. For example, a reviewed `CREATE ROLE homeauto_online_api LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT` followed by interactive `psql` `\password homeauto_online_api` avoids a password literal in source/history. Verify CONNECT permissions for the target database. Never grant the runtime the owner role.
6. Put that role's **pooled** URL in the deployment's `DATABASE_URL`. The default integration owner URL may be useful to the operator, but the API deliberately rejects it. Run all staging gates before repeating the separately approved procedure for production.

## Verification and rollback

Disposable tests cover idempotent migration, forced RLS, private tables, rollback on transaction failure and interruption before the migration ledger commits. Gateway catalogs, event IDs, sequence/digest and command idempotency are independently verified. No migration executes on function cold start.

Before a real upgrade, record branch identity, schema checksum, counts, grants and a tested restore point. Retain the prior deployment. Roll back the application first with both remote-light gates OFF; do not drop live schema/data as an automatic rollback. For database restore/PITR, follow [quarantine and recovery](SYNC_AND_RECOVERY.md) before re-enabling any cloud request. Never restore consumed commands into a fresh gateway journal and let them run.
