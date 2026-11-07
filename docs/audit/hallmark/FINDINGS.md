# Findings — preserved Astra IDs and new Hallmark discoveries

2026-11-06. **21 total: 19 retained AUD findings + 2 new P2 HUI findings.** No fixes were made. The authoritative original descriptions remain in [BUG_REPORT.md](../BUG_REPORT.md). This continuation preserves IDs, severity and evidence limits.

“Open by unchanged source” means the earlier failing path is still byte-identical; it does not mean a second physical/backend reproduction was performed. 125/125 protected hashes matched. No “fixed,” “regressed” or exploited-hardware status was inferred.

## HUI-001 — Startup service errors incorrectly open the sign-in screen

- **Priority:** P2. Recovery is misleading and can block nontechnical users during ordinary hub/network failure; no authorization bypass is demonstrated.
- **Hallmark linkage / tier:** flow.md App screens, error state; interaction-and-states.md error/recovery. Correctness/access floor principle, **not an emitted numbered sloplint failure**.
- **Route / state / audience:** Any first-load route; reproduced at / after successful synthetic guest session and failed snapshot. Theme 05 normal and Theme 04 large settings,390px. All themes share the startup handler. Affects guest-preview users who have no login credentials and authenticated residents whose failure is not an expired session.
- **Source:** [public/js/main.js:180](../../../public/js/main.js), with renderLogin at:162–170 and Api error classification in public/js/api.js:9–12.
- **Observed:** GET /api/auth/session returned an owner-shaped preview session. GET /api/snapshot returned503. The page displayed Username, Password, Sign in and owner setup instructions; it did not explain hub availability or offer a startup retry.
- **Expected:** Preserve the distinction between authentication-required and network/service failure. Offer a truthful hub-unavailable/loading recovery view. The preview should return to its authorized guest flow once service recovers.
- **Evidence:** Intercepted Chromium + source. probe-results.json → probes.bootFailure.login=1. [Screenshot](C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/run/evidence/probe-boot-failure.png). Final screenshot is Theme 04,390px with large text/controls. First run also reproduced in Theme 05.
- **Safe reproduction:** In a copied-source browser, fulfill session with preview:true; fail only snapshot with503; load /. No live server or credentials are needed.
- **Cause:** The unconditional catch surrounding both session fetch and snapshot initialization calls renderLogin for every failure.
- **Relation to prior IDs:** New. AUD-014 concerns direct async action callbacks after the app loads; this is a different startup error boundary that deliberately renders the wrong state. AUD-005 session expiry policy remains a separate backend issue.
- **Smallest recommended repair:** Classify401/session absence separately from transport/5xx/invalid response. Render a recoverable bootstrap error view with Retry, retaining the language/theme. Do not remove production authentication, silently create users, or treat cached hardware state as current.
- **Regression risks:** Accidentally bypassing auth; retaining expired session controls; retry storms; starting duplicate sockets or replaying device mutations.
- **Mock-only validation:** Session401 → legitimate production sign-in; guest session + snapshot 503/network timeout → unavailable + Retry; success after Retry → guest Home with no login controls; expired session during retry → protected sign-in; assert zero command requests and one socket owner.
- **Confidence:** High for software behavior. Server failure frequency, real network conditions and household usability impact were not measured.

## HUI-002 — Data-dependent navigation has a blank loading region

