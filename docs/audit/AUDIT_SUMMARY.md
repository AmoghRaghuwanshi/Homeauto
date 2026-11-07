# HomeAuto independent full-system audit

Date: 2026-11-06 (Asia/Calcutta). Workspace: D:\homeauto-main. Scope: current local implementation, original-source comparison, isolated software verification and an implementation handoff. **No application fixes were made.**

## Executive assessment

HomeAuto has a substantial working software foundation, but it is **not ready for unattended physical-door deployment or household release**. The active frontend and backend agree on the main APIs, the seven hardware IDs and MQTT payload vocabulary remain intact, and the new authentication/command tracking substantially improve the original implementation. The visual system is coherent across all four themes.

There are **19 confirmed findings: 1 P0, 5 P1, 12 P2 and 1 P3**. They are individually evidenced in [BUG_REPORT.md](BUG_REPORT.md). The P0 is the inherited firmware reconnect/relock hazard, mitigated in the new runtime by the door gate defaulting off. It is not evidence that a live door was operated or left unlocked during this audit. The exposed original key and the incomplete secure firmware/broker migration are also pre-existing/known release concerns; they are distinguished from new software defects.

The highest-priority new defects are question-to-command parsing (AUD-004), idle-session renewal by passive traffic (AUD-005), and a storage exception escaping the socket heartbeat (AUD-006). Other confirmed failures include room deletion not surviving restart, telemetry conflicting with metadata edits, stale spoken/current-looking UI reports, lost partial-command failures, keyboard/read-state loss and incomplete alert/error flows.

Safe software development can continue using mocks. Release gates should remain closed until these defects and the independent hardware/human validation requirements are addressed.

## Verified baseline

| Area | Actual condition |
|---|---|
| Version and languages | HomeAuto 2.0.0; Node v20.19.0 in this audit; CommonJS server, native browser ES modules, Python TTS worker, Arduino C++ sketches |
| Installed main packages | Express 4.22.3, MQTT.js 5.16.1, ws 8.22.1, sql.js 1.15.2, Vosk 0.3.39 |
| Repository history | No local .git directory, branch, status or commit history is available. No Git repository was initialized. |
| Original comparison | Public original repository and its recursive tree were inspected; private baseline manifest and original entry point were compared. Local code is authoritative. |
| Original database | Read as bytes into a standalone SQL.Database, without migration: 28,672 bytes, integrity_check=ok, schema version 0, 7 devices, 0 cards, 44 activity rows |
| Active persistence | createRepository builds schema v5 for the actual runtime; original on-disk DB has not been migrated. Memory fixtures are distinct from production durability. |
| Hardware | Both sketches, fixed IDs, pins, original DB and bundled certificate/key still match the saved original baseline |
| Runtime defaults | Loopback, MQTT disabled, door disabled; production identity remains required. Login-free preview is a separate loopback in-memory adapter. |
| AI | Isolated native Vosk English/Hindi decoding and Python Kokoro ONNX CPU synthesis; deterministic intents; no cloud fallback or LLM |
| Appearance | 05 Serene Emerald default; 01 Warm Organic, 03 Universal Comfort and 04 Friendly Pastel remain selectable and local |

