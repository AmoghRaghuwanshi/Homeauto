# Screen and interaction audit

2026-11-06. Sources and existing Astra evidence were reviewed before this additional Hallmark layer. All new browser execution used an isolated source copy and simulated data. **No live localhost preview was visited.** The existing six-report UI inventory remains applicable because source hashes match.

## Four-line Hallmark read

**Purpose:** family members inspect local device reports, control supported lights, enter the protected security flow and use Shrimaan.
**Works and stays:** clear primary navigation, shared semantic palettes, native controls, local assets, explicit simulation and sensor/door caveats.
**Generated-style tells:** desktop tracked “Controls,” the Accessibility Preview eyebrow and inconsistent spacing; these are secondary to behavior and do not justify replacing approved themes.
**Broken:** known live-update/freshness/result/error cases plus the newly demonstrated startup error and blank route-loading states.

## Fresh rendered coverage

All cases use a 900px viewport height, Chromium headless, simulated owner/preview identity and copied frontend files.

|Set|Exact routes|Themes / widths|Cases|
|---|---|---|---:|
|Primary|/, /rooms, /security, /assistant, /settings|05,01,03,04 ×320,390,768,1440|80|
|Room instances|/rooms/room-1, /rooms/room-2, /rooms/kitchen, /rooms/entrance, /rooms/hallway|05 ×390,1440|10|
|All seven device-detail URLs|/devices/light-1, /devices/light-2, /devices/light-3, /devices/light-4, /devices/sensor-gas, /devices/sensor-motion, /devices/door-1|05 ×390,1440|14|
|Security secondary|/security/door, /security/access-cards, /security/activity, /security/alerts|05 ×390,1440|8|
|Settings secondary|/settings/appearance, /settings/accessibility, /settings/language, /settings/voice, /settings/notifications, /settings/home, /settings/privacy, /settings/help, /settings/about, /settings/devices, /settings/advanced, /settings/advanced/ai|05 ×390,1440|24|
|Unknown route|/not-a-route|05 ×390,1440|2|
|Hindi + Large text + Large controls|All five primary routes|All four themes ×320|20|
|**Total**|||**158**|

**Results:** zero detected document horizontal overflow, zero axe violations for wcag2a/wcag2aa/wcag21aa tags, zero page errors, zero outbound app requests, zero microphone calls. This does not prove every required WCAG2.2 criterion or absence of transient clipping. Native JS-generated DOM was tested in the browser; the static linter alone cannot see it.

The fixture contains five rooms/seven supported devices, simulated reports, no favorites/cards/activity/alerts, speech not ready, and one explicitly simulated model record. Home, room/device/security content is populated; list empty states are exercised. The fixture uses no real household data or physical publisher.

Active alert detail/read/ack, partial assistant outcomes, auto speech language and backend persistence retain prior independent evidence; they were not part of this new158-case matrix. Authenticated owner/resident/viewer variants, every card/dialog state and every combination of errors across four themes were not all rendered.

## Screenshots and visual inspection

158 matrix screenshots plus3 targeted states are in [external evidence](C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/run/evidence). Filenames encode theme, width, language and route, e.g. [05 mobile Home](C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/run/evidence/05-390-en--.png), [01 desktop Rooms](C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/run/evidence/01-1440-en--rooms.png), [03 tablet Security](C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/run/evidence/03-768-en--security.png), [04 mobile Assistant](C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/run/evidence/04-390-en--assistant.png), [Hindi large Settings](C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/run/evidence/03-320-hi-large--settings.png).

All 20 English primary390px images (five pages × four themes) were inspected, as were the named tablet/desktop/Hindi examples and startup/loading failures. This is not a claim that every one of161 images was individually examined. Full-page captures show a fixed bottom bar at the original viewport boundary; that alone does not indicate permanent content obstruction.

The original approved reference boards were inspected during the preceding independent audit. The current visual treatment preserves their cream/green, comfort, pastel and emerald identities without importing their unsupported cameras/scenes/climate controls or “home protected” claims.

## Screen/control assessment