- **Priority:** P2. Missing feedback and contextual navigation make slow requests appear broken, especially to older users. Primary navigation/My Home remain available, so this is not a total navigation lockout.
- **Hallmark linkage / tier:** flow.md App screens: loading/empty/error/full; interaction-and-states.md Loading and empty. Functional state requirement under the correctness floor principle; **no numbered sloplint gate is invented**.
- **Route / state / audience:** Reproduced Security → /security/access-cards with a held read response at 390px, Theme 05 normal and Theme 04 large controls/text. Source-derived analogous paths: Activity, Advanced and Local AI. Affects users on slow local networks or a busy hub.
- **Source:** [public/js/main.js:132](../../../public/js/main.js)–145; public/js/views.js:110–112,128–134,203–206.
- **Observed:** During an intentionally unresolved GET /api/logs/rfid-cards, main.innerText was empty, main contained zero busy/status indicators, and .back-control count was0. URL had already changed to the destination. After the held response completed, the card page appeared. A503 renders generic Unavailable/Retry without the usual destination header.
- **Expected:** Show the destination title and valid Back control immediately with a visible, accessible loading state; preserve them around recoverable fetch errors. Do not expose stale device actions as if they belong to the new route.
- **Evidence:** Intercepted Chromium + source; probe-results.json → probes.loading {text:"",busy:0,back:0}. [Screenshot](C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/run/evidence/probe-loading-cards.png). The held-response observation was taken after 200ms; source shows it lasts until the awaited response/timeout. No delay duration was invented.
- **Safe reproduction:** Open Security in the copied-source harness. Hold only the mocked RFID list GET. Select Access cards, inspect the empty main and absent Back, then release the response. Never add/remove cards.
- **Cause:** Navigation rebuilds the shell; render awaits the entire async view before adding frameView/title/navigation. The catch also replaces the whole main region.
- **Relation to prior IDs:** New. AUD-015 is malformed filter validation with no reset controls; AUD-010 is destructive rerender focus/read-state loss. Neither previously covered slow route loading. Fixes should coordinate around the shared render boundary without collapsing IDs.
- **Smallest recommended repair:** Render a stable route frame and progress/error region before async data work; retain render-generation guards so old responses cannot overwrite a newer route. Use static progress text or reduced-motion-safe skeletons, not a cosmetic artificial delay.
- **Regression risks:** Stale async responses replacing the current route; focus being stolen after navigation; duplicate reads/sockets; exposing cached controls during logout; changes to history/back semantics.
- **Mock-only validation:** Hold each cards/activity/system/models response; assert destination title, Back and named loading state. Navigate away before resolving and ensure no overwrite. Test timeout503/401, Retry, browser Back/Forward, reduced motion, focus and all four themes. Assert no mutation requests.
- **Confidence:** High for the reproduced cards path; analogous routes are source-derived and should each receive a regression test.

## Prior finding crosswalk

|ID|Priority|Finding|Current status|Hallmark connection|
|---|---|---|---|---|
|AUD-001|P0|Door auto-lock is blocked by network reconnection|Open; source unchanged; prior evidence retained|Outside UI gates; physical safety restriction|
|AUD-002|P1|No deployable secure broker/firmware combination is supplied|Open; source unchanged; prior evidence retained|Outside UI gates; deployment compatibility|
|AUD-003|P1|The original private TLS key remains publicly retrievable|Open; source unchanged; prior evidence retained|Outside UI gates; credential lifecycle|
|AUD-004|P1|The intent parser turns questions and unsupported compound requests into actions|Open; source unchanged; prior evidence retained|App interaction semantics and honest command interpretation|
|AUD-005|P1|Passive WebSocket traffic defeats the documented 30-minute idle logout|Open; source unchanged; prior evidence retained|Outside UI gates; session lifecycle|
|AUD-006|P1|A persistence failure can escape the WebSocket heartbeat and crash the hub|Open; source unchanged; prior evidence retained|Outside UI gates; failure containment|
|AUD-007|P2|Deleted default rooms are recreated on the next repository open|Open; source unchanged; prior evidence retained|App durable organization (backend cause)|
|AUD-008|P2|Unchanged telemetry invalidates device metadata edits|Open; source unchanged; prior evidence retained|App error/metadata state (backend cause)|
|AUD-009|P2|Speech replay presents historical device state as current|Open; source unchanged; prior evidence retained|46a honesty principle; spoken freshness (not a literal metric-gate hit)|
|AUD-010|P2|Live rerendering loses checkbox focus and collapses Help disclosures|Open; reproduced again in copied/mock browser|26a Floor/access principle; App screens interaction stability|
|AUD-011|P2|Hub disconnection leaves cached device reports looking current|Open; reproduced again in copied/mock browser|App stale/disconnected states; honesty principle|
|AUD-012|P2|Partial assistant-command failures disappear from the final response|Open; source unchanged; prior evidence retained|Eight-state result/error feedback; honesty principle|
|AUD-013|P2|Normal alert navigation cannot mark motion alerts read and the bell label goes stale|Open; source unchanged; prior evidence retained|App navigation and live accessible labels|
|AUD-014|P2|Several async UI actions fail without visible feedback|Open; source unchanged; prior evidence retained|Eight-state error feedback|
|AUD-015|P2|Invalid Activity filters remove the controls needed to recover|Open; reproduced again in copied/mock browser|App URL state and error recovery|
|AUD-016|P2|Restore replaces the live database before checking schema compatibility|Open; source unchanged; prior evidence retained|Outside UI gates; recovery integrity|
|AUD-017|P2|Automatic spoken reply language follows UI language instead of the interpreted reply|Open; source unchanged; prior evidence retained|App language/result consistency|
|AUD-018|P3|Large controls does not enlarge several common targets|Open; reproduced again in copied/mock browser|Interaction hit targets + stricter project56px contract|
|AUD-019|P2|Assistant readiness labels do not update when workers become ready or fail|Open; reproduced again in copied/mock browser|App readiness/loading/error consistency|

