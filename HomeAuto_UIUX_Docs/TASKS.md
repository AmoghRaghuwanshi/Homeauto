# HomeAuto — canonical implementation tracker

Revision 4, 2026-11-05. Direct implementation is authorized; no model handoff. Original task definitions/dependencies/acceptance are preserved in history/revision-3/TASKS.md. This tracker records actual progress against those gates. Code and isolated verification do not establish household release readiness.

Status: [x] implemented and verified for the stated software scope; [~] code exists but acceptance is incomplete; [ ] blocked/pending external or release validation. See IMPLEMENTATION_JOURNAL.md for exact changed paths/tests and RUNTIME_CONTRACTS.md for accepted deviations.

| Status / ID | Actual deliverable and evidence | Remaining acceptance / blocker |
|---|---|---|
|[x] HA-001|Original source/reference/planning audit, preserved|Historical audit only|
|[x] HA-002|48-file hash backup; injectable app/runtime/stop; isolated test harness|No live startup side effects on import|
|[x] HA-003|Additive schema5, original7/44 retained, repeat migration; atomic export/memory rollback/writer lock tests|Real power interruption covered separately by HA-037|
|[x] HA-004|Console users, scrypt, hashed sessions/roles, CSRF/Origin/Host, reauth/expiry/logout; HTTP/auth/TLS tests|Household deployment/OS trust separate|
|[x] HA-005|Single upgrade dispatcher; both authorized paths, forbidden upgrades, caps, JSON404 tests|Actual phone socket behavior in HA-036|
|[x] HA-006|Safe DOM/CSP/local assets, no automatic mic/transcript broadcast; injection/browser checks|Real microphone permission hardware remains HA-031/038|
|[x] HA-007|Shared persisted commands, keys/busy/deadline/challenges; callback/report/offline/restart tests|No physical evidence claimed|
|[x] HA-008|Epoch/retained/freshness, denied event, stale PIR/gas/board state tests|Actual firmware fixtures HA-041/042|
|[~] HA-009|Credential/TLS adapter, no-queue policy, ACL/env/broker templates; remote plaintext rejection|Actual Mosquitto ACL fixture, CA/interface/credentials and board TLS/auth not supplied|
|[ ] HA-010|Door remains disabled; blocking firmware reconnect/relock risk recorded; source preserved|Arduino toolchain, secure firmware config/build, relock-priority change and supervised power/WiFi/egress fixture; no flash authorized|
|[x] HA-011|Persistent alerts/latest telemetry/transition audit, durable requests/grants, retention/backups tests|Original44rows preserved; active warnings retained|
|[x] HA-012|Exact four-theme tokens/bootstrap/persistence, no CDN fonts; rendered matrix|05default and alternatives retained|
|[~] HA-013|Shared native components,48px controls/focus/dialogs; axe and interaction checks|Full manual keyboard/NVDA/forced-colors acceptance in HA-038|
|[x] HA-014|Single store/API/reconnect, guarded fetch and stale sockets, epoch/sequence full snapshots|Full snapshots replace delta plan by ADR029|
|[x] HA-015|History router, responsive shell, private login/notfound/role views, capture cleanup; browser checks|Real assistive-tech focus review in HA-038|
|[~] HA-016|Hindi/English dictionaries, critical copy, language persistence, formatting; five mobile pages checked|Native-speaker review, secondary error/copy completeness and human acceptance|
|[x] HA-017|Rooms/home/user prefs/versioned APIs, backfill, operator-confirmed aliases; DB/HTTP tests|No fabricated bedroom aliases|
|[x] HA-018|Room list/search/filter/create/edit/detail/delete-empty; metadata APIs and browser rendering|Human ease-of-use HA-039|
|[x] HA-019|Light controls/details/favorites/metadata, preservedIDs; pending→simulated report browser test|Physical relays HA-041|
|[x] HA-020|Actual Home counts/favorites/shortcuts/bulk off/lock/assistant/alerts; rendered four themes|Hardware availability truthful; no unsupported controls|
|[x] HA-021|Shared door view, gate/reauth/challenge/Cancel; policy and browser tests|Simulator-only until HA-010/042|
|[x] HA-022|Owner card list/add/edit/revoke/remove, UID/version/duplicate handling; HTTP/DOM tests|Physical authorized/revoked scans HA-042|
|[x] HA-023|Truthful gas/PIR details, unknown ages/caveats; observation tests and rendered routes|No calibration/absence proof; hardware HA-041|
|[x] HA-024|Server filtered bounded cursor activity, role redaction/legacy safety, stable pagination on updates|q matches event type/deviceID; original audit preserved|
|[x] HA-025|Persistent episodes/receipts, read/ack independent of resolve, banner; tests|No life-safety alarm guarantee|
|[~] HA-026|Gas/motion category prefs, gesture browser permission, generic notifications/dedup|Real OS permission/denial/browser-background validation; unimplemented categories omitted|
|[x] HA-027|All Settings/subpages, real roles/logout and preference APIs; primary/secondary browser checks|Native language/manual accessibility acceptance remains separate|
|[x] HA-028|Owner-only sanitized system/board/storage/model readiness; HTTP/secondary render checks|Unmeasured telemetry not invented|
|[x] HA-029|Safe bilingual parser/query grammar, session-bound interpret/execute, derived idempotency; regression corpus|No LLM or direct unlock|
|[x] HA-030|Typed Assistant/suggestions/pending/results/negative/unknown/model-missing states; browser flow|No STT/TTS required for typing|
|[~] HA-031|16k worklet/VAD/bounds/tickets, isolated Vosk; injected-stream native browser integration passes|Actual microphone/permission tests blocked by Chromium fake-file NotSupportedError here; real phone/manual checks pending|
|[~] HA-032|Vosk/Base/Small benchmark scripts/manifests, nine synthetic cases, measured latency|Consented human Indian-accent/Hindi/Hinglish holdout, noise/negation/false-action/RAM gates absent; no quality winner|
|[~] HA-033|Native English/Hindi Kokoro workers/voices/probes/playback, pinned environment|Human voice/name auditions and redistribution license/source review|
|[x] HA-034|Trusted bilingual observed/uncertain/query templates, owned WAV jobs, playback/Stop; native integration|Human naturalness/translation signoff HA-016/033|
|[~] HA-035|Per-file SHA256/native probes, model records/installed-profile readiness UI|Dynamic provider activation/rollback omitted; human profile promotion gate pending; fixed confirmation honestly labelled|
|[~] HA-036|Local assets/help/manifest, fresh TLS tooling and trusted temporary HTTPS test, WAN-blocked browser|Trusted household phones/LAN/firewall/service packaging not exercised; no service worker promised|
|[~] HA-037|Shutdown, writer refusal, simulated disk-full rollback, daily7backup/retention/validated restore tests|Actual Windows process-kill/power/service-account recovery and second-disk procedure|
|[~] HA-038|145screenshots:100primary+5Hindi+40secondary;80axe scans,zero violations/errors/external requests; visual inspection|NVDA/manual keyboard/200%zoom/forcedcolors, real permissions/storage-denied and native language review|
|[ ] HA-039|No household trial evidence fabricated|Older/nontechnical participants and measured task outcomes|
|[~] HA-040|63isolated Node/HTTP/WS/TLS tests, browser flows, native speech integration,zero npm advisories|Real broker allow/deny integration, complete resilience/human speech gates|
|[ ] HA-041|Protocol/IDs/pins preserved; simulator only|Supervised light/sensor fixtures, no unsafe gas release|
|[ ] HA-042|Door gate off; software policy verified|Supervised door/RFID/relock/power/WiFi/broker/physical fail-mode/egress checks|
|[ ] HA-043|Operator/security/offline docs and local version2.0.0 exist|Release gates above, redistribution notices, security/household signoff|
|[~] HA-044|Actual app polished, source/tests/journal/docs synchronized; preview available|Ready household release package/review blocked by HA-039/041/042/043|

