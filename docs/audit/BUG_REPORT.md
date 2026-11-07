# HomeAuto independent bug report

Audit date: 2026-11-06 (Asia/Calcutta). Workspace: D:\homeauto-main. Application version: 2.0.0.

This is a read-only assessment, not an implementation change. There are **19 confirmed findings: P0 1, P1 5, P2 12, P3 1**. “Confirmed” means the specified source condition or isolated reproduction was established; it does not mean a physical consequence or exploit was exercised. AUD-001 is an inherited, gate-mitigated physical-safety hazard. AUD-002 is a deployment compatibility gap. AUD-003 is an inherited public secret exposure with active use unknown. The remaining findings concern current software behavior.

Scope and evidence methods: [AUDIT_SUMMARY.md](AUDIT_SUMMARY.md). Remediation dependencies: [FIX_PRIORITY.md](FIX_PRIORITY.md). No production actions were performed. All line numbers refer to the audited, unchanged files.

| ID | Severity | Finding |
|---|---|---|
| [AUD-001](#aud-001) | P0 | Door auto-lock is blocked by network reconnection |
| [AUD-002](#aud-002) | P1 | No deployable secure broker/firmware combination is supplied |
| [AUD-003](#aud-003) | P1 | The original private TLS key remains publicly retrievable |
| [AUD-004](#aud-004) | P1 | The intent parser turns questions and unsupported compound requests into actions |
| [AUD-005](#aud-005) | P1 | Passive WebSocket traffic defeats the documented 30-minute idle logout |
| [AUD-006](#aud-006) | P1 | A persistence failure can escape the WebSocket heartbeat and crash the hub |
| [AUD-007](#aud-007) | P2 | Deleted default rooms are recreated on the next repository open |
| [AUD-008](#aud-008) | P2 | Unchanged telemetry invalidates device metadata edits |
| [AUD-009](#aud-009) | P2 | Speech replay presents historical device state as current |
| [AUD-010](#aud-010) | P2 | Live rerendering loses checkbox focus and collapses Help disclosures |
| [AUD-011](#aud-011) | P2 | Hub disconnection leaves cached device reports looking current |
| [AUD-012](#aud-012) | P2 | Partial assistant-command failures disappear from the final response |
| [AUD-013](#aud-013) | P2 | Normal alert navigation cannot mark motion alerts read and the bell label goes stale |
| [AUD-014](#aud-014) | P2 | Several async UI actions fail without visible feedback |
| [AUD-015](#aud-015) | P2 | Invalid Activity filters remove the controls needed to recover |
| [AUD-016](#aud-016) | P2 | Restore replaces the live database before checking schema compatibility |
| [AUD-017](#aud-017) | P2 | Automatic spoken reply language follows UI language instead of the interpreted reply |
| [AUD-018](#aud-018) | P3 | Large controls does not enlarge several common targets |
| [AUD-019](#aud-019) | P2 | Assistant readiness labels do not update when workers become ready or fail |

<a id="aud-001"></a>
## AUD-001 — P0 — Door auto-lock is blocked by network reconnection

- **Affected source / lines:** firmware/door_security/door_security.ino:61–79, 109–126, 191–213, 254–272.
- **Primary file:** [firmware/door_security/door_security.ino](../../firmware/door_security/door_security.ino), line 254.
- **Function/module:** loop, setupWiFi, connectMQTT, unlockDoor.
- **Origin/classification:** Inherited, documented release blocker.
- **Evidence:** The relay is driven HIGH on unlock. loop() calls blocking Wi-Fi/MQTT reconnect before checking the 5-second unlock deadline. connectMQTT() can loop indefinitely; accessDenied() also blocks for about 1.2 seconds.
- **Expected behavior:** Relock timing must remain enforceable independently of connectivity and message handling.
- **Actual behavior / consequence:** An outage after unlock can leave the energized unlock output on beyond its intended interval. The exact physical lock/fail-mode consequence requires a supervised fixture. The current backend door gate defaults off; this is an inherited firmware hazard, not a claim that this audit unlocked a door.
- **Safe reproduction:** Source/control-flow inspection only. Future safe bench test: disconnected lock/indicator load, trigger simulated unlock, remove broker/Wi-Fi availability and measure GPIO deadline.
- **Root cause:** Safety timing is subordinate to blocking network and LED work.
- **Recommended fix:** Prioritize a nonblocking local lock state machine and bounded reconnect/LED scheduling; use rollover-safe deadlines. Preserve pins and existing command strings. Keep the backend gate off pending authenticated firmware and supervised outage/power/egress validation.
- **Regression risk:** Firmware timing, relay polarity and physical egress; requires a separate authorized firmware change and supervised validation.
- **Required validation:** Bench/indicator-load tests for broker loss, Wi-Fi loss, repeated deny/scan, reboot and millis rollover; then supervised physical fail-mode testing.
- **Confidence:** High: confirmed source hazard; physical consequence untested.

<a id="aud-002"></a>
## AUD-002 — P1 — No deployable secure broker/firmware combination is supplied

- **Affected source / lines:** server/mqtt/broker.js:2–7; server/lifecycle.js:21; firmware/light_controller/light_controller.ino:18–20, 42–43, 126–127; firmware/door_security/door_security.ino:20–22, 46–47, 196–197; deploy/mosquitto.conf.example:3–10.
- **Primary file:** [server/mqtt/broker.js](../../server/mqtt/broker.js), line 3.
- **Function/module:** connectBroker and firmware connectMQTT.
- **Origin/classification:** Intentional hardening with an incomplete deployment migration, not an accidental MQTT topic regression.
- **Evidence:** Backend now requires username/password, and remote brokers must use TLS. Both supplied sketches use WiFiClient, port 1883 and NULL credentials. The example broker exposes authenticated TLS on loopback 8883.
- **Expected behavior:** A documented, buildable authenticated firmware/broker/hub path must exist before claiming existing hardware works with the new runtime.
- **Actual behavior / consequence:** Topics/payloads match, but the supplied sketches cannot connect to the supplied secure broker template. Starting with defaults intentionally controls no hardware. A hybrid legacy broker is not verified or a safe substitute.
- **Safe reproduction:** Compare transport settings and connection calls; do not connect to a real broker.
- **Root cause:** Backend hardening was completed ahead of the authenticated firmware/deployment work.
- **Recommended fix:** Prepare board-specific credentials and CA-validated TLS firmware plus actual private-interface broker configuration and ACL integration tests. Do not restore anonymous access to make a test pass. Keep physical gates off until the integration is validated.
- **Regression risk:** Transport rollout can remove all relay/sensor/RFID availability; preserve legacy topic vocabulary and verify both boards together.
- **Required validation:** Isolated Mosquitto allow/deny tests for each principal, retained/LWT/reconnect behavior, credential failure and CA mismatch; compile firmware before a separately approved fixture.
- **Confidence:** High: configuration incompatibility confirmed; actual broker and installed firmware unknown.

<a id="aud-003"></a>
## AUD-003 — P1 — The original private TLS key remains publicly retrievable

- **Affected source / lines:** server/certs/server.key (whole credential file; contents omitted); server/config/config.js:11–13; server/lifecycle.js:19, 27, 36; .gitignore:4–5.
- **Primary file:** [server/lifecycle.js](../../server/lifecycle.js), line 19.
- **Function/module:** Legacy TLS artifacts and deployment trust.
- **Origin/classification:** Inherited exposure, partially mitigated by new runtime defaults.
- **Evidence:** The public original repository tree still contains server/certs/server.key. A local Git-blob SHA-1 comparison matched that public blob exactly, without printing the key. The active runtime defaults to .local/tls and does not automatically use it.
- **Expected behavior:** No deployment may trust or reuse an exposed server private key.
- **Actual behavior / consequence:** Legacy deployments or clients that still trust this key are vulnerable to impersonation under an appropriate network position. Whether any household still trusts it is unverified. Ignoring it locally does not remove public history.
- **Safe reproduction:** Read-only public tree/local blob equality; no impersonation or intrusive test was performed.
- **Root cause:** A secret was included in the original repository and remains available upstream; current local hardening cannot revoke existing trust.
- **Recommended fix:** Treat the key as compromised; rotate any deployment using it and remove old client trust through the operator. Remove public/history copies where feasible, but rotation is mandatory even after deletion. Preserve forensic metadata without republishing secret material.
- **Regression risk:** Trust changes can interrupt phone access; provision and verify replacements before migration. No runtime regression was introduced by retiring this key.
- **Required validation:** Operator inventory of trusted fingerprints and deployed leaf certificates; verify fresh private key, SANs and client trust in an isolated TLS fixture.
- **Confidence:** High: public exposure confirmed; active exploitation/use not established.

<a id="aud-004"></a>
## AUD-004 — P1 — The intent parser turns questions and unsupported compound requests into actions

- **Affected source / lines:** server/voice/intent.js:20–46; public/js/main.js:39, 59–62, 82–86; server/services/assistant.js:18–43.
- **Primary file:** [server/voice/intent.js](../../server/voice/intent.js), line 35.
- **Function/module:** resolveCommand, typed, executeIntent.
- **Origin/classification:** New parser/typed-flow defect in the current implementation.
- **Evidence:** Pure probes returned control/on for 'Is light 1 on?', control/off for 'Check if light 2 is off' and 'क्या लाइट 1 बंद है'. 'turn on light 1 tomorrow' becomes an immediate action; 'turn off light 1 and room 2 lights' silently selects only light-1. Explicit light-99 and 'do not unlock door' correctly reject.
- **Expected behavior:** Questions must query; temporal/conditional or partially understood requests must reject or clarify without actuating.
- **Actual behavior / consequence:** Typed requests automatically execute the parsed control without the voice-review dialog. Recognized voice controls are reviewed, which reduces but does not repair semantic misclassification. Direct voice/text unlock is still blocked.
- **Safe reproduction:** Call resolveCommand with the fixed registry and the listed strings; no publisher required. Mock the Assistant UI and assert no execute-control call for questions.
- **Root cause:** Presence-based action selection overrides query markers and ignores unconsumed target/modifier text.
- **Recommended fix:** Define an explicit accepted grammar separating interrogatives from imperatives, require complete target/action coverage, and reject unsupported time/condition/compound syntax. Keep backend unlock rejection independent of parsing.
- **Regression risk:** Overly broad changes can reject legitimate Hindi/Hinglish imperatives; retain positive and negative multilingual corpora.
- **Required validation:** Table-driven English/Hindi/Hinglish interrogative, negation, scheduling, mixed-target, room-name and numeric cases; mocked typed UI must produce queries or clarification and zero control publications.
- **Confidence:** High: reproduced in pure parser execution; physical actuation not tested.

<a id="aud-005"></a>
## AUD-005 — P1 — Passive WebSocket traffic defeats the documented 30-minute idle logout

- **Affected source / lines:** server/auth/sessions.js:46–51; server/realtime.js:18–21, 54; server/lifecycle.js:43.
- **Primary file:** [server/auth/sessions.js](../../server/auth/sessions.js), line 50.
- **Function/module:** Sessions.get, snapshot, heartbeat.
- **Origin/classification:** New security behavior contradicting SECURITY.md and RUNTIME_CONTRACTS.md.
- **Evidence:** get() writes last_active_at on validation every minute. Device snapshots and 20-second socket heartbeats call get() without human activity. An injected-clock probe stayed authenticated after 30 minutes 20 seconds of passive checks.
- **Expected behavior:** Documented idle expiry should measure meaningful authenticated user activity, independently from connection liveness.
- **Actual behavior / consequence:** An open unattended dashboard remains usable until absolute expiry (up to 8 hours), rather than expiring after 30 idle minutes. Recent unlock reauthentication still expires separately.
- **Safe reproduction:** In-memory session; advance clock by 20 seconds and call get() 91 times without user input. Session remains valid.
- **Root cause:** Authentication validation, keepalive and user-activity renewal share a mutating method.
- **Recommended fix:** Separate non-touching session validation from explicit activity renewal. Specify which user events renew idle time, rate-limit renewal, and leave absolute/reauth deadlines unchanged.
- **Regression risk:** Do not expire actively used sessions or make background polling a new renewal source; preserve logout/revoke behavior.
- **Required validation:** Injected-clock tests with passive /ws snapshots/pings, active UI requests, idle and absolute bounds, and reauth/logout.
- **Confidence:** High: reproduced with real session/repository code in memory.

<a id="aud-006"></a>
## AUD-006 — P1 — A persistence failure can escape the WebSocket heartbeat and crash the hub

- **Affected source / lines:** server/realtime.js:54; server/auth/sessions.js:50; server/db/repository.js:46–58; server/lifecycle.js:43.
- **Primary file:** [server/realtime.js](../../server/realtime.js), line 54.
- **Function/module:** attachRealtime heartbeat.
- **Origin/classification:** New resilience defect.
- **Evidence:** The heartbeat invokes sessions.get() outside a try/catch. A touch may throw after a durable-write failure or when the repository is unhealthy. A mock-socket probe with a real attachRealtime timer callback confirmed the exception escapes.
- **Expected behavior:** Storage failure must produce a controlled degraded state, close affected sessions and preserve process safety behavior.
- **Actual behavior / consequence:** The timer callback can become an uncaught exception and terminate Node. Controller autonomous behavior then governs relock; AUD-001 makes that deployment combination especially serious. No live process was crashed.
- **Safe reproduction:** Capture the interval callback with fake timer/socket classes; make the session lookup throw 'Database persistence unavailable'; invoke it and observe the uncaught throw.
- **Root cause:** Session validation is potentially mutating/throwing, but only snapshot delivery has a catch boundary.
- **Recommended fix:** Guard each heartbeat/session validation and close affected sockets with a bounded diagnostic. Decouple renewal from validation (AUD-005); verify all timer/broker/worker callbacks contain expected storage failures.
- **Regression risk:** Avoid suppressing faults or continuing privileged requests on stale sessions; retain fail-closed control policy.
- **Required validation:** Inject ENOSPC/EIO and unhealthy repository states during real isolated WS pings and session touches; assert no uncaught exception, no unlock publication and visible fault.
- **Confidence:** High: exception escape reproduced in an isolated fake-socket harness; OS disk exhaustion not performed.

<a id="aud-007"></a>
## AUD-007 — P2 — Deleted default rooms are recreated on the next repository open

- **Affected source / lines:** server/db/repository.js:61–98, especially 89–93; server/app.js:93.
- **Primary file:** [server/db/repository.js](../../server/db/repository.js), line 89.
- **Function/module:** createRepository schema initialization.
- **Origin/classification:** New persistence regression.
- **Evidence:** Every open seeds a locations map from the fixed registry and INSERT OR IGNOREs those rooms, even for schema v5. A virtual-file in-memory restart probe deleted empty room-1, then reopened and found Room 1 restored.
- **Expected behavior:** Owner-deleted empty rooms must remain deleted after restart.
- **Actual behavior / consequence:** The removal API succeeds, but initialization silently recreates default rooms. The prior UI test only removed a newly created room within one process.
- **Safe reproduction:** Use a fully in-memory filesystem adapter; reassign room-1 devices, delete empty room-1, close and reopen the same virtual bytes.
- **Root cause:** One-time migration/backfill and every-start reconciliation are conflated.
- **Recommended fix:** Gate default-room backfill by an actual migration/bootstrap condition; preserve existing v5 room organization while retaining immutable hardware rows. Handle missing references explicitly.
- **Regression risk:** A repair must still initialize a new database and preserve legacy location migration and all seven device IDs.
- **Required validation:** New DB, original DB copy, repeated v5 open, rename/reassign/delete default room/restart, and custom room persistence.
- **Confidence:** High: reproduced with real repository code and no filesystem writes.

<a id="aud-008"></a>
## AUD-008 — P2 — Unchanged telemetry invalidates device metadata edits

- **Affected source / lines:** server/services/home.js:149–152; server/app.js:65–70; public/js/views.js:50–52.
- **Primary file:** [server/services/home.js](../../server/services/home.js), line 151.
- **Function/module:** Home.ingest and device metadata PUT.
- **Origin/classification:** New metadata/telemetry integration defect.
- **Evidence:** Every relay/door heartbeat updates devices.version. The Edit dialog captures d.version when opened. In memory, an unchanged light status heartbeat advanced version 2 to 3.
- **Expected behavior:** A name/room edit should conflict with another metadata edit, not unrelated telemetry.
- **Actual behavior / consequence:** Saving an open device dialog after a 30-second heartbeat (or another status report) returns VERSION_CONFLICT. Gas persistence updates can conflict every 10 seconds.
- **Safe reproduction:** Capture a device/version, ingest the same status again, validate the captured version as the metadata PUT does.
- **Root cause:** One version counter represents both observation churn and editable metadata.
- **Recommended fix:** Separate metadata and observation versions or use field-scoped optimistic concurrency. Continue protecting genuine concurrent edits and freshness ordering.
- **Regression risk:** Coordinate DTO/UI changes; do not remove concurrency checks globally or alter hardware IDs.
- **Required validation:** Metadata save after same-state and changed-state telemetry must succeed; two conflicting metadata editors must still return 409.
- **Confidence:** High: version collision reproduced; API guard traced.

<a id="aud-009"></a>
## AUD-009 — P2 — Speech replay presents historical device state as current

- **Affected source / lines:** server/services/assistant.js:5, 26–33, 47–55; public/js/main.js:41–46.
- **Primary file:** [server/services/assistant.js](../../server/services/assistant.js), line 55.
- **Function/module:** Assistant.speechText and queryText.
- **Origin/classification:** New voice-response defect.
- **Evidence:** Query answers cache device DTOs for 60 seconds. A probe queried light-1 off, ingested on, then speechText replayed 'Light 1: off'. Observed command speech also uses the historical action indefinitely while its command record remains available.
- **Expected behavior:** Replay should clearly replay a timestamped past answer or retrieve fresh state and qualify its age/uncertainty.
- **Actual behavior / consequence:** Present-tense output can contradict current reports or connectivity, including door status. Gas/motion spoken query labels also bypass the UI's more cautious 'No alert/motion reported' language.
- **Safe reproduction:** Use real Home/Assistant in memory, query a current light, change its report and call speechText for the answer ID; no synthesis or hardware needed.
- **Root cause:** Cached command/query outcomes are treated as present state without revalidation or temporal wording.
- **Recommended fix:** Define replay semantics explicitly; use recorded-time phrasing for historical results or re-read current observations with freshness. Share qualified sensor/controller wording across visual and spoken replies.
- **Regression risk:** Never turn a re-query/replay into a control request; preserve owned-result checks and no physical-verification claims.
- **Required validation:** State changes, disconnects, stale observations, auto-relock, expired result IDs and both output languages.
- **Confidence:** High: stale query replay reproduced; historical-command path confirmed by source.

<a id="aud-010"></a>
## AUD-010 — P2 — Live rerendering loses checkbox focus and collapses Help disclosures

- **Affected source / lines:** public/js/main.js:127–145, 147–160; public/js/navigation.js:33–48; public/js/views.js:19, 166–178, 202.
- **Primary file:** [public/js/main.js](../../public/js/main.js), line 135.
- **Function/module:** render, captureFocus, checkbox, helpView.
- **Origin/classification:** Current frontend regression/gap not covered by static axe checks.
- **Evidence:** Mocked Chromium: pressing Space on Large text left document.activeElement at BODY; an open Help/Lights details count changed from 1 to 0 after a single snapshot. The checkbox helper supplies neither a name nor an ID, so captureFocus cannot identify it.
- **Expected behavior:** Live status updates and preference changes must preserve keyboard position and the content being read.
- **Actual behavior / consequence:** Keyboard users restart navigation after toggling settings, and telemetry can repeatedly close Help content. Runtime snapshots arrive on gas data and on the five-second timer even without user actions.
- **Safe reproduction:** Fully intercepted browser: focus Large text and press Space; open Help/Lights and send a mocked init snapshot.
- **Root cause:** Whole-page replacement preserves selected text drafts only; unnamed controls and disclosure state lack restoration.
- **Recommended fix:** Patch stable DOM where feasible; otherwise assign stable control keys and preserve disclosure/open/focus state. Do not reconstruct unrelated settings/help panels for telemetry updates.
- **Regression risk:** Avoid retaining stale sensitive forms across logout/navigation or duplicating event handlers.
- **Required validation:** Keyboard-only traversal/toggle plus unrelated snapshots, reading Help during telemetry, radio/slider/select focus, dialog return focus and screen-reader live-region behavior.
- **Confidence:** High: reproduced in Chromium with all app traffic mocked.

<a id="aud-011"></a>
## AUD-011 — P2 — Hub disconnection leaves cached device reports looking current

- **Affected source / lines:** public/js/state.js:8; public/js/views.js:11, 21, 96–102; public/js/main.js:120–125.
- **Primary file:** [public/js/state.js](../../public/js/state.js), line 8.
- **Function/module:** socket.onclose and reported/deviceStatus selectors.
- **Origin/classification:** Current synchronization/UI integration gap.
- **Evidence:** Mocked Chromium closed the device socket: the page displayed 'Home hub unavailable' and still displayed 'Controller reports Locked'. reported(d) uses only the cached server freshness field; no client-side age/disconnect invalidation exists.
- **Expected behavior:** Once live reconciliation is lost, device cards should identify cached reports as last-known/unverified, with age.
- **Actual behavior / consequence:** Controls are disabled, but safety-sensitive state labels can remain current-looking indefinitely during an outage. The global banner mitigates but does not correct the contradictory per-device labels.
- **Safe reproduction:** Render fresh snapshot then close only the intercepted /ws connection and inspect the door heading.
- **Root cause:** Connection liveness and observation freshness are not combined in the presentation selector.
- **Recommended fix:** Derive effective display freshness from server evidence, elapsed time and hub connection. Keep cached data as last-known; do not change authoritative device state or persist fictional values.
- **Regression risk:** REST-only recovery and short reconnects need clear semantics; avoid showing physical verification or replaying commands.
- **Required validation:** Socket loss, HTTP loss, missed freshness deadlines while tab remains open/backgrounded, and reconnect with older/newer epoch snapshots.
- **Confidence:** High: reproduced in a fully mocked browser.

<a id="aud-012"></a>
## AUD-012 — P2 — Partial assistant-command failures disappear from the final response

- **Affected source / lines:** public/js/main.js:65–79; server/services/assistant.js:35–43.
- **Primary file:** [public/js/main.js](../../public/js/main.js), line 78.
- **Function/module:** executeIntent and updateCommandConversation.
- **Origin/classification:** New group-command feedback defect.
- **Evidence:** The server returns both commands and errors. The UI initially shows errors but stores only successful command IDs. When these become terminal, it replaces the response with only those commands. Mocked Room 1 off with light-2 unavailable ended as only 'Light 1: Controller reports off'.
- **Expected behavior:** Group results must retain a per-target account of success, uncertainty and failure.
- **Actual behavior / consequence:** The final answer omits the unavailable target and can imply that the entire requested group completed. Automatic speech replays only the first successful command.
- **Safe reproduction:** Intercept execute with one observed command and one DEVICE_UNAVAILABLE error; deliver matching snapshot and inspect final conversation.
- **Root cause:** Failure outcomes are not kept in conversation state used by terminal reconciliation.
- **Recommended fix:** Store outcomes for every requested target and render/speak an aggregate partial-success result without dropping errors. Keep idempotency and no automatic retry.
- **Regression risk:** Group completion must not wait forever for failed targets or publish duplicates on refresh.
- **Required validation:** All-success, all-failed, mixed observed/uncertain/failed, one missing snapshot record and both reply languages.
- **Confidence:** High: reproduced in mocked Chromium.

<a id="aud-013"></a>
## AUD-013 — P2 — Normal alert navigation cannot mark motion alerts read and the bell label goes stale

- **Affected source / lines:** public/js/views.js:144–150; public/js/main.js:101–102, 147–160; server/app.js:133–135.
- **Primary file:** [public/js/views.js](../../public/js/views.js), line 149.
- **Function/module:** alertsView and shell unread count.
- **Origin/classification:** Current alert/navigation integration defect.
- **Evidence:** Alert cards link 'View details' to /devices/:id, while automatic /read happens only on /security/alerts/:id. Mocked motion-alert list exposed only /devices/sensor-motion. Acknowledgment does not set read_at. The bell's accessible unread count is built once in buildShell and is not patched by onUpdate.
- **Expected behavior:** Users should be able to open/read every alert through the UI, and the bell count should track the current snapshot.
- **Actual behavior / consequence:** A normal motion alert remains unread despite viewing/acknowledging it; only critical gas banners currently offer an alert-detail route. Counts can remain stale until the shell rebuilds. The current bell count is in the accessible label, not a visible numeric badge.
- **Safe reproduction:** Mock an unread motion episode, open Alerts and inspect links; acknowledge in a memory API fixture and check receipt fields; update snapshot without navigation.
- **Root cause:** Device-detail and alert-detail destinations are mixed, and shell state is not fully updated.
- **Recommended fix:** Provide an explicit alert-detail link or mark the displayed episode read through a deliberate read interaction; preserve acknowledgment/resolution distinctions. Update the bell's accessible count from snapshots.
- **Regression risk:** Reading or acknowledging must never resolve an active sensor hazard.
- **Required validation:** Motion and gas alert discovery, read/ack independent receipts, live count changes, owner/resident/viewer behavior and reload.
- **Confidence:** High: route gap browser-confirmed; receipt/count behavior source-confirmed.

<a id="aud-014"></a>
## AUD-014 — P2 — Several async UI actions fail without visible feedback

- **Affected source / lines:** public/js/views.js:103, 149, 183; public/js/components.js:9, 51; public/js/main.js:16–17.
- **Primary file:** [public/js/views.js](../../public/js/views.js), line 149.
- **Function/module:** Alert acknowledgment, Check again and notification permission handlers.
- **Origin/classification:** Current interaction error-handling gap.
- **Evidence:** These handlers bypass ctx.run or modal error handling. With mocked acknowledgment HTTP 503, Chromium emitted an unhandled 'Request failed' and no toast-error/form-error appeared.
- **Expected behavior:** Every action should visibly report rejection and retain a meaningful retry path.
- **Actual behavior / consequence:** Acknowledgment and direct refresh errors can look like a nonfunctional button; duplicate clicks are not bounded for acknowledgment. Notification permission rejection likewise has no catch.
- **Safe reproduction:** Intercept /api/alerts/:id/acknowledge with JSON 503, click I've seen this, and inspect pageerror plus error UI.
- **Root cause:** button() attaches async listeners without a shared rejection boundary; only some callers handle errors.
- **Recommended fix:** Use an explicit asynchronous action wrapper with pending state and contextual inline error/notification. Keep dangerous-command retry manual and distinguish a failed read from an unknown command outcome.
- **Regression risk:** Do not hide server failures or retry mutations automatically.
- **Required validation:** 503, network abort, 401/403, rate limit and duplicate-click cases for every direct async callback.
- **Confidence:** High: acknowledgment failure reproduced; other handlers source-confirmed.

<a id="aud-015"></a>
## AUD-015 — P2 — Invalid Activity filters remove the controls needed to recover

- **Affected source / lines:** public/js/views.js:128–142; public/js/main.js:145.
- **Primary file:** [public/js/views.js](../../public/js/views.js), line 132.
- **Function/module:** activityView filter parsing.
- **Origin/classification:** New URL-filter navigation edge-case defect.
- **Evidence:** new Date(...).toISOString() runs before rendering filter fields. Mocked /security/activity?from=bad rendered zero date fields, zero Clear filters controls and one Try again button.
- **Expected behavior:** Invalid/deleted/bookmarked filters should leave editable filters and a safe reset action.
- **Actual behavior / consequence:** Retry repeats the same invalid URL and failure. Valid dates in reverse order similarly produce API errors before controls render.
- **Safe reproduction:** Directly load the listed URL in the fully intercepted browser; no backend mutation needed.
- **Root cause:** Untrusted URL parameters are converted/fetched before validation and before building recovery controls.
- **Recommended fix:** Validate date syntax/range at the route boundary, normalize only accepted values, and render filter/reset controls even when fetching fails.
- **Regression risk:** Preserve local-day boundaries, valid query state, cursor caches and history restoration.
- **Required validation:** Malformed dates, out-of-range dates, reversed bounds, unknown device filters, empty results, API failure, refresh and Back/Forward.
- **Confidence:** High: malformed date route reproduced.

<a id="aud-016"></a>
## AUD-016 — P2 — Restore replaces the live database before checking schema compatibility

- **Affected source / lines:** server/scripts/recovery.js:3–23; server/db/repository.js:62.
- **Primary file:** [server/scripts/recovery.js](../../server/scripts/recovery.js), line 21.
- **Function/module:** inspectBackup and restoreBackup.
- **Origin/classification:** New recovery-tool defect.
- **Evidence:** inspectBackup checks SQLite integrity and seven IDs but not schema version/required schema compatibility. An in-memory valid SQLite fixture with user_version=6 was accepted. restoreBackup renames it over the destination before createRepository rejects versions above 5.
- **Expected behavior:** An incompatible backup must be rejected before the current database is replaced.
- **Actual behavior / consequence:** A stopped hub can be left with an unstartable database after a failed restore. A before-restore copy is saved, so this is recoverable downtime, not demonstrated permanent data loss.
- **Safe reproduction:** Call inspectBackup with virtual bytes for a version-6 fixture. Do not run restore against the real database.
- **Root cause:** Migration/runtime validation occurs after the destructive swap rather than in a disposable preflight.
- **Recommended fix:** Validate schema support and required tables/columns, then trial-open/migrate a disposable copy before an exclusive durable replacement. On post-swap failure restore the prior validated file automatically or retain an explicit recovery result.
- **Regression risk:** Must still accept supported legacy backups and invalidate restored sessions/pending commands without replay.
- **Required validation:** Future-version, missing-column, corrupt/checksum-mismatched, supported legacy/v5 and failure-at-each-swap-step fixtures; no production paths.
- **Confidence:** High: incompatible preflight acceptance reproduced; destructive restore path inspected only.

<a id="aud-017"></a>
## AUD-017 — P2 — Automatic spoken reply language follows UI language instead of the interpreted reply

- **Affected source / lines:** public/js/main.js:41–45, 64; server/services/assistant.js:29–31.
- **Primary file:** [public/js/main.js](../../public/js/main.js), line 43.
- **Function/module:** ctx.speak automatic language selection.
- **Origin/classification:** New frontend/backend voice-language mismatch.
- **Evidence:** Backend selects Hindi for a Hindi query with automatic reply language. In mocked Chromium with English UI, the Hindi answer was displayed but the speech POST requested language=en.
- **Expected behavior:** Automatic text and spoken replies should follow one defined language decision; interface language is a fallback, not an unrelated override.
- **Actual behavior / consequence:** Users can receive Hindi text and English spoken output for the same answer despite selecting Automatic.
- **Safe reproduction:** Mock a Hindi query answer with language=hi, spoken replies enabled, reply_language=auto and English interface; inspect the speech request body.
- **Root cause:** The browser discards answer.language when selecting synthesis language.
- **Recommended fix:** Retain resolved reply language on query/control result state and use it for playback/replay. Define a documented fallback for mixed-language input and test voice checks separately.
- **Regression risk:** Do not alter UI language, user reply preferences or supported voice validation.
- **Required validation:** All input/reply/UI language combinations, Hindi and Hinglish cases, auto and explicit overrides, replay and test phrase.
- **Confidence:** High: request mismatch reproduced in mocked Chromium.

<a id="aud-018"></a>
## AUD-018 — P3 — Large controls does not enlarge several common targets

- **Affected source / lines:** public/css/app.css:4, 7, 121–122, 171; public/js/views.js:27, 84.
- **Primary file:** [public/css/app.css](../../public/css/app.css), line 121.
- **Function/module:** Target-size tokens versus favorite/filter rules.
- **Origin/classification:** Current component consistency defect.
- **Evidence:** Large controls changes --target/--button to 56px, but favorites and filter chips use fixed 48px rules. Mocked Chromium measured a favorite button at 48px after enabling Large controls.
- **Expected behavior:** The advertised larger-control preference should consistently affect essential controls, per the 56px design specification.
- **Actual behavior / consequence:** These targets remain at the normal size. They still meet the project's normal 48px minimum; this is not claimed to be a WCAG target-size failure.
- **Safe reproduction:** Enable the preference on mocked Devices and measure .favorite-button; inspect fixed chip declarations.
- **Root cause:** Some components bypass the semantic target-size tokens.
- **Recommended fix:** Apply the shared target token to these controls, allowing intrinsic growth and wrapping in every theme.
- **Regression risk:** Check narrow Hindi layouts and bottom-navigation density; retain visible focus and usable card proportions.
- **Required validation:** Computed target sizes with/without Large controls and Theme03; 320px reflow and keyboard focus.
- **Confidence:** High: favorite size reproduced; other fixed declarations inspected.

<a id="aud-019"></a>
## AUD-019 — P2 — Assistant readiness labels do not update when workers become ready or fail

- **Affected source / lines:** public/js/main.js:51–56, 157; public/js/views.js:218, 222–226.
- **Primary file:** [public/js/main.js](../../public/js/main.js), line 157.
- **Function/module:** onUpdate Assistant fast path.
- **Origin/classification:** Current dynamic Assistant UI defect.
- **Evidence:** Assistant live updates patch the microphone and conversation only. A mocked missing-to-ready snapshot enabled the mic while 'Local setup required' and 'Voice needs local setup. You can still type.' both remained visible.
- **Expected behavior:** Readiness badges, instructions, microphone state and retry guidance must describe the same current worker state.
- **Actual behavior / consequence:** The screen gives contradictory instructions until navigation/rerender. The reverse transition can leave an old Ready locally badge after worker failure.
- **Safe reproduction:** Load Assistant with stt_ready=false, deliver a mocked snapshot with stt_ready=true and inspect mic plus labels.
- **Root cause:** The specialized update path omits readiness-dependent nodes created at initial render.
- **Recommended fix:** Keep stable readiness elements with an explicit update method covering both transitions. Distinguish microphone readiness, processing and service failure without restarting capture.
- **Regression risk:** Preserve conversation drafts/focus and never start the microphone when readiness changes.
- **Required validation:** Cold startup, worker crash, model-unavailable, reconnect, TTS-only failure and foreground/background transitions with zero automatic capture.
- **Confidence:** High: missing-to-ready transition reproduced in Chromium.