## Preserved evidence and scope

### AUD-001 — Door auto-lock is blocked by network reconnection

- **Status / provenance:** Open; retained prior reproduction/source assessment plus unchanged protected-file hash. Inherited, documented release blocker.
- **Source:** firmware/door_security/door_security.ino:61–79, 109–126, 191–213, 254–272.
- **Hallmark relation:** Outside UI gates; physical safety restriction. This is the same issue, not an HUI duplicate.
- **Evidence retained:** The relay is driven HIGH on unlock. loop() calls blocking Wi-Fi/MQTT reconnect before checking the 5-second unlock deadline. connectMQTT() can loop indefinitely; accessDenied() also blocks for about 1.2 seconds.
- **Expected:** Relock timing must remain enforceable independently of connectivity and message handling.
- **Actual / affected users:** An outage after unlock can leave the energized unlock output on beyond its intended interval. The exact physical lock/fail-mode consequence requires a supervised fixture. The current backend door gate defaults off; this is an inherited firmware hazard, not a claim that this audit unlocked a door.
- **Safe reproduction reference:** Source/control-flow inspection only. Future safe bench test: disconnected lock/indicator load, trigger simulated unlock, remove broker/Wi-Fi availability and measure GPIO deadline.
- **Priority and confidence:** P0; High: confirmed source hazard; physical consequence untested.
- **Scope:** Use the original BUG_REPORT.md scope; server/firmware issues are theme/viewport-independent. No new live or hardware test was performed.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-002 — No deployable secure broker/firmware combination is supplied

- **Status / provenance:** Open; retained prior reproduction/source assessment plus unchanged protected-file hash. Intentional hardening with an incomplete deployment migration, not an accidental MQTT topic regression.
- **Source:** server/mqtt/broker.js:2–7; server/lifecycle.js:21; firmware/light_controller/light_controller.ino:18–20, 42–43, 126–127; firmware/door_security/door_security.ino:20–22, 46–47, 196–197; deploy/mosquitto.conf.example:3–10.
- **Hallmark relation:** Outside UI gates; deployment compatibility. This is the same issue, not an HUI duplicate.
- **Evidence retained:** Backend now requires username/password, and remote brokers must use TLS. Both supplied sketches use WiFiClient, port 1883 and NULL credentials. The example broker exposes authenticated TLS on loopback 8883.
- **Expected:** A documented, buildable authenticated firmware/broker/hub path must exist before claiming existing hardware works with the new runtime.
- **Actual / affected users:** Topics/payloads match, but the supplied sketches cannot connect to the supplied secure broker template. Starting with defaults intentionally controls no hardware. A hybrid legacy broker is not verified or a safe substitute.
- **Safe reproduction reference:** Compare transport settings and connection calls; do not connect to a real broker.
- **Priority and confidence:** P1; High: configuration incompatibility confirmed; actual broker and installed firmware unknown.
- **Scope:** Use the original BUG_REPORT.md scope; server/firmware issues are theme/viewport-independent. No new live or hardware test was performed.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-003 — The original private TLS key remains publicly retrievable