## Current evidence ledger

- Baseline .local/backups/baseline-20261105 with SHA256 manifest; no .git fabricated, no production data changed.
- npm test:63pass,0fail. npm audit:0vulnerabilities at recorded check. Node20 watch replaces nodemon; unused cors removed.
- npm run test:browser:145screenshots,10flow/group checks,80axe scans,0violations,0pageerrors,0external browser requests. Four themes and320/390/768/1024/1440 widths;20secondary routes at390/1440; Hindi320px and large/reduced-motion checks. Actual images visually inspected; not all screenshots manually audited.
- npm run test:voice-browser:4native pipeline assertions pass with injected synthetic MediaStream and in-memory hardware. No automatic capture, review/Cancel/no command, reviewed control/report, TTS/playback/Stop. Actual microphone remains open.
- npm run test:speech:both native languages/voices work. Local synthetic room-number omissions remain safely rejected. Nine-case Vosk/Base/Small comparison and timing limits in OFFLINE_AI.md; no human accuracy claim.
- Hardware/broker/productionDB/TLS trust/push/flash: no live action performed. Keep door gate off.

## Exact continuation

Read IMPLEMENTATION_JOURNAL.md and OPERATIONS.md; review the app with npm run preview:isolated. Next release-critical work is HA-009/010: provide an actual broker CA/credentials/interface and safe ESP32 fixture, prepare authenticated TLS firmware plus relock-priority build, then supervised testing with explicit flash/actuation approval. Meanwhile obtain consented speech/native language/accessibility/household reviewers. Missing external inputs do not justify claiming release completion.


