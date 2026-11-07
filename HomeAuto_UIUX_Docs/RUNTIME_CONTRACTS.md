# HomeAuto — implemented contracts, revision 4

Backend extension2026-11-06: existing local fields/routes remain compatible. Owner GET /api/system adds cloud_sync diagnostics; optional consented catalog replication has its own version1 protocol, separate API and PostgreSQL adapter. Local device/session/voice authority is unchanged and cloud sync defaults off. See docs/backend/API_CONTRACTS.md and IMPLEMENTATION_TRACKER.md; no cloud physical-control route or browser database credential exists. Simulator cloud settings are forced off.

This document records deliberate differences from the retained revision-3 design
specifications. `server/app.js` and the active modules are the implementation
source of truth. All private data APIs require a session. Mutations additionally
require a same-origin Origin, JSON and `X-CSRF-Token`; bodies are capped at 16 KiB.
Login and loopback setup status are narrow exceptions. No permissive CORS exists.

| Area | Implemented behavior |
|---|---|
| Runtime | Injectable `createApp`, `startRuntime` and `stop`; imports have no DB/listener/broker/model effects. One synchronous DB writer; isolated workers. |
| Identity | Console users; owner/resident/viewer plus `can_unlock`; 8h absolute/30m idle; scrypt; SHA256 token storage; reauth rotates token and grants 5m freshness; restart invalidates sessions. |
| Registry | Seven immutable hardware IDs; editable names/room assignment; five backfilled rooms; unsupported provisioning/deletion rejected. |
| Commands | POST `/api/devices/:id/command` with action, UUID idempotency key and unlock confirmation when applicable; 202 except already-reported 200. GET `/api/commands/:id` exposes owned/owner records. |
| Lifecycle | accepted → published → observed or uncertain. Observed means matching fresh controller report within 8s light/3s door; no wire correlation ID or physical sensor. `physical_verified:false`. |
| Delivery | QoS 0, retain false for all command topics, clean session, no offline queue. Remote MQTT requires TLS; auth credentials mandatory. No reconnect/restart action replay. |
| Freshness | Broker connection plus live board evidence ≤60s; nonretained current-epoch device report ≤65s (gas ≤10s). Retained messages remain history. PIR clear expires; denied is an event. |
| Door | Disabled unless explicit operator gate. Manual unlock needs fresh password and a session-bound, single-use 30s challenge. Voice/text unlock is refused. RFID grants use the same service and gate, durably logged before publish. |
| Realtime | One upgrade dispatcher for `/ws` and `/voice`; Origin/session checked; session expiry/revocation closes sockets. Device stream sends authoritative full `init` snapshots with epoch and per-connection sequence after every change, rather than revision-3 delta events. No transcript broadcast. |
| Client sync | One store, guarded fetch revision, stale socket exclusion and sequence checks. Reconnect fetches latest state. No browser command queue. Activity pagination remains stable until explicit Refresh. |
| Metadata | Rooms CRUD, device metadata PUT and home/preference updates use versions. Room creates use actor/key idempotency. Names are normalized, bounded plain text; RFID UID canonical 4/7/10-byte hex. |
| Alerts | Persistent gas/motion episodes; per-user read/ack receipts. Ack does not resolve. Fresh sensor normal resolves. Browser notifications only for supported gas/motion categories while app is connected. No delivery guarantee when closed. |
| Activity | `/api/activity` filters category, device, event type, from/to, q and cursor before bounded page selection. q matches event type/device ID. Owners may see UID/owner fields; other roles have those fields removed. Historical audit kept. |
| Assistant | `/api/assistant/interpret` returns session-bound 30s intent; execute is separate and idempotent. Bilingual deterministic grammar; unknown/negative/conflicting targets rejected. Queries require no action. No LLM. |
| Capture | Single-use 30s voice ticket, text start/end/cancel plus binary little-endian 16-bit 16k mono PCM; ≤3200-byte frames, ≤20s utterance. Native worker receives complete bounded utterance. |
| Voice review | Recognized control requests require a review dialog before execute. Queries may answer directly. This follows measured recognition limitations. Tap starts capture; optional wake prefix applies only inside the tapped utterance. |
| Speech | Vosk en/hi + Kokoro af_heart/hf_alpha CPU. Streamed SHA256 asset verification then native load/probe. Audio jobs owned by user, expire 60s, no-store WAV; input audio/transcripts remain RAM-only. One global speech job; 30s timeout. |
| Local AI | Owner sees installed fixed profiles and can confirm their loaded readiness after reauth. No dynamic provider switch/import/upload endpoint or rollback promise. Operator installs pinned files. Model table records verified installed profiles. |
| Storage | Additive schema v5 consolidates planned M01–M05. Old devices/cards/activity retained. Atomic temp/fsync/backup/rename; failure restores memory and fails writes. Daily backups/retention; sessions and pending actions invalidated on restart. |
| Offline | All shell assets, dictionaries, help, fonts/icons and inference local. Browser must reach hub over LAN. Manifest provided; no service worker/API/audio cache and no claimed browser-offline shell. |

Canonical methods/fields are readable in `server/app.js`; unknown API routes
return structured JSON 404. The old route modules and voice handlers are
unmounted. Do not start them directly or reintroduce their insecure APIs.

Hardware topics/payloads remain exactly numeric legacy topics, not JSON command
envelopes. No ESP32 source or pin was modified. Authenticated TLS firmware and
nonblocking/prioritized door relock remain an explicit build/hardware gate.