- **Status / provenance:** Open; retained prior reproduction/source assessment plus unchanged protected-file hash. Inherited exposure, partially mitigated by new runtime defaults.
- **Source:** server/certs/server.key (whole credential file; contents omitted); server/config/config.js:11–13; server/lifecycle.js:19, 27, 36; .gitignore:4–5.
- **Hallmark relation:** Outside UI gates; credential lifecycle. This is the same issue, not an HUI duplicate.
- **Evidence retained:** The public original repository tree still contains server/certs/server.key. A local Git-blob SHA-1 comparison matched that public blob exactly, without printing the key. The active runtime defaults to .local/tls and does not automatically use it.
- **Expected:** No deployment may trust or reuse an exposed server private key.
- **Actual / affected users:** Legacy deployments or clients that still trust this key are vulnerable to impersonation under an appropriate network position. Whether any household still trusts it is unverified. Ignoring it locally does not remove public history.
- **Safe reproduction reference:** Read-only public tree/local blob equality; no impersonation or intrusive test was performed.
- **Priority and confidence:** P1; High: public exposure confirmed; active exploitation/use not established.
- **Scope:** Use the original BUG_REPORT.md scope; server/firmware issues are theme/viewport-independent. No new live or hardware test was performed.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-004 — The intent parser turns questions and unsupported compound requests into actions

- **Status / provenance:** Open; retained prior reproduction/source assessment plus unchanged protected-file hash. New parser/typed-flow defect in the current implementation.
- **Source:** server/voice/intent.js:20–46; public/js/main.js:39, 59–62, 82–86; server/services/assistant.js:18–43.
- **Hallmark relation:** App interaction semantics and honest command interpretation. This is the same issue, not an HUI duplicate.
- **Evidence retained:** Pure probes returned control/on for 'Is light 1 on?', control/off for 'Check if light 2 is off' and 'क्या लाइट 1 बंद है'. 'turn on light 1 tomorrow' becomes an immediate action; 'turn off light 1 and room 2 lights' silently selects only light-1. Explicit light-99 and 'do not unlock door' correctly reject.
- **Expected:** Questions must query; temporal/conditional or partially understood requests must reject or clarify without actuating.
- **Actual / affected users:** Typed requests automatically execute the parsed control without the voice-review dialog. Recognized voice controls are reviewed, which reduces but does not repair semantic misclassification. Direct voice/text unlock is still blocked.
- **Safe reproduction reference:** Call resolveCommand with the fixed registry and the listed strings; no publisher required. Mock the Assistant UI and assert no execute-control call for questions.
- **Priority and confidence:** P1; High: reproduced in pure parser execution; physical actuation not tested.
- **Scope:** Use the original BUG_REPORT.md scope; server/firmware issues are theme/viewport-independent. No new live or hardware test was performed.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-005 — Passive WebSocket traffic defeats the documented 30-minute idle logout

- **Status / provenance:** Open; retained prior reproduction/source assessment plus unchanged protected-file hash. New security behavior contradicting SECURITY.md and RUNTIME_CONTRACTS.md.
- **Source:** server/auth/sessions.js:46–51; server/realtime.js:18–21, 54; server/lifecycle.js:43.
- **Hallmark relation:** Outside UI gates; session lifecycle. This is the same issue, not an HUI duplicate.
- **Evidence retained:** get() writes last_active_at on validation every minute. Device snapshots and 20-second socket heartbeats call get() without human activity. An injected-clock probe stayed authenticated after 30 minutes 20 seconds of passive checks.
- **Expected:** Documented idle expiry should measure meaningful authenticated user activity, independently from connection liveness.
- **Actual / affected users:** An open unattended dashboard remains usable until absolute expiry (up to 8 hours), rather than expiring after 30 idle minutes. Recent unlock reauthentication still expires separately.
- **Safe reproduction reference:** In-memory session; advance clock by 20 seconds and call get() 91 times without user input. Session remains valid.
- **Priority and confidence:** P1; High: reproduced with real session/repository code in memory.
- **Scope:** Use the original BUG_REPORT.md scope; server/firmware issues are theme/viewport-independent. No new live or hardware test was performed.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-006 — A persistence failure can escape the WebSocket heartbeat and crash the hub

- **Status / provenance:** Open; retained prior reproduction/source assessment plus unchanged protected-file hash. New resilience defect.
- **Source:** server/realtime.js:54; server/auth/sessions.js:50; server/db/repository.js:46–58; server/lifecycle.js:43.
- **Hallmark relation:** Outside UI gates; failure containment. This is the same issue, not an HUI duplicate.
- **Evidence retained:** The heartbeat invokes sessions.get() outside a try/catch. A touch may throw after a durable-write failure or when the repository is unhealthy. A mock-socket probe with a real attachRealtime timer callback confirmed the exception escapes.
- **Expected:** Storage failure must produce a controlled degraded state, close affected sessions and preserve process safety behavior.
- **Actual / affected users:** The timer callback can become an uncaught exception and terminate Node. Controller autonomous behavior then governs relock; AUD-001 makes that deployment combination especially serious. No live process was crashed.
- **Safe reproduction reference:** Capture the interval callback with fake timer/socket classes; make the session lookup throw 'Database persistence unavailable'; invoke it and observe the uncaught throw.
- **Priority and confidence:** P1; High: exception escape reproduced in an isolated fake-socket harness; OS disk exhaustion not performed.
- **Scope:** Use the original BUG_REPORT.md scope; server/firmware issues are theme/viewport-independent. No new live or hardware test was performed.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-007 — Deleted default rooms are recreated on the next repository open

