# Complete demo verification — 2026-11-14

## Scope and result

The implemented HomeAuto UI, local demo, native English/Hindi speech and isolated cloud workflows were exercised. The run found one additional focus race, repaired it and passed its regression checks. All final required checks executed in this pass passed. This is finite software verification with simulated hardware, not proof of error-free operation on every device, microphone or physical installation.

Evidence: `D:/homeauto-audit-tools/complete-demo-verification-20261114`. All browser fixtures use loopback/in-memory/disposable PostgreSQL WASM, fake publishers and simulated reports. No production database, cloud account, real MQTT connection, ESP32 action or firmware flash was used. The existing uncommitted UI/voice/planning changes were preserved. No GitHub publication or Vercel deployment occurred.

## Repair discovered during this pass

WebKit mobile completed180 layout inspections and45 accessibility scans, then failed focus restoration after cancelling Add room in a short-height viewport. A live status update can asynchronously render a replacement view while native dialog close returns focus to its opener. The renderer previously restored the focus captured before awaiting the view, which could be body focus by the time the dialog closed. Replacing the DOM could then discard the newly restored opener focus.

`public/js/main.js` now rechecks the current connected, non-dialog focus owner immediately before replacing a same-page view, while preserving the saved dialog destination when appropriate. Selection state follows the latest owner. Route-generation guards and existing navigation focus behavior remain.

New regression harness: `server/scripts/dialog-focus-check.js`. It repeatedly opens/cancels a real dialog under deliberately concurrent status refreshes. **12 iterations passed in Chromium and12 in WebKit**. The complete WebKit mobile matrix then passed182 layouts and45 scans, including the original failing step. The final30-group UX suite also passed. The failing run remains in `mobile-webkit`; the successful rerun is separate in `mobile-webkit-fixed`.

## Test results

| Verification | Actual result | Evidence |
|---|---|---|
| Complete backend/security/persistence/coordinator tests | **201 passed,0 failed/skipped** after the focus repair | `backend-final.log` |
| Cloud build containment | Passed;457 traced files,0 native hub files | `backend.log`, command transcript |
| JS syntax |104 tracked JS passed;109 then-current tracked/untracked JS/CJS candidates passed a separate syntax sweep; new focus harness checked directly by execution | `backend.log`, command transcript |
| Publication inspection |251 final source candidates, 0 issues; generated/model/private paths excluded | Command transcript |
| Changed-content secret scan | Passed, redacted Gitleaks stdin scan | Command transcript |
| Chromium mobile |182 layouts,45 axe scans,43 screenshots;0 violations/page errors/external requests | `mobile-chrome/results.json` |
| WebKit mobile, after repair |182 layouts,45 axe scans,43 screenshots;0 violations/page errors/external requests | `mobile-webkit-fixed/results.json` |
| Chromium tablet/desktop |300 layouts,100 axe scans,120 screenshots;0 page errors/violations/external requests | `wide-chrome/results.json` |
| WebKit tablet/desktop |300 layouts,100 axe scans,120 screenshots;0 page errors/violations/external requests | `wide-webkit/results.json` |
| Focus stress regression |12 open/cancel/live-refresh iterations per engine passed | Command transcript; `dialog-focus-check.js` |
| Final navigation/accessibility/metadata UX |30 groups passed,0 page errors | `ux-final.log` |
| Remediation browser checks |9 groups passed,0 page errors | `remediation.log` |
| Desktop functional browser |145 screenshots,0 axe violations/page errors/external requests | `browser.log` |
| Isolated cloud UI/API |11 groups,86 screenshots,0 axe violations/page errors/application CSP errors/external requests | `cloud-results.json` |
| Signup, Chromium |10 groups,34 screenshots/axe scans,0 violations/errors | `signup-chrome/results.json` |
| Signup, WebKit |10 groups,34 screenshots/axe scans,0 violations/errors | `signup-webkit/results.json` |
| Gateway/demo onboarding, Chromium |4 groups,96 screenshots,0 violations/errors/hardware-network writes | `onboarding-chrome/result.json` |
| Gateway/demo onboarding, WebKit |4 groups,96 screenshots,0 violations/errors/hardware-network writes | `onboarding-webkit/result.json` |
| Native Automatic speech demo |English/Hindi recognition, automatic endpointing, simulated execution, matching text/TTS language, spoken clarification, blocked-autoplay player fallback;0 page errors/external requests | `native-demo/results.json` |
| Native physical-profile behavior with fake publisher |4 groups: passive mic, review/Cancel(no command), confirm/simulated reports, authenticated WAV/playback/Stop;0 page errors/external requests | `native-review-results.json`, `native-review.log` |
| Native-worker shutdown probe |Both model workers ready; runtime.stop returned and probe process exited normally | Command transcript |
| Diff whitespace |Passed | Command transcript |