### 2026-11-05 — preview login deferred at user request

The loopback-only in-memory preview on port3001 opens directly without credentials. Account/sign-out controls and reauthentication prompts are hidden in this mode. Its guest session adapter is confined to server/scripts/preview.js; production runtime authentication remains intact. No persistent database change was made. Authenticated browser fixtures explicitly use loginRequired:true. Targeted fresh-browser checks pass for direct Home, hidden login/logout, unlock confirmation without password, typed simulated controls and retained CSRF checks; zero page errors. Evidence: .local/qa/no-login-results.json and no-login-preview.png.


## UI refinement continuation — 2026-11-05

- [x] UX-01: inspect current docs/code and all4references, capture24routes and86-file source hash baseline; no Git metadata or work discarded.
- [x] UX-02: shared route/history controller, My Home, contextual Back/fallback, native Back/Forward, direct reload, title/focus/scroll/notfound;32routes plus alert detail covered.
- [x] UX-03: URL Room/Activity filters, cursor pages, home-name feedback, wake-prefix/browser preferences, storage denial and pending preference controls. No hardware cache persisted.
- [x] UX-04: all4themes retain05default; compact Home/Rooms/Security, detail headers, meaningful status copy, local font/safearea/motion/outlines, read-only dialogs;145screenshots and80axe scans pass.
- [x] UX-05: actual Unslop installed once and read; audit before edits;10targeted span preservation passes and8verbatim safety/privacy messages; documentation audits/protected advisories recorded.
- [x] UX-06:30 interaction groups,63backend regressions, native speech browser4assertions, compatibility hashes and durable checkpoint written. Empty-room DELETE and dialog focus race repaired.
- [~] UX-07: actual phones/notches/native zoom/NVDA, full household keyboard tasks, native Hindi/voice/older-user trials remain manual acceptance. Hardware release blockers HA-009/010/041/042 unchanged.

See [UX results](../docs/ux/TEST_RESULTS.md), [navigation spec](../docs/ux/NAVIGATION_SPEC.md), [copy audit](../docs/ux/UNSLOP_AUDIT.md) and [checkpoint](../docs/DEVELOPMENT_STATE.md). No automated tests operated real hardware.