- **Status / provenance:** Open; retained prior reproduction/source assessment plus unchanged protected-file hash. New persistence regression.
- **Source:** server/db/repository.js:61–98, especially 89–93; server/app.js:93.
- **Hallmark relation:** App durable organization (backend cause). This is the same issue, not an HUI duplicate.
- **Evidence retained:** Every open seeds a locations map from the fixed registry and INSERT OR IGNOREs those rooms, even for schema v5. A virtual-file in-memory restart probe deleted empty room-1, then reopened and found Room 1 restored.
- **Expected:** Owner-deleted empty rooms must remain deleted after restart.
- **Actual / affected users:** The removal API succeeds, but initialization silently recreates default rooms. The prior UI test only removed a newly created room within one process.
- **Safe reproduction reference:** Use a fully in-memory filesystem adapter; reassign room-1 devices, delete empty room-1, close and reopen the same virtual bytes.
- **Priority and confidence:** P2; High: reproduced with real repository code and no filesystem writes.
- **Scope:** Use the original BUG_REPORT.md scope; server/firmware issues are theme/viewport-independent. No new live or hardware test was performed.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-008 — Unchanged telemetry invalidates device metadata edits

- **Status / provenance:** Open; retained prior reproduction/source assessment plus unchanged protected-file hash. New metadata/telemetry integration defect.
- **Source:** server/services/home.js:149–152; server/app.js:65–70; public/js/views.js:50–52.
- **Hallmark relation:** App error/metadata state (backend cause). This is the same issue, not an HUI duplicate.
- **Evidence retained:** Every relay/door heartbeat updates devices.version. The Edit dialog captures d.version when opened. In memory, an unchanged light status heartbeat advanced version 2 to 3.
- **Expected:** A name/room edit should conflict with another metadata edit, not unrelated telemetry.
- **Actual / affected users:** Saving an open device dialog after a 30-second heartbeat (or another status report) returns VERSION_CONFLICT. Gas persistence updates can conflict every 10 seconds.
- **Safe reproduction reference:** Capture a device/version, ingest the same status again, validate the captured version as the metadata PUT does.
- **Priority and confidence:** P2; High: version collision reproduced; API guard traced.
- **Scope:** Use the original BUG_REPORT.md scope; server/firmware issues are theme/viewport-independent. No new live or hardware test was performed.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-009 — Speech replay presents historical device state as current

- **Status / provenance:** Open; retained prior reproduction/source assessment plus unchanged protected-file hash. New voice-response defect.
- **Source:** server/services/assistant.js:5, 26–33, 47–55; public/js/main.js:41–46.
- **Hallmark relation:** 46a honesty principle; spoken freshness (not a literal metric-gate hit). This is the same issue, not an HUI duplicate.
- **Evidence retained:** Query answers cache device DTOs for 60 seconds. A probe queried light-1 off, ingested on, then speechText replayed 'Light 1: off'. Observed command speech also uses the historical action indefinitely while its command record remains available.
- **Expected:** Replay should clearly replay a timestamped past answer or retrieve fresh state and qualify its age/uncertainty.
- **Actual / affected users:** Present-tense output can contradict current reports or connectivity, including door status. Gas/motion spoken query labels also bypass the UI's more cautious 'No alert/motion reported' language.
- **Safe reproduction reference:** Use real Home/Assistant in memory, query a current light, change its report and call speechText for the answer ID; no synthesis or hardware needed.
- **Priority and confidence:** P2; High: stale query replay reproduced; historical-command path confirmed by source.
- **Scope:** Use the original BUG_REPORT.md scope; server/firmware issues are theme/viewport-independent. No new live or hardware test was performed.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-010 — Live rerendering loses checkbox focus and collapses Help disclosures

