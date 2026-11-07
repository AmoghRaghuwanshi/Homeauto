# UI refinement verification

## Live signup and Safari navigation continuation — 2026-11-07

Release96d2429 passed all four [CI jobs](https://github.com/AmoghRaghuwanshi/Homeauto/actions/runs/42359856117): backend/build/syntax/UX/remediation/cloud, secrets and separate mobile/signup matrices in Chromium and WebKit. The signup suite covers32 auth layouts plus a Hindi accessibility capture per engine, all four themes, confirmation, visibility, duplicate errors, real synthetic account isolation and logout. Existing mobile coverage remains182 layouts/45 axe scans/43 screenshots per engine. All tests use disposable data and simulated hardware.

Live Chromium on the existing production domain then passed8 groups/46 captures, including actual registration201, duplicate409, separate private home, sign-in, schema3 and logout401. A rapid live WebKit matrix exposed excessive History API writes. The repaired source d8eae6d passed the120-focus/60-scroll regression in both engines, all30 local UX groups and all four [CI jobs](https://github.com/AmoghRaghuwanshi/Homeauto/actions/runs/42386978810). The exact deployment and final live browser results are in [production acceptance](../cloud/PRODUCTION_ACCEPTANCE.md).

Final actual-domain reruns on that deployed repair passed7 groups/46 screenshots in each engine: four themes on320/390/844/768/1440 widths, direct refresh/history, focus/scroll burst, existing QA account sign-in, isolated home/schema3, My home and logout401. Zero page errors, observed5xx or external requests. Screenshots and results are retained under D:/homeauto-audit-tools/production-acceptance-20261107/live-signup-{chromium,webkit}-verified. Phone and desktop captures were visually reviewed; real devices remain outside this automated evidence.

Initial browser-cache selection, live navigation timeout and WebKit history-limit failures remain in external evidence. No physical hardware was tested. Native phone/keyboard/notch, screen reader, Hindi usability, protected-preview access, centralized runtime logs and WebKit cookie-enforcement limitations are recorded separately; automated results do not certify these.

## Cloud continuation,2026-11-07

New cloud suite:11 scenario groups/66 screenshots and axe scans, four themes and375/390/768/1440 widths, with0 violations/page errors/external requests. Strict Vercel-header rerun also has0 application CSP errors;132 blocked axe-core inline style probes are separately source-attributed and retained, not hidden or used to weaken policy. Earlier scans without that tool restriction also report0 violations. No full manual/native accessibility certification is implied.

Existing local navigation/UX30 groups and remediation9 groups pass after cloud changes. Full backend/API/PostgreSQL/gateway/client suite145 passes. Evidence: D:/homeauto-audit-tools/production-cloud-20261107/evidence/{backend-verified.log,ux-verified.log,remediation-verified.log,browser-verified/results.json,browser-csp-verified/results.json}. Actual native Neon/Vercel/domain, physical hardware/speech and phone/NVDA/household acceptance remain open; see docs/cloud/DEPLOYMENT_READINESS.md. Earlier counts below are historical and were not relabeled cloud results.

Recorded 2026-11-05. All automated control tests used in-memory simulators or
temporary copies. No ESP32, real broker, production database or physical door was
used. This stage makes no household-release or full WCAG certification claim.

| Check | Result | Evidence |
|---|---|---|
| `npm test` | 63 pass, 0 fail | Existing Node/HTTP/WS/TLS/migration/auth/command/retention/restore suites |
| `npm run test:ux` | 30 interaction/navigation/persistence/accessibility groups pass; no page errors or external requests | `.local/qa/ux/results.json` |
| `npm run test:browser` | 145 screenshots; 80 axe scans; 0 violations, 0 page errors, 0 external requests | `.local/qa/browser/results.json` |
| `npm run test:voice-browser` | Four native pipeline assertions pass | `.local/qa/native-browser-results.json` |
| Frontend ES-module syntax | Nine active modules pass | Node module parser, including new navigation module |
| Unslop edit validation | Ten spans pass preservation; eight protected messages pass strict preservation and remain verbatim | `.local/qa/ux/copy/validation.json` |
| Compatibility hashes | Ten protocol/auth/domain/storage source files unchanged; seven original DB/cert/reference files unchanged | `.local/qa/ux/compatibility.json` |
| Current localhost preview | Login-free, My Home works, Theme03 microphone enabled with local workers | `.local/qa/ux/current-preview-*.png` |

## Navigation and functional coverage

Required A–J scenarios pass: Home/Security/Back; Rooms/room/device/contextual
Back; Settings/My Home; Assistant/Security/My Home; direct nested refresh and
safe fallback; native browser Back/Forward; theme navigation/refresh persistence;
modal focus restoration; controller offline/reconnect with current report.
My Home works from all 32 primary/detail/settings routes plus an alert detail.
Unknown child routes show not-found instead of their parent. Current-route
selection does not add a duplicate history entry. Headings and browser titles
follow the destination.

Additional checks cover room create/rename/remove, device metadata/room changes
with the hardware ID/type retained, favorite persistence, card add/revoke/remove,
alert read/ack independence from sensor resolution, home-name save and shared
label refresh, URL search/filter restoration, cursor-page/scroll restoration,
wake-prefix persistence, new-context preference restoration and the login-free
preview's explicit unlock confirmation.

Keyboard Enter operates My Home and Back; Escape closes dialogs and returns focus
after a live rerender. Automated layout checks cover 320px with large text,
large controls and outlines; reduced-motion emulation; forced-colors emulation;
200% CSS zoom reflow; denied storage; mocked microphone permission denial with a
typed fallback. CSS zoom is an emulation, not proof of every browser's native
zoom behavior. Real microphone/OS permission behavior remains unverified.

## Rendered coverage and inspection

The matrix covers all four themes, five primary screens, widths 320/390/768/
1024/1440, five Hindi screens at 320px, and twenty secondary routes at both
390px and 1440px. Axe runs on primary screens at 390/1440 and all those secondary
routes: 80 scans. No horizontal overflow was detected in the checked layouts.

All twenty primary theme/mobile screenshots were visually inspected, along with
selected desktop Home/Rooms, tablet Security, mobile door detail and Hindi
Settings. All four original design boards were also inspected. Final live-preview
captures include the real loaded local speech profile; the broader matrix
deliberately runs with speech absent to check typed/missing-model behavior.
Full-page mobile captures place the fixed bottom bar at the viewport boundary
inside the longer document image. Viewport captures verify the actual visible
layout; this is not a second floating bar in the application.

## Failures found and corrected

- A first cursor test asserted before the asynchronous next page returned. It now
  waits for the actual appended rows; the restoration check then passes.
- A live-update/dialog race could lose focus after the opener was replaced. The
  dialog's stable return target is now shared with the renderer. Tests wait for
  focus restoration, not just dialog removal.
- Empty-room DELETE omitted JSON, so the API correctly rejected it. The frontend
  now sends `{}` and the full create/rename/remove flow passes.
- One matrix run timed out waiting for navigation while source edits were still
  in progress. The cause was not isolated; clean subsequent full runs passed.
- Visual review found stale door text incorrectly phrased as a controller report.
  It now says Door status unavailable and retains last-report time/caveats.

No reproducible failing automated check remains in the final recorded results.
Earlier failure logs are not counted as passes. Empty deleted copy is declined
by Unslop's phrase/readability tools; short-label diff/readability advisories and
the operator guide's soft heading-overlap warning are documented in the audit,
not represented as language errors that were automatically removed.

## Remaining manual and release gates

Real household phones/notches, native browser zoom, full keyboard-only household
tasks, NVDA/screen-reader announcements, native Hindi wording/voice review,
consented accent/Hinglish holdout recordings, older-user trials, actual
microphone denial/revocation and background notification behavior remain open.
Native speech tests use synthetic input; they do not establish recognition
accuracy. Firmware/broker TLS/auth, physical relock/fail-mode/egress tests and
actual relay/sensor validation remain separate blocked release work. Do not flash
or actuate hardware based on the software results above.

Final frame-by-frame navigation check caught an 8px transient horizontal overflow during the short forward transition. The workspace now clips only horizontal overflow; the 30-frame width assertion is part of the passing UX suite. Static layouts and focus rings remain inside their padded content area.

## Mobile follow-up — 2026-11-07

Source: server/scripts/mobile-check.js. Runtime: loopback, in-memory SQLite, fake publisher, native voice OFF. The existing3001 preview and household data are not used by the test fixtures.

Coverage includes320×568,360×740,390×844,430×932,844×390 and667×375 touch viewports; all four themes and five roots;20 secondary routes at320/390; Hindi with large text/controls in every theme; a320px-high viewport for reduced keyboard space; modal Cancel/focus restoration; a read-only assistant query; landscape navigation/My home; and768/1440 tablet/desktop checks. Mobile navigation must remain reachable, input text at least16px, standalone targets at least44px, and essential controls must stay within the horizontal viewport.

Initial failures are retained outside the source tree at D:/homeauto-audit-tools/mobile-20261107. Baseline confirmed the landscape sidebar clipping and15px form fields. The first Chromium run found the undersized About notices link. WebKit exposed touch opener focus loss; a controlled before/after comparison verified the correction. One Chromium assertion also raced the native dialog close event; the test now waits for dialog removal and restored focus instead of reading focus before close handling completes. No production timeout, authentication rule or hardware assertion was changed.

The native browser chrome, software keyboard, safe-area hardware geometry, screen-reader gestures and physical device behavior are not simulated by these layout checks. Real-phone acceptance remains open. GitHub/Vercel publication and deployment are separate: automatic Git deployment remains disabled, and the operator's manual-update instructions are in ../cloud/VERCEL_DEPLOYMENT.md.

Final local results: Chromium and WebKit each passed **182 layout checks,45 axe scans and43 screenshots**, with0 violations, page errors or external requests. Evidence: chromium-release/results.json and webkit-final/results.json under D:/homeauto-audit-tools/mobile-20261107. The93-file JavaScript syntax check and456-file cloud build trace also pass; no native hub/private artifacts enter the cloud trace. The workflow adds separate Chromium/WebKit mobile jobs to the existing backend/navigation/cloud and full-history secret checks. Exact published commit and actual Actions conclusion are provided in the completion message.
