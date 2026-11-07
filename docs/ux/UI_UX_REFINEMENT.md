# UI and UX refinement

Implemented 2026-11-05, continuing the existing application. The original
four reference boards were inspected again and preserved. Before editing, 86
source/document files were saved with hashes under
`.local/backups/ux-refinement-20261105`; baseline screenshots and text are in
`.local/qa/ux/baseline`.

## Confirmed defects repaired

- The home name was a noninteractive label; nested screens had no common Back
  affordance; all document titles were HomeAuto; invalid child routes rendered
  valid screens. One route/history controller now owns these behaviors.
- Room filters could override a Home light shortcut and reset on refresh. Clear
  filters could leave old input text behind. URL-based filters resolve both.
- Activity lost loaded cursor pages and reading position on return. Session-local
  page data and native history restoration now retain them.
- The home-name form saved to the API but left the top bar's label stale. Shared
  shell text now updates from the authoritative snapshot.
- Wake-phrase preference reset on reload. It now uses a versioned local key;
  storage denial preserves usable session defaults and shows feedback.
- Live rendering could remove a dialog's opener and lose keyboard focus.
  Stable focus descriptors and dialog return targets handle that race.
- Empty-room removal sent DELETE without the API-required JSON content type.
  Its request now supplies an empty JSON body; authorization is unchanged.
- Microphone DOMExceptions could fall through to a generic error. Blocked and
  unsupported capture now have clear messages and retain typed input.
- Stale door status was phrased as a controller report. It now explicitly says
  unavailable, while stale device details label their values Last known.

## Visual and component work

Home now has a compact introduction instead of an oversized card hero. Empty
favorites use a shorter setup row. Room cards use a consistent list-like shape
and meaningful icons; large decorative room numbers are removed. Theme04 retains
its room-specific pastel panels. Security has a smaller root lock illustration,
report time and a single Activity shortcut rather than an empty “Recent activity”
card. Door detail avoids duplicate status badges. Read-only event dialogs use a
single Close action.

All four themes retain their approved semantic palettes: 05 default emerald,
01 cream/green, 03 larger text/controls and blue microphone, 04 pastel/blue.
Navigation, focus, dialogs, inputs and notifications inherit those tokens.
The browser theme-color follows the selected background. Theme bootstrap still
runs locally before CSS/app paint; no CDN font, icon or analytics dependency was
added. Hindi uses suitable local font fallbacks and normal letter spacing.

Detail headers share Back, readable titles and contextual actions. Small screens
retain the five primary destinations in the bottom bar; tablets retain the
compact rail and desktop the sidebar. Safe-area padding and reduced-motion/
forced-colors behavior are retained and tested where the browser can emulate
them. Native phone safe areas and NVDA remain manual checks.

## Persistence boundaries

Theme, interface language, accessibility and wake-prefix preference use versioned
browser storage. Home/room metadata, favorites, voice/reply settings and approved
notification categories continue through existing versioned backend APIs.
Concurrent preference controls show pending/disabled state. This stage did not
change persistence schemas or create a second source of hardware truth.

URL filters and history scroll/focus survive supported navigation/refresh.
Sensitive dialogs, passwords, challenges, audio and hardware state are never
persisted by the router. The login-free preview remains an in-memory simulator:
restarting that preview resets its fixture database. The separate real runtime's
existing durable database and authorization remain intact.

## Compatibility

No MQTT topic, firmware command, hardware ID/pin, RFID rule, door policy, schema,
database or certificate changed. Hash checks confirm the protected files.
Testing used isolated software fixtures. A publish callback still does not prove
actuation, and controller reports still do not prove physical lock position.
No unsupported cameras, dimmers, climate controls, scenes or devices were added.

See `NAVIGATION_SPEC.md`, `UNSLOP_AUDIT.md`, `TEST_RESULTS.md` and
`../DEVELOPMENT_STATE.md` for behavior, evidence and remaining gates.
# Cloud integration continuation —2026-11-07

Cloud mode now uses the existing app system with explicit API/gateway/board/report freshness and command states. Theme CSS/tokens/navigation are unchanged; four themes and05 default persist. Cloud room/device/home metadata and RFID/voice controls explain local-only capabilities; favorites/preferences/alert receipts and typed requests use protected cloud APIs. No unsupported cloud microphone or remote door operation is presented as available.

Hallmark2.0.0 app workflow was loaded from its existing isolated source, not claimed newly/natively installed. Fresh-context finish review returned fix: cloud door suggestion, misleading Local setup required readiness/disabled-mic label, and missing Hindi subtitle. All3 are resolved in views/main/i18n and visually scored against browser-verified/{05-390-assistant,03-390-hindi-assistant}.png. Corrected source also gives gas/motion suggestions their existing matching icons. No second subjective review or unrelated redesign was performed; first verdict had no Floor finding.

Final new cloud QA:11 scenario groups,66 screenshots/axe scans at375/390/768/1440 widths across all four themes and five main screens, plus Hindi/default-off/expired/controller-offline/API-offline states;0 violations, page errors or external requests. Additional existing local30 UX and9 remediation groups pass. Source/DNS/hardware are not inferred from pictures. Native Hallmark renderer was attempted against a disposable server but unavailable (missing puppeteer-core). Isolated CSS scan with the actual modern-minimal/app scope:0FAIL0REFLEX/2 accepted contextual warnings (short42ch login copy; toast edge/elevation). Browser evidence independently verifies reflow/contrast and interaction.

Evidence: D:/homeauto-audit-tools/production-cloud-20261107/evidence/browser-verified and hallmark/static-final.json. Native phone/notch/zoom/NVDA/Hindi/older-user acceptance remains open. See docs/cloud/PRODUCTION_TESTS.md and DEPLOYMENT_READINESS.md for backend/cloud boundaries and external gates. Earlier refinement history follows unchanged.