- **Status / provenance:** Open; new isolated browser reproduction plus unchanged protected-file hash. Current frontend regression/gap not covered by static axe checks.
- **Source:** public/js/main.js:127–145, 147–160; public/js/navigation.js:33–48; public/js/views.js:19, 166–178, 202.
- **Hallmark relation:** 26a Floor/access principle; App screens interaction stability. This is the same issue, not an HUI duplicate.
- **Evidence retained:** Mocked Chromium: pressing Space on Large text left document.activeElement at BODY; an open Help/Lights details count changed from 1 to 0 after a single snapshot. The checkbox helper supplies neither a name nor an ID, so captureFocus cannot identify it.
- **Expected:** Live status updates and preference changes must preserve keyboard position and the content being read.
- **Actual / affected users:** Keyboard users restart navigation after toggling settings, and telemetry can repeatedly close Help content. Runtime snapshots arrive on gas data and on the five-second timer even without user actions.
- **Safe reproduction reference:** Fully intercepted browser: focus Large text and press Space; open Help/Lights and send a mocked init snapshot.
- **Priority and confidence:** P2; High: reproduced in Chromium with all app traffic mocked.
- **Scope:** Frontend state is shared across all four themes; fresh probe at 390px. Theme 05 default and corrected Theme 04/large-mode probe; do not infer every theme/state combination was independently reproduced.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-011 — Hub disconnection leaves cached device reports looking current

- **Status / provenance:** Open; new isolated browser reproduction plus unchanged protected-file hash. Current synchronization/UI integration gap.
- **Source:** public/js/state.js:8; public/js/views.js:11, 21, 96–102; public/js/main.js:120–125.
- **Hallmark relation:** App stale/disconnected states; honesty principle. This is the same issue, not an HUI duplicate.
- **Evidence retained:** Mocked Chromium closed the device socket: the page displayed 'Home hub unavailable' and still displayed 'Controller reports Locked'. reported(d) uses only the cached server freshness field; no client-side age/disconnect invalidation exists.
- **Expected:** Once live reconciliation is lost, device cards should identify cached reports as last-known/unverified, with age.
- **Actual / affected users:** Controls are disabled, but safety-sensitive state labels can remain current-looking indefinitely during an outage. The global banner mitigates but does not correct the contradictory per-device labels.
- **Safe reproduction reference:** Render fresh snapshot then close only the intercepted /ws connection and inspect the door heading.
- **Priority and confidence:** P2; High: reproduced in a fully mocked browser.
- **Scope:** Frontend state is shared across all four themes; fresh probe at 390px. Theme 05 default and corrected Theme 04/large-mode probe; do not infer every theme/state combination was independently reproduced.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-012 — Partial assistant-command failures disappear from the final response

- **Status / provenance:** Open; retained prior reproduction/source assessment plus unchanged protected-file hash. New group-command feedback defect.
- **Source:** public/js/main.js:65–79; server/services/assistant.js:35–43.
- **Hallmark relation:** Eight-state result/error feedback; honesty principle. This is the same issue, not an HUI duplicate.
- **Evidence retained:** The server returns both commands and errors. The UI initially shows errors but stores only successful command IDs. When these become terminal, it replaces the response with only those commands. Mocked Room 1 off with light-2 unavailable ended as only 'Light 1: Controller reports off'.
- **Expected:** Group results must retain a per-target account of success, uncertainty and failure.
- **Actual / affected users:** The final answer omits the unavailable target and can imply that the entire requested group completed. Automatic speech replays only the first successful command.
- **Safe reproduction reference:** Intercept execute with one observed command and one DEVICE_UNAVAILABLE error; deliver matching snapshot and inspect final conversation.
- **Priority and confidence:** P2; High: reproduced in mocked Chromium.
- **Scope:** Use the original BUG_REPORT.md scope; server/firmware issues are theme/viewport-independent. No new live or hardware test was performed.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-013 — Normal alert navigation cannot mark motion alerts read and the bell label goes stale

