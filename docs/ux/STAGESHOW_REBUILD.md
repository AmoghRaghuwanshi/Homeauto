# HomeAuto frontend reconstruction — 2026-11-14

## Scope and checkpoint

Local reconstruction against baseline `5e0a040fef9025c85847193cc39f326f43ec8c11`; the tree was clean before this task. No push, merge, deployment, production database operation, broker connection or physical-device command occurred. The deployed application is unchanged.

Latest user order: finish and preserve UI/UX first; state-machine audit2 is deferred. The original inventory remains in `docs/audit/STATE_MACHINE_AUDIT.md`. Its baseline line numbers are historical. The two already implemented transition safeguards and their regression tests are preserved. Available software verification is complete. The final recovery snapshot is recorded below; physical-device and human acceptance limits remain explicit.

## Reference integration

Official reference: https://github.com/benjitaylor/skills/tree/main/stageshow . Stageshow1.1.1 installed with `npx skills add benjitaylor/skills --skill stageshow --global --agent codex --yes`; actual files verified at `C:/Users/Amogh/.agents/skills/stageshow`. Read its skill, craft/framing/looks/motion/kit/rehearse/verify/review/teaching references, selected Button/Field/Row source, examples and MIT license. Revisited the brief, skill, craft and looks for the final pass.

The isolated reference copy at `D:/homeauto-audit-tools/stageshow-20261114/reference` installed73 packages, audit0 vulnerabilities. HomeAuto received no React, Stageshow or other runtime dependency. Native DOM buttons, labels, inputs, headings and dialogs remain functional. Faux kit controls, scripted cursors, placeholder data, miniature touch targets and illustration-only cropping/heading rules were not transplanted into this consumer app.

Applied principles: deliberate focal hierarchy, typography and control geometry, semantic tokens, different page compositions, restrained signals, immediate feedback, stable button footprints, purposeful movement and reduced motion. No showcase scene was needed or added.

Reference film studies: `gold-form-wide.json` and `gold-loading-wide.json` passed still gates. `gold-form-phone.json` reported2 framing findings in the unchanged example. These are reference studies, not HomeAuto passes. Stills do not judge motion; no animation gate is claimed for the real app.

## Implemented source and design

Deep forest navigation/focal surfaces, warm ivory ground, white working surfaces, amber illumination and separate semantic warning/error colors. Original schematic SVG room scenes are not measured floor plans or hardware diagrams. All four themes remain selectable, with05 Serene Emerald default. Warm Organic uses timber/cream, Universal Comfort blue contrast and larger controls, Friendly Pastel soft lavender/teal. System fonts include Hindi fallbacks. Default targets48px; comfort/large targets56px. Narrow comfort/large-text summaries use one column. No overflow clipping hides broken layouts.

| Source | Actual change |
|---|---|
| `public/css/app.css` | Replaced the old monolith with six owned style-module imports. |
| `public/css/tokens.css` | Rebuilt all four semantic palettes, including rail, panels, lighting, artwork, focus and feedback. |
| `foundation.css`, `controls.css` | Native type/spacing/layout primitives, button variants, stable busy indicator, fields, filters, dialogs, toasts, empty/loading states and accessible targets. |
| `shell.css`, `pages.css`, `motion.css` | Desktop rail/mobile tabs, home context, navigation headers, safe areas and different page layouts; short directional movement at full text contrast, reduced motion and forced colors. All under `public/css`. |
| `public/js/components.js` | Reconstructed native button/field/empty primitives; shared pageHeader, sectionHeader and loadingPanel. |
| `public/js/room-art.js` | Small local room SVGs, hidden from assistive technology. |
| `public/js/views.js` | Actual Home markup reconstruction; room collection; device/door report-and-control split; RFID list; alert actions; Activity filter/feed layout; Assistant introduction; settings/accessibility/language structure. Operational handlers retained. |
| `public/js/main.js` | New shell/context and auth story/form layout, loading presentation, screen busy semantics and transition safeguards. |
| `public/js/gateway-ui.js` | Shared headings, gateway-first hierarchy and decorative progress summary; real private-file workflow preserved. |
| `preferences.js`, `theme-bootstrap.js`, `public/index.html`, `manifest.json` | Browser/installed-app colors match new palettes and early selected-theme loading; persistence format unchanged. JS files under `public/js`. |
| `public/js/i18n.js` | Small new labels and transition error translated; safety language retained. |
| `public/js/api.js` | Blocks non-auth mutations during real/demo transition. |
| `server/tests/frontend-transitions.test.js` | Four actual-source mocked regressions for transition isolation, preference ownership and departing-document reads. |
| `server/scripts/rebuild-check.js`, `server/package.json` | Repeatable additional wide-screen and real native-component tests, isolated fixtures and disposable outputs. |
| `server/scripts/onboarding-browser-check.js` | Await native close before checking restored focus; inspect completed pages rather than loading headings. No checks removed. |

Home has actual reports, quick controls, a focal room, favorites, room shortcuts and Assistant access. Rooms show real counts and device types. Device cards follow confirmed reports, with pending/error/time feedback. Security separates qualified door reports, sensors, cards, alerts and history. Activity retains URL filters/cursor/scroll in its filter/feed layout. Settings groups resident/home/general controls and preserves all theme options. Auth retains real signup/sign-in and validation. Gateway setup still reauthenticates and issues a one-time telemetry file; no imaginary QR/pairing-code flow was added.

Navigation registry/history/focus and My home behavior remain. Preference schemas, language/accessibility/theme durability and server preferences are compatible. Hardware status never enters localStorage as authoritative state. No MQTT topics, firmware, RFID policy, API schema, database schema or auth policy changed. Local speech/cloud capability boundaries remain. No online font, icon CDN, analytics or new cloud runtime dependency was introduced.

