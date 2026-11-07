# Online PostgreSQL schema

Implemented in `server/online/migrations/001_online.sql`; schema `homeauto_online`, migration ledger `public.homeauto_online_migrations`. This extends the existing local backend; it does not replace SQLite or the separate `homeauto_cloud` catalog mirror.

| Tables | Purpose |
|---|---|
| users, sessions | Private cloud password hashes, hashed session tokens, revocable rotation lineage and expiration; never imported local credentials |
| households, memberships | Named homes, retained event cursor high-water mark and owner/resident/viewer membership |
| gateways, gateway_keys | One enrolled gateway per household; heartbeat, epoch, sequence and private rotating key hashes |
| rooms, devices | Gateway-authoritative metadata; seven fixed hardware IDs, room relationships and versions |
| observations, observation_history | Latest qualified report and bounded change history; receipt time separate from report age |
| commands | Actor/session, immutable request identity, absolute light action, lease, expiry and evidence lifecycle |
| alerts, alert_receipts | Gas/motion warnings, separate per-user read/acknowledgment receipts |
| preferences | Versioned per-user/per-household favorites and assistant/notification settings |
| gateway_inbox, gateway_tickets | Event/sequence/digest deduplication and short-lived single-use upload admission |
| events, intents | Household event cursor and session-bound, short-lived typed assistant interpretation |
| rate_limits, audit_events | Shared throttling and sanitized authentication/operator audit records |

Primary/composite foreign keys enforce household/device/room/gateway relationships. Checks restrict device IDs/types, command actions and states, membership roles, expirations and positive versions. Unique actor/idempotency keys prevent duplicate creation; a partial unique index allows one active request per device. Queue, event cursor and retention indexes are checked in with the DDL.

Fifteen household tables enable and FORCE RLS. Personal preferences, intents and receipts also require the current user. Credentials and sessions have no direct runtime table grants. Narrow security-definer functions use fixed `pg_catalog` search paths and revoke PUBLIC execution. The schema owner has an explicit administrative policy; it must never be the API identity. `assertOnlineRole` refuses superuser, BYPASSRLS, direct table ownership or inherited owner membership and checks the forced-RLS table count.

Every household repository operation uses one checked-out client, a transaction, transaction-local scope settings and a household advisory lock. Parameterized SQL, bounded statement/lock/acquisition timeouts and rollback/release handling are implemented. Locks deliberately serialize a home's writes/read reconciliation; native concurrent load and PgBouncer behavior remain staging acceptance checks.

Retention is bounded to 5,000 deletions per table/pass: observation history 1 day, events/terminal commands 30 days, inbox 7 days, resolved alerts 90 days; expired intents/sessions are swept. Latest observations and gateway sequence high-water marks remain. Authentication audit pruning keeps 90 days. Gateway exchanges trigger periodic maintenance; an approved operator can run `maintain HOUSEHOLD_UUID --apply` for inactive homes. Monitor backlog/storage rather than assuming one pass drains an arbitrary backlog.

SQL/RLS/transactions run in disposable PGlite tests. Native Neon privileges, TLS, pooled connections, sustained load, backups and query plans have not been certified by these tests.
