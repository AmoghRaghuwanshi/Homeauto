# Migration and dry-run plan

There is **no wholesale SQLite-to-PostgreSQL cutover** in the selected architecture. Local identities, RFID, observations, commands, alerts, activity and preferences remain in SQLite, including all legacy records. Only the consented catalog has a PostgreSQL destination. Neither a generic import assistant nor a schema-version label proves a source is compatible.

## Implemented read-only preflight

From D:/homeauto-main/server:

```powershell
node scripts/cloud.js inspect X:/private-backups/household.db
node scripts/cloud.js plan
node scripts/cloud.js grants homeauto_catalog_runtime
```

These commands do not connect to a database service or migrate the source. Inspection reads at most a 100-MiB SQLite file into a private in-memory sql.js instance, enables query_only, checks header/integrity/FKs, accepts source versions 0 or 5, inventories every non-internal table and hashes every whole-table row set deterministically. It validates the seven hardware IDs, boolean domains and known timestamps. Version 5 also checks every required current table/column is present. Unsupported/incomplete data blocks catalog export; no automatic repairs, deduplication or credential rewriting occur.

For a source currently being written, obtain a stopped-hub or existing coherent backup first. The inspector compares bytes before/after its read and rejects a change, but this is not a distributed snapshot mechanism. Protect the report and backup with ACLs/encryption. The operator should verify the existing backup sidecar hash with scripts/recovery.js inspect before migration work. Creating a new backup through the normal repository opens/migrates that target; never point it at the protected original merely to inspect.

## Mapping

| Source data | Transformation / destination |
| --- | --- |
| Legacy device IDs | Preserve exact IDs; reject missing/duplicate/unknown registry IDs |
| Schema-0 locations | Registry room IDs plus deterministic SHA256-derived custom room IDs, matching local migration; sort_order=0/version=1 |
| Schema-5 rooms | Preserve ID/name/order/version; require every device room reference to exist |
| Device metadata | ID/name/type/room/version only; no status/connectivity/last_seen copied |
| Home name | Existing home_name setting/version or My home/version 1 for legacy source |
| SQLite booleans | Validate integer 0/1 in manifest; no implicit truthiness conversions; these records remain local |
| SQLite datetime strings | Validate UTC SQLite datetime form or explicit ISO timezone; normalize to UTC ISO when inspecting; epoch milliseconds remain local integers |
| PostgreSQL receipt time | Server-side timestamptz now(); not used to decide freshness or ordering |
| Local users/password hashes | Preserve original bytes locally; never rehash/import/upload credentials |
| RFID/activity/alerts/commands/sessions/models | Inventory counts/checksums only, retain original records locally; never export into the catalog |

Catalog schema enforces uniqueness and references. Duplicates or invalid timestamps are reported by table/column/row index without values. The tool never merges households, resolves ambiguous IDs or silently drops source rows. Extra local tables are inventoried and excluded from cloud. Full raw recovery remains a SQLite backup operation, not a cloud catalog download.

With separate consent for a **local file containing household names**, export explicitly:

```powershell
node scripts/cloud.js export-catalog X:/private-backups/household.db X:/private-output/catalog.json --consent=catalog-v1
```

Output uses exclusive creation and requested private file mode. This command does not upload or connect. Windows ACLs still require operator enforcement. The original source cannot be overwritten by an existing output path. Actual household catalog export/upload was not performed in this assignment.

## PostgreSQL migration and verification

DDL is versioned/checksummed in migrate.js; a single transaction and advisory lock wrap schema and marker. Repeating an identical migration is a no-op; checksum drift stops. Interrupted DDL rolls back both schema and marker in disposable PostgreSQL tests. Never edit an already applied SQL file; add a new numbered migration.

On a separately authorized empty development database/branch, use a direct TLS URL with --apply and HOMEAUTO_CLOUD_MIGRATION_APPROVED=1. Then separately create a restricted runtime LOGIN role, apply reviewed grants, enroll synthetic household/hub UUIDs and populate a private synthetic token registry. The application never creates these identities automatically. DEPLOYMENT_GUIDE.md gives the sequence.

Validation compares source file SHA256, all table counts/checksums before/after inspection, catalog checksum after PostgreSQL roundtrip, duplicate ingest results and preserved hardware IDs. Tests cover synthetic schemas 0/5, unknown versions, invalid booleans/timestamps, duplicate operations, wrong household, stale revisions and interruption. The original version-0 source was only inspected; its 44 historical events remain in place.

## Rollback

Before deploying source changes, retain the previous application and a verified private local backup. Cloud schema is additive and isolated. Disable sync before rolling back hub software; local commands never need the cloud. Do not delete/rewind a production branch to undo an API bug. Retain receipts/catalog for diagnosis and roll forward with a reviewed migration. Restoring an old local journal requires explicit revision reconciliation, described in RECOVERY_PLAN.md. No production cutover, restore, DB role creation or real cloud import has been executed.