The first audit's two confirmed issues are fixed: retire controls before changing real/demo transport, restore simulation isolation after failed exit, reject commands without a current realm/session, and give preference busy locks an operation owner. This is preserved work, not completion of audit2.

## Second design pass

Reviewed real desktop/mobile frames against the immutable baseline and the Stageshow form study. Fixed squeezed empty Favorites copy, an invisible search hint, duplicate room counts, tablet device overlap, comfort-theme narrow status overflow, desktop hover colors on mobile tabs, excessive detail-header gaps, small report timestamps and favorite controls ignoring56px preference. Removed text opacity fades after temporary contrast failures. The screen now exposes `aria-busy` until its actual view has rendered.

Busy tests exercise the actual shared button inside the actual modal, checking unchanged footprint and full-contrast sampled Back motion. Earlier test versions depended on a refresh DOM node surviving a live rerender, then appended a test button below fixed navigation; those fixture failures are retained. Modal focus checks now wait for the native close event. WebKit rapid-navigation read diagnostics were reproduced and fixed with a departing-document guard. Checks wait for complete views rather than loading headings. Focus restoration is verified after native close and focus delivery, with a strict1s wait rather than an immediate evaluation that raced WebKit.

## Verification evidence

All browser work uses loopback in-memory local data or disposable PostgreSQL WASM with simulated controllers. Evidence root: `D:/homeauto-audit-tools/stageshow-20261114`. Initial Chromium launch failed with Windows `spawn EPERM`; installed Chrome is exercised through external `browser-fallback.cjs`. Chromium1248/WebKit2370 were downloaded outside source. No user browser profile was used.

| Command / check | Recorded result |
|---|---|
| `npm test` |172/172 passed, including4 frontend coordinator/transport tests; `backend-final.log`. The earlier171-test run is retained. |
| `npm run build` |Passed:457 traced files,0 native hub files, no deployment. |
| `node scripts/check-syntax.js` |101 tracked JS files passed; new JS files also checked directly. |
| `npm run test:publication`; `git diff --check` |Passed:229 tracked files,0 publication issues; no publication performed. |
| `node server/scripts/ux-check.js` |30 groups passed, including32-route Home shortcut, Back/Forward, nested reload, prefs, metadata/RFID, modal focus, cursor/scroll, disconnect/reconnect, keyboard, zoom, forced colors and microphone denial; `ux-final.log`. |
| `node server/scripts/remediation-check.js` |9 groups passed; `remediation-final.log`. |
| Mobile Chromium / WebKit |Each182 layouts,45 axe scans,43 captures,0 violations/errors/external requests: `mobile-chrome-complete`, `mobile-webkit-complete`. |
| Wide Chromium / WebKit |Each300 layouts,100 axe scans,120 captures at768/1024/1440,4 themes and25 routes; `rebuild-wide`, `wide-webkit-complete`. WebKit also passes the final component/motion checks. |
| Cloud browser |11 groups,86 captures,0 axe/page/application-CSP errors/external requests; `cloud-final`.516 blocked inline-style probes belong to QA axe and are separately recorded. App CSP unchanged. |
| Signup Chromium / WebKit |Each10 groups,34 captures/scans,0 violations/errors; `signup-chrome`, `signup-webkit-final`. No production account created. |
| Gateway/demo Chromium / WebKit |Each full96 captures passed,0 violations/page errors/device-network writes; `onboarding-chrome-final`, `onboarding-webkit-final-release`. Real disposable signup, reauth, private download, demo controls, scenarios, focus, nested reload and exit verified. |
| Shared button / Back motion |Both engines passed footprint, full-contrast sampled Back motion, rapid direct navigation and native Back/Forward; `interactions-chrome-release`, `interactions-webkit-release`. |

Earlier mobile overflow, contrast, target-size, browser launch, VM-fixture and test-timing failures remain in their original logs. A focused WebKit probe found late socket/poll callbacks starting reads in departing documents. The frontend now suspends view reads at beforeunload/pagehide and resumes on pageshow; the focused probe then reported0 errors, and both-engine rapid-navigation regressions plus the full WebKit onboarding rerun passed without filtering page errors. Expected cancelled GETs during deliberately interrupted reads remain in request-failure diagnostics (including one in the wide WebKit run); they are not successful responses. The final full172-test suite passes. Passing reruns do not relabel earlier failures.

Before:24 real captures from an isolated Git-archive baseline at port3014, in `before`. The baseline `/rooms/living-room` capture is a not-found view because the local fixture uses `/rooms/room-1`; it is not evidence of a valid old room screen. Primary comparisons are valid. After:24 real source renders in `final`, including the corrected room route. `iteration1` is preserved for critique, not final proof. Test matrices also retain all-theme mobile/tablet/desktop frames.

## Local review and limits

http://127.0.0.1:3012 is a labelled, login-free in-memory simulator. External `interactive-preview.cjs` refreshes simulated reports every5s while preserving their current simulated values; no real hardware state is fabricated. GET verification found7 devices/7 current simulated reports. No production data is used.

Actual microphones, physical phones, native Hindi review, consented human speech, door relock timing and physical-device acceptance were not tested here. WebKit emulation is not proof of real iPhone behavior; local timing is not a production performance benchmark. Reference stills are not motion-gate evidence. No deployment performed. Final source checkpoint: `D:/homeauto-audit-tools/stageshow-20261114/uiux-final-20261114`. It includes the complete changed/new file tree, tracked patch, SHA256 manifest and ZIP, including the preserved first state-machine audit. The earlier24-file checkpoint is retained separately. Desktop/mobile theme contact sheets were composed from actual captured viewport regions for manual comparison; original full screenshots remain intact.
