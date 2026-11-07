# Database schema and ownership

## Existing local database

The original server/db/home_auto.db was rechecked read-only: user_version=0, 28,672 bytes, integrity OK, devices=7, RFID=0, activity=44. It was not opened with createRepository or migrated in place. Current repository schema is still version 5, with 17 application tables. Schema-0 migration remains additive and preserves legacy rows. It invalidates sessions/challenges and marks pending commands uncertain on a real repository restart.

Exact local DDL, added columns and indexes: server/db/repository.js. Exact runtime mutation rules: server/app.js and services/home.js. The dry-run inspector records every source table's columns/types/PKs/FKs, count and deterministic whole-table checksum without row contents. These source definitions are preferable to a second handwritten DDL copy.

| Local table | Key / relationship / authority |
| --- | --- |
| devices | Hardware ID PK, name/type/location/status/connectivity/timestamps, room FK, metadata version; seven fixed registry IDs |
| rooms | ID PK, normalized unique name_key, name/cover/order/version; local room organization |
| rfid_cards | UID PK, owner, authorized integer, created/version; private local authorization |
| activity_log | Integer auto ID, timestamp/device/event/details/actor/command/source; legacy history retained |
| users | UUID PK, unique username, display_name, scrypt hash, role CHECK owner/resident/viewer, unlock/disabled flags, created |
| sessions | Token-hash PK, user FK, creation/absolute-expiry/activity/reauth epoch milliseconds |
| commands | UUID PK, device/actor/action/source/state/key/hash/deadline/outcome; UNIQUE actor/key |
| device_observations | Device PK, reported status, received/epoch/retained/version; never physical verification |
| unlock_challenges | Token-hash PK, session/device/expiry/consumed; temporary and local |
| home_settings | Setting key PK, JSON value, version |
| user_preferences | User FK/PK, JSON value, version; theme additionally remains browser-local |
| alerts | ID PK, device/kind/severity/state/opened/seen/resolved/version |
| alert_receipts | Composite alert/user PK, both FKs, read/ack times; acknowledgment does not resolve a hazard |
| sensor_latest | Device PK, latest JSON/received time; raw local telemetry |
| model_assets | Asset PK, provider/version/path key/hash/size/license/verification/enabled |
| room_aliases | Alias/language UNIQUE, room FK, confirmed flag |
| idempotency_records | Scope/actor/key composite PK, request hash/response/expiry |

Existing indexes cover activity by device/id and commands by state. Local booleans use integers; local domain code validates mutations. Several inherited historical columns are intentionally not newly constrained by a destructive rebuild.

## Optional local journal extension

These three tables are created only when catalog-v1 consent and explicit sync configuration are enabled. They use their own schema_version=1 in cloud_sync_state; PRAGMA user_version remains 5. No network or cloud DDL is involved.

| Table | Structure / invariants |
| --- | --- |
| cloud_sync_state | Singleton PK CHECK=1, schema CHECK=1, immutable household/hub/consent, monotonic last_revision, last catalog hash, nullable capture_error |
| cloud_outbox | UUID operation PK, unique revision, canonical operation JSON, attempts/next-attempt/blocked/error; at most one coalesced full snapshot |
| cloud_inbox | Operation PK, revision/digest/status/ack epoch; latest 100 receipts retained |

The journal is part of the same SQLite transaction and atomic file export as a metadata edit. Snapshot removal means deletion from the optional cloud catalog, not deletion from authoritative local hardware records. Metadata too large or invalid for export records a capture error and removes stale queued data without rejecting the local edit.

## PostgreSQL mirror — schema version 1

Executable schema: server/cloud/migrations/001_catalog.sql. Migration checksum/version/applied_at are recorded in public.homeauto_cloud_migrations, under a transaction and advisory lock. Application tables live in a private homeauto_cloud schema. No UUID extension is needed.

| Table | Columns and constraints |
| --- | --- |
| households | household_id UUID PK; created_at timestamptz NOT NULL default now |
| hubs | household_id PK/FK households, hub_id UUID UNIQUE NOT NULL, enrolled_at NOT NULL, nullable revoked_at; UNIQUE household/hub; one writer per household |
| catalogs | household PK, hub UUID, safe-positive bigint revision, JSONB catalog object, received_at NOT NULL; composite household/hub FK |
| receipts | household/operation composite PK; household/hub/revision UNIQUE; digest lowercase SHA256 CHECK; accepted/stale status CHECK; received_at; composite household/hub FK |

All FKs use PostgreSQL's default NO ACTION; deletion is an explicit administrative/privacy operation. All four tables enable and force RLS using transaction-local household/hub scope. Runtime role gets SELECT on enrollment, SELECT/INSERT/UPDATE on catalogs and SELECT/INSERT on receipts. It cannot enroll hubs, revoke them, delete receipts or run schema changes. Startup rejects an owner, superuser, RLS-bypass role or missing forced-RLS tables.

Catalog JSON contains exactly home{name,version}, rooms[{id,name,sort_order,version}], devices[{id,name,type,room_id,version}]. server/cloud/protocol.js validates all fields, maximum lengths, known hardware IDs, room references, uniqueness and safe integer versions before SQL. This is an indivisible read model; duplicating rooms/devices as independent writable PostgreSQL entities would add an unnecessary second authority. JSON references are enforced by that validated write boundary, not relational FKs inside JSONB.

Commands, observations, alerts, activity, sessions, local users/memberships and preferences do not get duplicate cloud tables. Cloud hub enrollment authenticates machine-to-machine metadata; it does not authorize a resident or door action. Multi-household remote user administration is not an approved or implemented feature.

No partitioning is justified for a maximum 32-KiB catalog. PK/unique indexes serve ingest/read; receipts_received_idx supports administrative retention review. Receipts are retained to detect conflicting replay; any future compaction must introduce a durable revision floor before removing deduplication history. Monitor storage; do not silently prune it.
