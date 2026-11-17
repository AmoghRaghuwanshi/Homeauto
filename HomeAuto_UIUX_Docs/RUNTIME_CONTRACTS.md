> Hindi/chat/wake follow-up, 2026-11-15: automatic replies use actual recognized words, including Hindi under an English decoder hint. Manual mic and manually started conversation never require a wake word. Optional Settings wake listening accepts Shrimaan/Shreeman/Shiman and Hindi forms on visible pages, pauses during replies, and has a global Stop control. Reload preserves only the option, never silently starts the microphone. Live chat retains up to 40 turns in memory; home/account changes and refresh clear it. Browser provider/network limitations and physical confirmation rules remain. See docs/verification/BROWSER_VOICE_ASSISTANT.md for current behavior and isolated evidence.

> Current voice update, 2026-11-15: [browser conversation implementation](../docs/verification/BROWSER_VOICE_ASSISTANT.md). The user has replaced native speech with browser Web Speech recognition/synthesis and authenticated final-text WebSocket validation. No HomeAuto speech models or Python workers load. Downloaded assets/environments were moved outside the project into a recoverable archive; old native instructions and measurements below are historical. Start conversation alternates listening and speech with a 350ms quiet buffer. Browser recognition may require internet, and Automatic listening follows the app language rather than promising portable bilingual detection. Device execution, authentication and physical confirmation rules remain on the hub.

# HomeAuto — implemented contracts, revision 4

Local assistant extension, 2026-11-15: English/Hindi conversation intents use the existing owned/expiring execute→answer→speech path with read authority and empty device lists. No open-domain LLM or cloud inference is active. Strict command parsing/physical authorization remains separate. Approved static dialogue/error WAV caching is bounded to 16 entries / 8 MiB each in RAM and local disk; microphone audio, device readings/names and action confirmations are not cached. STT and TTS native bounds are 60s, browser bounds 65s; queued audio lives up to 90s, and ready audio remains available for 60s after completion. The local input WebSocket is unchanged. See [scoped assistant evidence](../docs/verification/OFFLINE_SCOPED_ASSISTANT.md).

> Architecture revision2026-11-14: AI runs on the ESP32-connected home hub. Remote clients will relay voice/conversations to that hub and receive its responses; the hub must be active and connected for remote voice and control. Models are installed on the hub only. See [the revised execution contract](../docs/cloud/HUB_AI_EXECUTION_PLAN.md). The implementation descriptions below remain current/historical evidence as dated; remote audio forwarding is not implemented yet.


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
| Speech | Multilingual Whisper medium CPU INT8 + Kokoro af_heart/hf_alpha. Pinned SHA256 asset verification then native readiness. Audio jobs owned by user, queued up to 90s and expire 60s after completion, no-store WAV; input audio/transcripts remain RAM-only. One global speech job; STT deadline 60s, browser watchdog 65s, TTS deadline 60s. Private request-scoped progress has no execution authority. Windows worker retirement includes its interpreter descendants. See docs/verification/VOICE_TIMEOUT_REPAIR.md. |
| Local AI | Owner sees installed fixed profiles and can confirm their loaded readiness after reauth. No dynamic provider switch/import/upload endpoint or rollback promise. Operator installs pinned files. Model table records verified installed profiles. |
| Storage | Additive schema v5 consolidates planned M01–M05. Old devices/cards/activity retained. Atomic temp/fsync/backup/rename; failure restores memory and fails writes. Daily backups/retention; sessions and pending actions invalidated on restart. |
| Offline | All shell assets, dictionaries, help, fonts/icons and inference local. Browser must reach hub over LAN. Manifest provided; no service worker/API/audio cache and no claimed browser-offline shell. |

Canonical methods/fields are readable in `server/app.js`; unknown API routes
return structured JSON 404. The old route modules and voice handlers are
unmounted. Do not start them directly or reintroduce their insecure APIs.

Hardware topics/payloads remain exactly numeric legacy topics, not JSON command
envelopes. No ESP32 source or pin was modified. Authenticated TLS firmware and
nonblocking/prioritized door relock remain an explicit build/hardware gate.