The initial Chromium mobile collection and desktop functional collection preceded the small final focus change; final coverage of that change is the two-engine stress regression, complete WebKit mobile rerun, both wide matrices, native flows and final navigation suite. The backend suite was rerun after the repair. Testing was not broadened again after these passed.

Source inventories/hashes are at `source-hashes.csv` and `source-hashes-final.csv`; documentation written after those snapshots is naturally not part of the earlier inventory. Evidence paths in this report are local artifacts, not committed private runtime data.

## Component coverage

- **Home and shell:** current simulated reports, favorites, quick light controls, room links, alerts, persistent sidebar/bottom tabs and My home shortcut from32 supported routes.
- **Navigation:** root/detail/parent behavior, Back/Forward, nested refresh, unknown/malformed routes, no duplicate history, scroll/list filters and focus restoration.
- **Rooms/devices:** create/rename/delete constraints, reassignment, persisted metadata, favorites, pending/observed/uncertain state, offline/reconnect, supported capabilities and read-only sensors.
- **Security:** lock/unlock permission/challenge/reauth/cancel paths, guest-preview separation, RFID add/revoke/delete, safe text rendering, event history and sensor alert receipt behavior. Read/acknowledge never resolves an active hazard.
- **Assistant:** Automatic English/Hindi input/reply, endpoint bounds, PCM resampling, negative/ambiguous rejection, missing-target spoken clarification, typed commands, voice lifecycle timeout/cancel, stale-response ownership, hidden-page processing, owned WAV and playback/Stop/fallback. Simulation automatic dispatch is explicitly separate from physical-profile review.
- **Settings:** four themes with05 default, persistent language/accessibility/wake preferences, home name, notification controls, voice settings, model readiness and supported advanced/help routes. Hindi layout, forced colors, reduced motion,200% zoom and keyboard operation included.
- **Activity:** timestamps, categories, malformed/reversed date recovery, filtering, detail dialogs, paging/cursor and restored scroll.
- **Accounts/cloud/gateway:** origin/CSRF/role/session boundaries, signup validation/duplicate/throttle/login, empty real home, gateway-first setup, password confirmation/private download, explicit pending connection, isolated demo scenarios, refresh persistence and exit. No real enrollment or live cloud writes.
- **Backend:** durable commands and idempotency, no blind replay, fresh-versus-retained reports, RFID authorization, bounded speech inputs/jobs, recovery/migration/backup behavior, remote delivery/admission/revocation and tenant isolation in disposable databases.

## Failures and diagnostic events retained

1. The initial mobile invocation raced creation of the shared output directory and did not start. It is not counted as a passing test. Independent output setup was added to the execution command and the actual suite was run.
2. The original WebKit mobile focus assertion failed. It was repaired in application source; no assertion was removed or weakened. Both failure and rerun evidence remain.
3. WebKit wide verification recorded18 GET cancellations, all `Load request cancelled` for `/api/ai/models`, during the deliberate navigation-interruption portion. The checks still confirmed correct restored pages and no application page errors. Do not report zero failed/cancelled requests for that engine.
4. Cloud axe checks recorded516 scanner inline-style probes blocked by the application's CSP. The existing harness records these separately from application CSP errors, which were0. CSP was not weakened to accommodate the scanner.

## Limits and remaining work

The native audio fixtures use actual Vosk/Kokoro/Chromium Web Audio but a synthetic microphone stream. They do not prove recognition quality for the user's personal Chrome profile, real microphone or all Indian accents. Installed Chrome is used through the documented external fallback because downloaded Chromium has previously encountered Windows launch restrictions. WebKit automated layout verification is not native Safari/iPhone microphone acceptance.

Physical ESP32 commissioning remains unverified. The single-board firmware/GPIO/authenticated MQTT/relock gaps in the IoT report still apply. The current simulator never searches for physical devices; actual devices need deliberate real-runtime configuration and supervised acceptance.

The Windows first-run/BAT installer and remote website-to-hub audio/conversation relay remain planned in their implementation documents. They are not implemented features and cannot be declared tested by these passing suites. Existing local model files are installed on this development computer. No clean-machine installation or cloud-voice delivery is claimed.

The local demo remains available at `http://localhost:3001/assistant`, with simulation=true, Automatic input/reply, spoken replies enabled and both speech models ready. Reload to use the latest frontend code. Model-assisted commands and queries are the supported scope; unrestricted general AI conversation is not implemented.