- **Status / provenance:** Open; retained prior reproduction/source assessment plus unchanged protected-file hash. Current alert/navigation integration defect.
- **Source:** public/js/views.js:144–150; public/js/main.js:101–102, 147–160; server/app.js:133–135.
- **Hallmark relation:** App navigation and live accessible labels. This is the same issue, not an HUI duplicate.
- **Evidence retained:** Alert cards link 'View details' to /devices/:id, while automatic /read happens only on /security/alerts/:id. Mocked motion-alert list exposed only /devices/sensor-motion. Acknowledgment does not set read_at. The bell's accessible unread count is built once in buildShell and is not patched by onUpdate.
- **Expected:** Users should be able to open/read every alert through the UI, and the bell count should track the current snapshot.
- **Actual / affected users:** A normal motion alert remains unread despite viewing/acknowledging it; only critical gas banners currently offer an alert-detail route. Counts can remain stale until the shell rebuilds. The current bell count is in the accessible label, not a visible numeric badge.
- **Safe reproduction reference:** Mock an unread motion episode, open Alerts and inspect links; acknowledge in a memory API fixture and check receipt fields; update snapshot without navigation.
- **Priority and confidence:** P2; High: route gap browser-confirmed; receipt/count behavior source-confirmed.
- **Scope:** Use the original BUG_REPORT.md scope; server/firmware issues are theme/viewport-independent. No new live or hardware test was performed.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-014 — Several async UI actions fail without visible feedback

- **Status / provenance:** Open; retained prior reproduction/source assessment plus unchanged protected-file hash. Current interaction error-handling gap.
- **Source:** public/js/views.js:103, 149, 183; public/js/components.js:9, 51; public/js/main.js:16–17.
- **Hallmark relation:** Eight-state error feedback. This is the same issue, not an HUI duplicate.
- **Evidence retained:** These handlers bypass ctx.run or modal error handling. With mocked acknowledgment HTTP 503, Chromium emitted an unhandled 'Request failed' and no toast-error/form-error appeared.
- **Expected:** Every action should visibly report rejection and retain a meaningful retry path.
- **Actual / affected users:** Acknowledgment and direct refresh errors can look like a nonfunctional button; duplicate clicks are not bounded for acknowledgment. Notification permission rejection likewise has no catch.
- **Safe reproduction reference:** Intercept /api/alerts/:id/acknowledge with JSON 503, click I've seen this, and inspect pageerror plus error UI.
- **Priority and confidence:** P2; High: acknowledgment failure reproduced; other handlers source-confirmed.
- **Scope:** Use the original BUG_REPORT.md scope; server/firmware issues are theme/viewport-independent. No new live or hardware test was performed.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-015 — Invalid Activity filters remove the controls needed to recover

- **Status / provenance:** Open; new isolated browser reproduction plus unchanged protected-file hash. New URL-filter navigation edge-case defect.
- **Source:** public/js/views.js:128–142; public/js/main.js:145.
- **Hallmark relation:** App URL state and error recovery. This is the same issue, not an HUI duplicate.
- **Evidence retained:** new Date(...).toISOString() runs before rendering filter fields. Mocked /security/activity?from=bad rendered zero date fields, zero Clear filters controls and one Try again button.
- **Expected:** Invalid/deleted/bookmarked filters should leave editable filters and a safe reset action.
- **Actual / affected users:** Retry repeats the same invalid URL and failure. Valid dates in reverse order similarly produce API errors before controls render.
- **Safe reproduction reference:** Directly load the listed URL in the fully intercepted browser; no backend mutation needed.
- **Priority and confidence:** P2; High: malformed date route reproduced.
- **Scope:** Frontend state is shared across all four themes; fresh probe at 390px. Theme 05 default and corrected Theme 04/large-mode probe; do not infer every theme/state combination was independently reproduced.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-016 — Restore replaces the live database before checking schema compatibility

- **Status / provenance:** Open; retained prior reproduction/source assessment plus unchanged protected-file hash. New recovery-tool defect.
- **Source:** server/scripts/recovery.js:3–23; server/db/repository.js:62.
- **Hallmark relation:** Outside UI gates; recovery integrity. This is the same issue, not an HUI duplicate.
- **Evidence retained:** inspectBackup checks SQLite integrity and seven IDs but not schema version/required schema compatibility. An in-memory valid SQLite fixture with user_version=6 was accepted. restoreBackup renames it over the destination before createRepository rejects versions above 5.
- **Expected:** An incompatible backup must be rejected before the current database is replaced.
- **Actual / affected users:** A stopped hub can be left with an unstartable database after a failed restore. A before-restore copy is saved, so this is recoverable downtime, not demonstrated permanent data loss.
- **Safe reproduction reference:** Call inspectBackup with virtual bytes for a version-6 fixture. Do not run restore against the real database.
- **Priority and confidence:** P2; High: incompatible preflight acceptance reproduced; destructive restore path inspected only.
- **Scope:** Use the original BUG_REPORT.md scope; server/firmware issues are theme/viewport-independent. No new live or hardware test was performed.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-017 — Automatic spoken reply language follows UI language instead of the interpreted reply

