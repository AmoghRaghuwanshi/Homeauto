# HomeAuto — canonical implementation tracker

Revision 3, 2026-11-05. This replaces the older ticket sequence inside plan.md. **First pending implementation task: HA-002.** Only HA-001 is complete as a planning audit. Every other box is pending; specifications and existing prototype code do not complete implementation tasks. Read [HANDOFF_TO_GPT6.md](HANDOFF_TO_GPT6.md) before editing source.

Status: `[ ]` pending; `[x]` verified complete. To start, annotate the row `IN PROGRESS` with date; to complete, append changed paths and actual verification evidence to the ledger below. Do not mark hardware, security or inference checks passed by simulation alone. Dependencies are exact IDs; ascending number alone does not imply dependency.

## Task checklist

| Status / ID / phase | Dependencies | Concrete deliverable and affected paths | Acceptance / relevant verification |
|---|---|---|---|
| [x] HA-001 / 0 | none | Read entire application source and prior docs, inspect4 reference boards; write revision3 planning pack in HomeAuto_UIUX_Docs | Source/static inventory,19 syntax checks, pure parser probes, isolated ws400, read-only DB; no live feature claimed. See context/TEST_PLAN. |
| [ ] HA-002 / 0 | HA-001 | Establish actual checkout or explicit local backup without discarding this tree; extract injectable createApp/startRuntime/stopRuntime from server/server.js; add first Node test harness | Import starts no listener, DB write, model or broker; fake publisher records zero live calls; baseline parser regressions captured as known failing cases, not waived. No npm install needed initially. |
| [ ] HA-003 / 1 | HA-002 | DB single-writer queue, atomic snapshot/backup, migration runner M01/M02; server/db + unit/integration tests | Preserve7 devices/44 historical rows on copy; repeat migrations safe; disk failure reported; security write isn't accepted before durable snapshot; DB-01/02. |
| [ ] HA-004 / 1 | HA-003 | Local console owner provisioning, async scrypt, hashed sessions, roles/can_unlock, CSRF/Origin/Host, reauth/logout; server/auth + auth routes | AUTH-01..05, SEC-01; no default password/no LAN setup bypass; read protection and viewer permissions. |
| [ ] HA-005 / 1 | HA-004 | One upgrade dispatcher, noServer device/voice sockets, origin/session checks, rate/body/message limits, JSON404; server/server.js/routes | WS-01/02; both paths connect under injected ready speech, unknown API responds404; expiry closes sockets; VALID-01. |
| [ ] HA-006 / 1 | HA-002 | Safe DOM rendering/static SVG, remove inline handlers, gesture-only passive mic startup, remove transcript dumps/broadcast, strict input schemas, CSP/local assets; public + server boundary files | COMP-15, PRIV-01, SEC-03/04; no autoplay microphone; names/UID/logs literal text; CSP works after old inline styles migrated. |
| [ ] HA-007 / 1 | HA-003,004,005,006 | Shared command service,202records/idempotency, busy locks, unlock challenges, no optimistic status, no auto replay; commands route, voice/RFID adapters | CMD-01..06, SEC-02/05; fake broker callback/restart/missing acknowledgment; voice/RFID cannot bypass central policy. |
| [ ] HA-008 / 1 | HA-007 | Observation registry, epoch/retained-aware freshness, denied-event handling, board loss/gas age/PIR unknown; MQTT + state DTOs | STATE-01, SENSOR-01/02, MQTT-01/02; old DBonline cannot imply live; no physical_verified true. |
| [ ] HA-009 / 1 | HA-008 | Broker deployment config templates, unique credentials/ACLs, transport/no-queue policy, external secret/TLS paths; config + MQTT adapter + operator docs | MQTT-03..05 and isolated ACL tests; credential provisioning plan for actual firmware; no retained/unattended unlock. Real broker details remain operator input if unavailable. |
| [ ] HA-010 / 1 safety gate | HA-009 | Plan/test nonblocking door reconnect and relock priority, external firmware credentials, physical fail mode; firmware door/light config as needed in coding phase | Supervised HW-02/03 plus build checks; no automatic flash; no unattended use until network-loss and power/egress results documented. UI development can proceed with simulator while pending. |
| [ ] HA-011 / 1 reliability | HA-003,008 | M04 alert/audit storage, latest telemetry, transition logging, retention/durable grant logging; DB + alert service | DB-02/03, ALERT-01;2s gas doesn't grow full audit indefinitely; active warnings survive restart; disk failure blocks sensitive writes. |
| [ ] HA-012 / 2 | HA-006 | Exact4-theme token registry and local theme bootstrap, remove CDNfonts; public/css tokens/base and public/js/theme/preferences | THEME-01/03/07/08;05initial before paint, token names/contrast/control outlines, storage-denied fallback. |
| [ ] HA-013 / 2 | HA-012 | Safe reusable buttons, fields, switches, dialogs, cards, alerts, status/empty/loading/toast primitives; components CSS/JS | COMP-01..17 as applicable;48px, focus/keyboard, Hindi wrapping, unknown switch semantics; no source-state mutation in rendering. |
| [ ] HA-014 / 3 | HA-005,008,013 | Single frontend store, snapshot/epoch/seq/version reducer, api wrapper and authenticated reconnect; state/api/websocket modules | SYNC-01/02; late fetch/event gaps recover; one subscription; no command replay/no transcript leak. |
| [ ] HA-015 / 3 | HA-014 | History router,5-route responsive shell, login/session/notfound/access-denied views, route cleanup | NAV-01, AUTH-04; deep reload/back, focus restoration,320px/desktop navigation, stop mic on departure. |
| [ ] HA-016 / 3 | HA-015 | Local en/hi dictionaries, formatters, document.lang and language selection foundations | LANG-01/02; all shared labels/errors/critical copy translated; literal parameter binding; native review tracked pending if unavailable. |
| [ ] HA-017 / 4 | HA-003,014,016 | M03 rooms/shared home/user preferences, GET/PUT room/preferences contracts, stable backfill aliases | ROOM-01/02, PREF-02/03; Room1/2 retained, actual aliases confirmed before voice, use versions, unknown covers rejected. |
| [ ] HA-018 / 4 | HA-017 | Rooms listing/search/filters/create/edit/detail and owner assignments; rooms view/controller | ROOM-01/02; all7reachable, empty/error separated, metadata durable, IDs/topics unchanged. |
| [ ] HA-019 / 4 | HA-018,007 | Device light controls/details, favorites, owner rename and room assignment; devices.js/controller/settingsdevices | UI-03/04; pending/uncertain explicit, no brightness, offline disables unsafe actions; fixed hardware not delete/reseed loop. |
| [ ] HA-020 / 4 | HA-019,011 | Home summary, favorites/rooms shortcuts, bulk off and lock action, notification/Shri­maan entries | UI-01, CMD-06; actualcounts+unknown, no fabricated scene/camera/climate; no microphone starts on entry. |
| [ ] HA-021 / 5 | HA-019,011 | Security + single shared door detail/protected unlock dialog, controller-position caveat | SEC-01..03, CMD-03; reauth/challenge/Cancel/retry semantics; no success before report or guaranteed relock countdown. Simulator only until HA-010 passes. |
| [ ] HA-022 / 5 | HA-021 | Owner RFID list/create/edit/revoke/remove, reauth, migration version fields | SEC-04/05; UID normalize4/7/10 bytes, duplicate409, no silent replacement, revoked scan denies, owner data hidden from others. |
| [ ] HA-023 / 5 | HA-021 | Gas/motion details, latest observation age and warning copy; device/security view | SENSOR-01/02; no zero/PPMdefault, no false fresh PIR clear; alert data truthful. |
| [ ] HA-024 / 6 | HA-011,016 | Activity query/cursor/filter service+view, role-redacted DTOs and stable liveIDs | ACT-01..03; server filters before page, all legacy rows kept, dedup, unknown details safe. |
| [ ] HA-025 / 6 | HA-023,024 | Persistent alerts list/detail, read/ack receipts, critical Home banner | ALERT-01/02; read/ack doesn't resolve; new critical announced once, active warning restored after outage. |
| [ ] HA-026 / 6 | HA-025 | Notification category preferences, gesture OS permission/sound, privacy-safe duplicate suppression | ALERT-03; denied/unsupported keeps in-app; no heartbeat notification storm; generic lockscreen text. |
| [ ] HA-027 / 6 | HA-016,017,026 | Settings/subpages:Appearance, Accessibility, Language, Home, Privacy, Help, About, Devices/Rooms links, real role/logout | UI-07/08, PREF/THEME; every displayed row implemented; local theme persists browser restart, no fake accounts/routines. |
| [ ] HA-028 / 6 | HA-009,011,027 | Owner-only system diagnostics/readiness with sanitized paths/status; Advanced view | OPS-01/02; MQTT/boards/model info only here; no credentials, unmeasured values labelled unknown. |
| [ ] HA-029 / 7 | HA-007,016,017 | Deterministic bilingual intent rewrite, query grammar, negation/ambiguous target handling, session-bound interpretation/execution API | INTENT-01..03, AI-05; parser regressionfixed, unknown99reject, barelightclarify, voice/textunlockUI-only; no LLM. |
| [ ] HA-030 / 7 | HA-005,029 | Accessible Assistant typed flow and safe suggestions, result text/pending and missing-model state | AI-05, UI-07; typed controls work without STT/TTS; unauthorized and ambiguous requests never publish. |
| [ ] HA-031 / 7 | HA-030 | Bounded capture/resampler/VAD/utterance lifecycle, authenticated voice tickets, isolated Vosk worker baseline | AI-01/02, WS-02;16kPCMcontinuity, Stop/end vs Cancel,20scap, oneexecution, passive permission state; native probe evidence. |
| [ ] HA-032 / 7 | HA-031 | Local consented corpus, Whisperbase/small/Vosk benchmark tooling and measured selection record | AI-02/07; CPUonly, p50/p95, bytesvsRAM, language holdout counts, safety zero-wrong gate; no downloads without provisioning task authorization. |
| [ ] HA-033 / 7 | HA-032 | Hindi/English local TTS auditions/provenance review, worker synth/playback+voice prefs | AI-03/04; shortphrase/names reviewed, no external calls, license caveatsresolvedbefore redistribution, textfallback. |
| [ ] HA-034 / 7 | HA-033,007 | Observed/uncertain-result bilingual response templates+local spoken replies; no unconstrained model actions | AI-05/06, LANG-02; spoken result matches lifecycle, missingTTStextworks, Stop audio/cancel reliable. |
| [ ] HA-035 / 7 | HA-028,033 | M05 model registry, readiness/hash probes, owner activation rollback, Local AI page | AI-04; registryIDs only, offline imports/operator docs, no arbitrary upload/download/shell endpoint. |
| [ ] HA-036 / 8 | HA-027,035,009 | Local runtime packaging/trusted HTTPS onphones, offline help, manifesticons, optional versioned static-shellSW | OFFLINE-01..04; WAN0coldstart, noAPI/audio/sessioncache, no background command replay, actual package/model manifest. |
| [ ] HA-037 / 8 | HA-011,036 | Shutdown/recovery, backup/restore operator workflow, logs/caps/resource and retention tuning | DB-02..04; Windowscrash/diskfull, secondwriter refused, restore invalidates sessions, no pending replay. |
| [ ] HA-038 / 8 | HA-020..028,034 | Four-theme accessibility/visual pass, Hindi/English review, keyboard/NVDA, phone/browser permission tests | THEME/COMP/LANG,100 primary theme-width screenshots+states;48px/zoom/forcedcolors/reducedmotion. Fix failures before markingdone. |
| [ ] HA-039 / 8 | HA-038 | Household user trials with nontechnical and older users, measured task outcomes and focused polish | Find/controllight, checkdoor/alerts, voice/text, Hindi/theme/largetext, offline explanation; record errors not invented success. |
| [ ] HA-040 / 9 | HA-037,038,034 | Full isolated HTTP/WS/broker/security/resilience regression group and offline AI evidence | AUTH/SEC/CMD/SYNC/MQTT/DB/OFFLINE/AI cases; testbroker only, no physicalactuation. |
| [ ] HA-041 / 9 | HA-040,010 | Supervised light controller and sensor protocol validation on safe fixtures | HW-01/04; reportvsphysical observations distinct; no unsafe gas release; calibration not claimed. |
| [ ] HA-042 / 9 | HA-040,010,022 | Supervised door/RFID and power/WiFi/broker failure validation | HW-02/03; auto-relockpriority/failsafe/egress documented, unauthorizedcarddenied, durablerevocation; no unattendedtest. |
| [ ] HA-043 / 10 | HA-039,041,042 | Release/security/offline/accessibility evidence review, remainingrisk signoff, operator docs+version | All releasegates explicit; no hidden skippedblockers, no exposed key/runtime secret, backup/trust/service setup repeatable. |
| [ ] HA-044 / 10 | HA-043 | Final visual polish and change review, update all docs/taskstatus, ready local release package | Actualstart/testcommands valid, artifact/versionmanifest, knownlimits and rollback, all4 themes+manualcontrolsverified; no automaticpush/deploy. |

