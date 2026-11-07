# HomeAuto backend engineering — 2026-11-06

Selected architecture: **local-first hub with an optional outbound PostgreSQL metadata mirror**. This assignment does not cut over the household database or deploy infrastructure. The local HTTP/WebSocket/MQTT/auth/voice paths retain their existing contracts. PostgreSQL is not a replacement for the synchronous sql.js repository.

## Implementation order and acceptance targets

1. Preserve the frontend handoff and 21 audit dispositions; inventory active backend contracts.
2. Verify official Neon capabilities; retain local identity and native speech.
3. Add a strictly validated catalog protocol, opt-in durable SQLite journal, bounded outbound worker, separate authenticated cloud API and transactional PostgreSQL adapter.
4. Add versioned SQL migrations, least-privilege grants, read-only SQLite inspection/transformation and disposable-data verification tools.
5. Run real SQL tests with disposable PGlite, mocked network/pool faults and existing local regression suites. Never use live MQTT, models, credentials or household writes.
6. Document deployment/recovery gates and actual evidence.

Before measurement: target one coalesced pending snapshot, maximum 32 KiB per operation, at most 100 rooms and exactly seven known devices. Metadata changes enqueue atomically with their local transaction; telemetry must enqueue zero operations. Target 100 synthetic metadata edits and their local journal writes within 10 seconds on this workstation; this is a fixture benchmark, not a household SLA. Bound upload to 5 seconds and pool acquisition to 3 seconds; offline failures must not reject local API work. Duplicate delivery must have one logical effect. Tenant tests must use a non-owner, non-superuser PostgreSQL role.

## Scope and authority

Cloud consent covers home name, room IDs/names/order/versions and device IDs/names/type/room/versions only. This reveals household organization and is disabled by default. Local users, preferences, hardware reports, sensor data, commands, RFID, alerts, activity, sessions, voice and secrets stay local. Theme remains browser-local. Remote metadata editing and physical commands are not part of this protocol.

The implementation tracker records each delivered phase and remaining staging/physical gates. Architecture, schema, sync, migration, API, security, deployment, test and recovery documents in this directory explain the exact implemented boundary. Existing HomeAuto_UIUX_Docs revision-4 contracts and docs/REMEDIATION_TRACKER.md remain authoritative for retained local behavior.