The original repository is [Mishrajishri/homeauto](https://github.com/Mishrajishri/homeauto). The public tree was fetched read-only from GitHub. The local exposed-key blob matched the tree's server/certs/server.key entry; no key content is included here.

## Structure and changes from the original

- public/index.html now loads main.js, app.css/tokens.css and a pre-paint local theme bootstrap. New active modules cover state, API requests, routing, preferences, components, views, translations and capture. Original app/devices/voice/logs/websocket/notifications scripts remain on disk but are not loaded.
- server/server.js now delegates to lifecycle.js. Active modules include app.js, realtime.js, auth/sessions.js, lib/errors.js/registry.js, db/repository.js/maintenance.js, services/home.js/assistant.js, mqtt/broker.js and the new voice workers/assets service.
- server/scripts provides operator/TLS/recovery, isolated preview, browser/native-speech tests and development-only copy auditing. deploy contains templates, not configured live services.
- firmware is unchanged. The new application does not make the anonymous sketches TLS-capable.
- HomeAuto_UIUX_Docs retains earlier specifications with revision-4 caveats; RUNTIME_CONTRACTS.md and actual code describe implemented deviations. docs/ux and DEVELOPMENT_STATE.md record the prior implementation milestone.
- The earlier UX baseline identifies recent edits to main/views/components/navigation/preferences/i18n/voice-controller/theme-bootstrap/CSS and test scripts. There is no commit evidence for authorship or chronology beyond these local manifests/documents.

Deliberate removals/restrictions: unauthenticated household APIs, arbitrary device provisioning/deletion, direct voice/text unlock, optimistic hardware-success updates, broad permissive CORS and the old dual HTTP/HTTPS startup are no longer supported. Fixed model readiness is not dynamic model switching. These are documented security/scope decisions, not recommendations to restore unsafe legacy behavior.

## Cross-module regression assessment

| Original expectation | Current behavior | Assessment |
|---|---|---|
| Legacy numeric MQTT command/status topics | Same IDs, topics and strings | No topic/payload regression found |
| Anonymous TCP sketches and original broker setup | Authenticated backend plus TLS broker template; sketches unchanged | Confirmed incomplete migration, AUD-002 |
| Old POST command returns success/device immediately | Auth/CSRF/key required; 202 with command lifecycle | Intentional API change; bundled frontend updated. External old clients need migration. |
| device_update/log/rfid_event socket deltas | Authorized full init snapshots with epoch/sequence | Bundled state.js consumes the new format; old scripts remain unmounted |
| Optimistic door state and direct voice unlock | Gate, role/grant/reauth/challenge and UI-only unlock | Security improvement; no new direct-unlock bypass found in the reviewed paths |
| Simple original dashboard | New metadata, persistence, alerts and multi-page UI | New defects AUD-007–019; do not infer they existed in the original UI |
| Original speech parser was also permissive | Replacement claims strict safe parsing | AUD-004 is a current defect and broken new contract; not proof that the original parser was safer |

No unsupported fan, brightness, camera, scene or second-door controls are presented as working hardware.

## Verification actually performed in this audit

| Check | Result and scope |
|---|---|
| HTTP/WS suite | **14 passed, 0 failed**. Entire http.test.js inspected first. Real API/auth/WS code with in-memory repository, no broker/worker startup, ephemeral loopback listener; common filesystem mutation methods guarded. Closed after completion. |
| Syntax | **57 JavaScript files parsed**, zero errors; **2 Python files AST-parsed** with bytecode writing disabled. Parsing does not execute legacy handlers. |
| Targeted memory probes | Parser semantics, unchanged-heartbeat versions, stale speech answers, passive session renewal, deleted-room virtual restart, future-schema backup acceptance and heartbeat exception escape reproduced the stated defects. FK enforcement rejected an orphan preference row; no FK defect was found. |
| Targeted intercepted browser | Ten distinct behavior checks reproduced AUD-010–015 and AUD-017–019 (including focus and Help separately). All app HTTP/WS traffic intercepted at a synthetic HTTPS origin; no production endpoint, microphone or native model used. |
| Fresh visual/axe matrix | **108 render/layout/axe cases:** 4 themes × 5 primary pages × 3 widths (320/768/1440), plus 24 secondary pages × 2 widths (390/1440) in Theme05. Zero detected horizontal overflow, zero reported axe violations, zero external app requests. Mocked fixtures do not prove backend/hardware operation. |
| Fresh navigation spot checks | My Home from Settings, room contextual Back, browser Forward and nested refresh passed in the intercepted browser |
| Previous evidence | Read prior 63-test/30-UX/145-screenshot/80-axe/native-speech records. These are **previous implementation evidence**, not rerun audit results. Existing screenshots were inspected separately; see UI_UX_AUDIT.md. |
| Dependency advisories | Read-only npm advisory bulk lookup for 145 production package names from package-lock.json returned no advisories. No install/update/npm fixer was run. This is not a native/Python/firmware vulnerability certification. |
| Original DB/key/reference checks | Read-only integrity/count/hash comparison, no migration; public-key-artifact equality verified without exposing secret bytes |

Harness limitations/failures were kept separate from product bugs. The first browser probe used an insecure synthetic HTTP origin, where crypto.randomUUID was unavailable; it was rerun successfully at an intercepted HTTPS origin. A package-version lookup hit sql.js package-export restrictions and was replaced by a read-only package-file lookup. An initial fake-heartbeat probe used a cached real ws import and did not reach the target path; the corrected harness verified a connected fake socket and the escaping exception. None of these is counted as an application defect or a passed target test.

## Evidence strength and remaining risks

**Confirmed** findings are identified individually with source lines and reproduction scope. **Code-derived risks requiring measurement** include synchronous whole-DB export cost, multi-client snapshot/render cost, retained-command injection at the broker boundary, UID replay/cloning, subprocess failure/cleanup under OS faults and restore locking races. They are discussed without inventing performance numbers or additional confirmed exploit counts.

Not executed: physical actuation/RFID scans, broker/network probes against a household system, firmware compilation/flashing, production database migration/restore, power-kill tests, native speech reruns, microphone capture, NVDA/real-phone trials, human Hindi/Hinglish/Indian-accent accuracy, full dependency-source audit or redistribution-license signoff. No exploit of the exposed key was attempted.

Documentation overstates particular acceptance cases: idle30m is not enforced against passive sockets; the claimed strict parser accepts interrogatives/unsupported modifiers; persistent room organization fails for deleted defaults; present-tense trusted speech can be stale; static axe does not detect the reproduced keyboard/live-update problems. Prior reports accurately disclose many hardware/human limits, and their previous test passes need not be retracted; the missing cases must be added.

## Preservation and handoff

Only new files under docs/audit were written in the working tree. No application source, config, firmware, dependency, existing planning document or database was changed. No existing live service was started, stopped or restarted. Tests used isolated ephemeral processes/memory only. Final protected-file comparison is recorded below after verification.

Start with [FIX_PRIORITY.md](FIX_PRIORITY.md), then use [HANDOFF_TO_SOUL.md](HANDOFF_TO_SOUL.md). Detailed domain reports are [IoT](IOT_COMPATIBILITY.md), [UI/UX](UI_UX_AUDIT.md), [AI/voice](AI_VOICE_AUDIT.md) and [Security](SECURITY_AUDIT.md).

