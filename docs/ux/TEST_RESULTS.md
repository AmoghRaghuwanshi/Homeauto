# UI refinement verification

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
