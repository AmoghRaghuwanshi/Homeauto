# Cloud implementation — 2026-11-07

This phase extends the previous optional metadata mirror into an authenticated cloud product. It preserves the local SQLite/MQTT/voice runtime. No account, resource, public deployment, DNS change, production migration or physical command is authorized by this code work.

## File and compatibility plan

Add server/online modules for normalized PostgreSQL DDL, durable cloud auth, household-scoped repositories, API handlers, gateway transport and operator tools. Add a small isolated cloud-runtime package and Vercel entrypoint/config, keeping native speech dependencies out of function bundles. Extend local lifecycle/repository only behind explicit gateway consent/configuration; simulator never inherits production gateway flags. Extend public API/state/views/i18n for cloud polling and truthful capabilities while preserving every local route/theme/navigation handler. No component tree or route is removed.

Keep the older server/cloud catalog implementation available for its existing tests/users. Do not run it concurrently with the new gateway for the same hub. New normalized tables use homeauto_online and their own migration history, not a destructive rewrite of SQLite or homeauto_cloud.

## Target

Custom-domain browser → Vercel static frontend and authenticated API → Neon/PostgreSQL → outbound local gateway polling → existing local MQTT → seven ESP32 device IDs. Reports return by authenticated bounded gateway exchanges. Cloud never connects to a household broker or assumes a public household IP.

Vercel supports WebSockets as of its2026-10-20 GA announcement. Connections are instance-pinned, close at max duration, and persistent state/fanout must be external. Selected initial transport: bounded two-second foreground browser/gateway polling over HTTPS, durable PostgreSQL event cursors and command leases, no in-memory shared state. Default Node Function duration is300s; higher limits depend on plan/runtime. We use short requests and a30s function budget, not an unbounded socket. [WebSockets](https://vercel.com/docs/functions/websockets), [limits](https://vercel.com/docs/functions/limitations), [GA announcement](https://vercel.com/changelog/websocket-support-is-now-generally-available).

The interval is a configuration/latency budget, not measured internet performance or an SLA. Deterministic isolation tests exercise reconnects and instance independence; actual Neon/Vercel latency/cost and TLS need staging. Continuous near-real-time polling prevents database scale-to-zero and has a cost; monitor it before production. A managed fanout service or WebSockets with a shared durable stream can replace transport later without changing command authority.

Remote on/off lighting is implemented for simulated tests and OFF by default in cloud and gateway. Door commands are always rejected remotely. Gas/motion stay read-only. Local hardware state and offline identity/voice remain authoritative at home; cloud identities are separate, explicitly provisioned accounts, never guest preview sessions or silently imported passwords.

## Implemented boundaries

`api/index.js` hosts the compatible Express cloud API; server/online contains versioned DDL, pg transactions, auth, scoped repositories, ticket/lease protocol and outbound gateway. Cloud identities/sessions/memberships, per-user preferences, alerts, events and requests are durable PostgreSQL data. Sessions keep a revocable rotation lineage; logout cannot be undone by an in-flight household switch. Household event high-water marks survive log retention. State is shared through PostgreSQL rather than per-function memory.

SQLite remains locally authoritative, with an opt-in gateway journal. Existing firmware IDs/topics/payloads and local auth/WebSocket/RFID/Vosk/Kokoro remain. Cloud room/device/home metadata is read-only and gateway-authoritative in this release; cloud preferences, favorites, alert receipts and account household switching are supported. Typed cloud requests use the same bounded bilingual intent grammar; voice/RFID/metadata editing explicitly direct users to the local hub. These are intentional capabilities, not decorative controls or unimplemented buttons.

The frontend selects mode via /api/runtime, preserves existing navigation/four themes and uses conservative age/cursor/session guards. Cloud unavailable, gateway offline, board offline, stale reports and pending/terminal commands are distinct. No cached browser hardware status grants control authority.

The root Vercel package is separate from the hub package. No native speech, MQTT client, SQLite runtime, models, certificates or household database enter the traced cloud function. No paid service, public resource, account, production migration or deployment was created. SQL and browser evidence is simulated; native/hosted/physical acceptance is still open.

## Handoff

Read [readiness](DEPLOYMENT_READINESS.md) first, then [schema](NEON_SCHEMA.md), [migration](DATABASE_MIGRATION.md), [Vercel/domain](VERCEL_DEPLOYMENT.md), [gateway](REALTIME_GATEWAY.md), [commands](COMMAND_LIFECYCLE.md), [security/auth](SECURITY_AND_AUTH.md), [recovery/monitoring](SYNC_AND_RECOVERY.md) and [tests](PRODUCTION_TESTS.md). The preceding [backend implementation](../backend/IMPLEMENTATION_TRACKER.md) remains historical context for the optional metadata mirror; this directory documents the new online product rather than replacing those reports. Original21 audit dispositions remain unchanged; physical firmware/TLS/broker/key gates remain open.