`HA-020..028` means each ID20 through28 inclusive, not one undifferentiated task. Group only coherent dependent work; never complete a task by writing a plan for it (except HA-001, whose deliverable is this plan). Software simulator progress does not require a working physical door; real-use gates do.

## Progress ledger

### 2026-11-05 — HA-001 complete (planning only)

- Workspace `D:\homeauto-main`, no `.git`; all source and prior docs inspected; four original reference PNGs viewed and preserved.
- Written/extended specification Markdown only. Syntax19 passes, installed dependency inventory, pure parser failure probes, isolated ws400 reproduction, read-only SQLite counts. No production server/hardware/model inference test.
- First pending:HA-002. Runtime values, broker/HTTPS deployment, firmware fail mode, model performance/licensing remain verification tasks, not planning blockers.

### Completion record template

```text
Task ID / date / status:
Source checkout or hash baseline:
Changed absolute paths and purpose:
Tests run (exact command, level, results):
Browser screenshots / route / theme / viewport / language:
Physical hardware operator and fixture, if applicable:
Security/privacy implications:
Remaining limitations / failed or skipped gates:
Next dependency-ready task:
```

On resumption compare source/diff and rerun relevant checks before trusting a previous tick. If scope changes, update DECISIONS and affected contracts together; never silently change theme05, hardware registry, language or offline requirements.