|Area|Observed strengths|Defects, state coverage and limits|
|---|---|---|
|Home|Clear house shortcut, room links, explicit quick actions, favorites empty action, assistant link, no fabricated capabilities|AUD-011 stale current-looking cached status remains. Older participants should evaluate long vertical travel to quick actions; this is a usability heuristic, not a measured failure.|
|Rooms|Search and filter controls, room destinations, add/edit handlers, device list/detail hierarchy|Source inventory complete; read-only navigation exercised. AUD-007/008 backend organization/concurrency defects retained. Cards/dialog mutations not submitted here.|
|Lights|Explicit On/Off, pending/error slots, native disabled conditions, favorite semantics|AUD-018 remains under Large controls; no real or simulated control command submitted during this Hallmark stage. Earlier command mock tests remain separate evidence.|
|Gas and motion|Plain reported-state descriptions, calibration/absence warnings, history destinations|Do not turn stale clear into “safe.” AUD-011 applies to client freshness. No sensor calibration or hardware behavior measured.|
|Security/door|Clear controller-report qualifier, timestamp, physical-position caveat and safety setup restriction|Fresh report → socket loss still says Controller reports Locked, AUD-011. Unlock/lock remain disabled by gate in this fixture. No unlock confirmation submission or physical check.|
|RFID access cards|Clear owner-only page, visible cloning warning, native form/dialog implementation|Empty state rendered; held response exposes HUI-002. Source CRUD/authorization traced previously; actual card CRUD/scans not performed.|
|Alerts|Active/history states and warning/acknowledgment distinction|Empty state rendered; prior AUD-013 read/count path and AUD-014 rejection remain. Active alert/detail interaction not freshly exercised in this stage.|
|Activity|URL date/category/search filters, empty recovery action, cursor source logic|Fresh malformed-date case still removes fields/reset (AUD-015). Source also awaits data before presenting frame, HUI-002 analogous path.|
|Assistant|Large microphone, typed fallback, local/privacy copy, no automatic capture|AUD-004 parser risk retained. AUD-009/012/017 retained from prior tests. AUD-019 reproduced by missing→ready snapshot; microphone enabled while setup caption stays. Idle “Ready when you are” next to disabled setup also belongs to this existing finding, not a new ID.|
|Settings / Appearance|Four themes,05 default, native radios, straightforward rows, stored local keys|Corrected Theme 04 selection/navigation/reload passed. Existing “Four ways to feel at home” wording is an optional already-recorded copy observation, not a new issue.|
|Accessibility / Language|Large text/controls and Hindi render without detected overflow|Checkbox keyboard focus loss and Help reset reproduced, AUD-010. Favorite target remains48 with 56 token, AUD-018. Hindi translation/glyph quality needs native-speaker/assistive-tech review.|
|Voice preferences / Notifications|Scoped preferences and explicit permission controls, no background-delivery promise|Source audited; no real permission prompts/speech. Preference errors and automatic reply issues retain prior IDs.|
|Home details / Privacy|Real backend setting boundary, no cloud account fiction, guest Sign out hidden|No save/logout mutation performed. HUI-001 reintroduces a misleading login screen only on startup failure; ordinary guest screens remain login-free.|
|Help / About|Bundled guidance and notices; disclosure navigation|Expanded Help closes after unrelated update (AUD-010); no external help dependency.|
|Advanced / Local AI|Owner-facing diagnostics and setup limitations, no invented installer/model switch|Mock responses render; disabled missing-model button is truthful. Source-derived loading issue and previous readiness limitation remain.|
|Dialogs|Native dialog with accessible label, safe cancel emphasis, Escape and focus-return wiring|Add room → Escape returns to Add room. No claim that every destructive/reauth/dialog error state was retested.|

## Fresh interaction results

|Test|Actual result|Assessment|
|---|---|---|
|My Home from5 roots +28 supported secondary +unknown|34/34 at /|Pass|
|Home → Security → contextual Back|Home restored|Pass|
|Rooms → Room1 → Back → browser Forward → refresh|Room1 remains valid|Pass|
|Add room → Escape|Dialog closes, Add room focus restored|Pass|
|Theme 04 selection → My Home → refresh|data-theme=04|Pass in corrected probe|
|Large text via keyboard Space|activeElement=BODY|AUD-010 reproduced|
|Help/Lights expanded → mocked snapshot|1 open →0|AUD-010 reproduced|
|Door fresh report → mocked socket disconnect|Outage banner plus Controller reports Locked|AUD-011 reproduced|
|Activity ?from=bad|0 date fields,1 Retry, no editable recovery|AUD-015 reproduced|
|Large controls enabled → favorites|--target56px; button48×48px|AUD-018 reproduced|
|Missing STT → ready snapshot|Mic enabled; setup-required caption remains|AUD-019 reproduced|
|Held cards GET|Empty main, no busy/status, no Back|HUI-002|
|Startup session success + snapshot 503|Sign-in form replaces app, no service retry|HUI-001|
|JavaScript disabled|Static Loading message remains|Limitation/optional fallback recommendation, not a CSS reveal-gate claim|

The first fixture version set preferences on every page load, invalidating its persistence observation and failing to exercise Large controls. The runner was corrected to initialize only absent keys, Large controls was explicitly enabled, and focused probes reran successfully. Use probe-results.json for these results; browser-results.json retains the original harness observation for transparency. The158 layout cases were unaffected because their assigned theme/language/size was intentional. The initial copied fixture also omitted auth/sessions.js and failed MODULE_NOT_FOUND before browser launch; copying that source dependency corrected the harness. Neither harness issue is counted as a product defect.

## Accessibility, states and manual limits

Native semantic controls, labels, focus-visible outlines, reduced-motion CSS, safe-area spacing and natural page structure are positive. Actual focus stability under updates is still broken despite static axe passing. No screen reader was operated, and no announcement-frequency or full keyboard task certification is claimed.

The short House/room/device labels, button hierarchy and restrained palettes are understandable by inspection. The meaning of “controller,” “uncalibrated,” “reauthenticate” and UID formatting requires household/native-language trials. Preserve the precise warnings while making recovery paths work.

Mandatory next manual checks: real phone Safari/Chrome, software keyboard and safe areas; native 200–400% zoom; NVDA with streaming telemetry; motor/vision/older-user tasks; native Hindi/Hinglish comprehension and voice quality. CSS large preferences and a320px viewport are useful stress checks but are not substitutes for browser zoom or user trials.