- **Status / provenance:** Open; retained prior reproduction/source assessment plus unchanged protected-file hash. New frontend/backend voice-language mismatch.
- **Source:** public/js/main.js:41–45, 64; server/services/assistant.js:29–31.
- **Hallmark relation:** App language/result consistency. This is the same issue, not an HUI duplicate.
- **Evidence retained:** Backend selects Hindi for a Hindi query with automatic reply language. In mocked Chromium with English UI, the Hindi answer was displayed but the speech POST requested language=en.
- **Expected:** Automatic text and spoken replies should follow one defined language decision; interface language is a fallback, not an unrelated override.
- **Actual / affected users:** Users can receive Hindi text and English spoken output for the same answer despite selecting Automatic.
- **Safe reproduction reference:** Mock a Hindi query answer with language=hi, spoken replies enabled, reply_language=auto and English interface; inspect the speech request body.
- **Priority and confidence:** P2; High: request mismatch reproduced in mocked Chromium.
- **Scope:** Use the original BUG_REPORT.md scope; server/firmware issues are theme/viewport-independent. No new live or hardware test was performed.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-018 — Large controls does not enlarge several common targets

- **Status / provenance:** Open; new isolated browser reproduction plus unchanged protected-file hash. Current component consistency defect.
- **Source:** public/css/app.css:4, 7, 121–122, 171; public/js/views.js:27, 84.
- **Hallmark relation:** Interaction hit targets + stricter project56px contract. This is the same issue, not an HUI duplicate.
- **Evidence retained:** Large controls changes --target/--button to 56px, but favorites and filter chips use fixed 48px rules. Mocked Chromium measured a favorite button at 48px after enabling Large controls.
- **Expected:** The advertised larger-control preference should consistently affect essential controls, per the 56px design specification.
- **Actual / affected users:** These targets remain at the normal size. They still meet the project's normal 48px minimum; this is not claimed to be a WCAG target-size failure.
- **Safe reproduction reference:** Enable the preference on mocked Devices and measure .favorite-button; inspect fixed chip declarations.
- **Priority and confidence:** P3; High: favorite size reproduced; other fixed declarations inspected.
- **Scope:** Frontend state is shared across all four themes; fresh probe at 390px. Theme 05 default and corrected Theme 04/large-mode probe; do not infer every theme/state combination was independently reproduced.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.

### AUD-019 — Assistant readiness labels do not update when workers become ready or fail

- **Status / provenance:** Open; new isolated browser reproduction plus unchanged protected-file hash. Current dynamic Assistant UI defect.
- **Source:** public/js/main.js:51–56, 157; public/js/views.js:218, 222–226.
- **Hallmark relation:** App readiness/loading/error consistency. This is the same issue, not an HUI duplicate.
- **Evidence retained:** Assistant live updates patch the microphone and conversation only. A mocked missing-to-ready snapshot enabled the mic while 'Local setup required' and 'Voice needs local setup. You can still type.' both remained visible.
- **Expected:** Readiness badges, instructions, microphone state and retry guidance must describe the same current worker state.
- **Actual / affected users:** The screen gives contradictory instructions until navigation/rerender. The reverse transition can leave an old Ready locally badge after worker failure.
- **Safe reproduction reference:** Load Assistant with stt_ready=false, deliver a mocked snapshot with stt_ready=true and inspect mic plus labels.
- **Priority and confidence:** P2; High: missing-to-ready transition reproduced in Chromium.
- **Scope:** Frontend state is shared across all four themes; fresh probe at 390px. Theme 05 default and corrected Theme 04/large-mode probe; do not infer every theme/state combination was independently reproduced.
- **Recommendation / regression / tests:** See the matching row in REMEDIATION_RECOMMENDATIONS.md; original full description remains in ../BUG_REPORT.md.


All new recommendations are for a future implementation session. Hardware findings remain subject to the explicit physical-test restrictions in the original IoT and security reports. Mock failures and source proof are not evidence of live actuation, unsafe household incidents or credential exploitation.

