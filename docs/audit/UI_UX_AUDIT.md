# UI/UX audit

Date: 2026-11-06. See [BUG_REPORT.md](BUG_REPORT.md) for exact source lines and remediation. This audit combined source tracing, existing-image inspection and newly executed fully intercepted browser checks. It did not operate the live preview, microphone or hardware.

## Overall assessment

The four-theme design is substantially implemented and visually consistent. System fonts/local Devanagari fallbacks, one icon family, semantic palettes, large native controls, explicit device actions, a five-section responsive navigation system and clear simulation labeling are present. It is an original functional UI rather than a screenshot of the concept boards.

Navigation is much improved: My Home is a real Home anchor, one Navigation class owns History API changes, parent fallback and owned prior history are distinguished, duplicate current-path pushes are avoided, page titles/focus/scroll are managed and unsupported child routes are rejected. Fresh spot checks passed My Home, contextual room Back, native Forward and nested refresh. The earlier complete A–J/32-route evidence was inspected but was not rerun wholesale.

The remaining serious UX problems are state/interaction problems: live rerendering interrupts keyboard and Help use (AUD-010), cached outage labels look current (AUD-011), group failures vanish (AUD-012), alert reading/counts are incomplete (AUD-013), some asynchronous failures have no feedback (AUD-014), invalid filters trap Activity in retry (AUD-015), and Assistant readiness/language disagree with current state (AUD-017/AUD-019).

## Screen and rendering coverage

Fresh automated matrix: **108 cases, zero detected overflow and zero axe violations** for the configured WCAG A/AA tags. This is 60 main-screen cases (Home, Rooms, Security, Assistant, Settings × themes05/01/03/04 × widths320/768/1440) plus 48 secondary cases (24 routes × widths390/1440, Theme05).

Secondary routes exercised: two numbered rooms, all four light details, gas/motion details, door, cards, Activity, Alerts and all 12 Settings subpages including Advanced/Local AI. Empty cards/model lists and deterministic fresh fixtures were used. Other three room instances share the inspected room template; active-alert behavior was tested separately. This matrix does not certify every dialog/error/state combination or every screen in Hindi.

Targeted fresh browser evidence:

| Check | Actual outcome |
|---|---|
| Large text checkbox, Space | Preference changed; focus moved to BODY — AUD-010 |
| Expanded Help followed by snapshot | Open disclosure count 1 → 0 — AUD-010 |
| Fresh door report followed by socket loss | Outage banner plus “Controller reports Locked” — AUD-011 |
| Group request with one unavailable target | Final reply retained only successful light — AUD-012 |
| Unread motion alert list | Only device-detail destination, no alert-detail link — AUD-013 |
| Ack receives HTTP503 | Unhandled page error; no visible error — AUD-014 |
| Activity ?from=bad | No editable date fields or reset, only repeating Retry — AUD-015 |
| Hindi answer with Auto reply and English UI | Hindi text but synthesis request language=en — AUD-017 |
| Large controls on Devices | Favorite target remained48px — AUD-018 |
| Missing STT becomes ready | Mic enabled while setup-required instructions remained — AUD-019 |

These tests intercepted all app HTTP and WebSocket requests at a synthetic HTTPS origin. No real server/database/broker was used, and no microphone permission was requested. Snapshot updates and API failures were simulated.

Existing screenshots independently viewed in this audit:

- .local/qa/browser/05-390-home.png
- .local/qa/browser/01-390-rooms.png
- .local/qa/browser/03-768-security.png
- .local/qa/browser/04-1440-assistant.png
- .local/qa/browser/05-390-settings.png

All four original reference boards were also viewed. The existing Settings image uses the prior authenticated QA fixture, explaining its account/Sign out row; it is not evidence that login was restored to the user's guest preview. Source and new guest-shaped mock fixtures preserve the preview distinction. Full-page captures place the fixed bottom bar inside a longer document image at the viewport boundary; that alone is not proof of content permanently hidden behind it.

## Theme assessment

| Theme | Verified design implementation |
|---|---|
| 05 Serene Emerald | Default HTML/bootstrap/fallback; white/warm-neutral surfaces, emerald controls |
| 01 Warm Organic | Cream background, soft green controls, warmer surface/shadow |
| 03 Universal Comfort | Larger base type and target tokens, stronger card outlines, blue microphone |
| 04 Friendly Pastel | Blue primary controls and pastel room/category surfaces |

Semantic tokens drive backgrounds, surfaces, text, borders, focus, buttons, dialogs, notifications and assistant/security elements. Theme/language/accessibility keys are versioned browser preferences; bootstrap runs before CSS-visible app content and cross-tab updates are supported. No runtime online font/icon service was found. Common fixed-size controls bypass the larger-control token (AUD-018), although they still meet the normal48px target.

Storage persistence code was inspected and prior navigation/reload/denied-storage results reviewed. The fresh matrix repeatedly changed themes and reloaded pages successfully. Browser preferences are not claimed to synchronize between households/devices. Favorites/home/voice/category data use backend preferences; real DB restart persistence was not inferred from the preview's in-memory behavior.

## Functional control inventory

“Wired” below means a concrete handler/destination was traced, not that every possible failure was exercised. Server policy remains authoritative.

| Area / controls | Handler or destination | Feedback / audit assessment |
|---|---|---|
| My Home, brand, five primary links | Navigation.go via anchor delegation | Wired; fresh My Home/Back/Forward/refresh passed |
| Contextual Back | Navigation.back with owned history or parent replacement | Wired; accessible destination label; mobile visible arrow |
| Bell / profile / Skip | /security/alerts, /settings, #main | Wired; unread accessible label stale, AUD-013 |
| Home summary cards, room shortcuts, assistant shortcut | Rooms/filter/detail/Assistant routes | Real navigation; cached status issue AUD-011 |
| Home All lights off | ctx.bulkOff → bounded ctx.command calls | Per-device service, no optimistic device update; physical gate not exercised |
| Home Lock front door | ctx.command door lock | Disabled by gate/role/connectivity/pending; no unsupported toggle |
| Favorite stars / Choose favorites | PUT preferences / Settings Devices | Wired, versioned; large-target gap AUD-018 |
| Rooms search / filter chips / Clear | URL query via Navigation.query | Wired; query preserved; no device mutation |
| Add/Edit room / Remove empty room | Versioned POST/PUT/DELETE APIs and dialogs | Wired; default-room restart resurrection AUD-007 |
| Device On/Off / Details / Activity | Shared command / detail / filtered Activity | Explicit controls; no brightness, fan or sensor actuation |
| Device Edit name/room | Metadata PUT with captured version | Real handler; heartbeat conflict AUD-008 |
| Door Lock/Unlock/Check again | Shared command / reauth+challenge+confirm / snapshot | Protected unlock; Check again failure boundary AUD-014; stale display AUD-011 |
| Security cards/activity/alerts | Dedicated routes | Wired; no fabricated physical-protection guarantee |
| Add/Edit/Remove card, Authorized checkbox | Owner-sensitive CRUD | Real protected APIs; labels escaped via text nodes; no live card changes made |
| Alerts Active/History / acknowledgment / View details | Local filter / receipt POST / device link | Receipt not resolution; read-navigation gap AUD-013, error gap AUD-014 |
| Activity category/search/date/device clear | URL filters → bounded API query | Wired; invalid filter removes recovery controls, AUD-015 |
| Activity Refresh/Load more/Event details | Cache reset / cursor append / read-only native dialog | Wired; prior cursor preservation evidence reviewed |
| Assistant tap/Stop listening/Cancel | VoiceCapture ticket/mic/worklet/socket state | Real pipeline source; native capture not rerun; no auto-mic |
| Typed Send / suggestion chips | interpret→execute / populate text input | Suggestions do not directly execute; semantic problem AUD-004 |
| Voice review Send/Cancel | Explicit reviewed execution / close dialog | Backend unlock rejection retained; no live voice execution |
| Clear/Delete conversation / Replay/Stop speech | In-memory conversation/capture/audio controls | Wired; stale replay AUD-009 and partial response AUD-012 |
| Appearance radios / Reset | applyPreferences | Four themes; reset05; no device action |
| Accessibility four checkboxes / Language radios | applyPreferences | Persisted local keys; checkbox focus issue AUD-010 |
| Voice input/reply select, rate, spoken replies, wake phrase | Backend preference / browser wake setting | Wired; Auto spoken-language mismatch AUD-017 |
| Test voice / Stop | Trusted local test-phrase job / audio pause | Wired; no arbitrary text synthesis; worker readiness must be available |
| Browser notification permission / categories | Browser permission / own preferences | Gas/motion only; no background guarantee; rejected permission needs catch |
| Home name / Save | Owner-only shared setting PUT | Versioned save/toast; no unsupported household address UI |
| Privacy Sign out / account controls | Session logout; hidden in guest preview | Actual auth preserved; passive idle bug AUD-005 |
| Help disclosures / About notices | Local details elements / local NOTICE | Functional but disclosure reset AUD-010; no internet dependency |
| Advanced Refresh / Check readiness | GET system / fixed profile readiness endpoint after reauth | Honest readiness check, not model installation/switching; worker recovery is operator work |
| Production login/language/password visibility | Auth login/session plus local UI controls | Source traced and fresh API suite tested; production login is intentionally distinct from preview |

No entirely decorative action was found in the examined active inventory. Several error paths can appear inert (AUD-014); stale readiness and one-way alert navigation similarly undermine predictable behavior. Historical inactive scripts are not a second supported UI.

## Accessibility and consumer use

Native buttons/links/forms, labelled inputs/selects, aria-pressed favorites, native dialogs, skip link, focus rings, reduced-motion handling, safe-area CSS and local Hindi fonts are positive foundations. The fresh axe pass cannot detect the reproduced focus/reading interruption or prove NVDA announcements, contrast in every transient state, phone keyboard/safe-area behavior or full WCAG conformance.

The easiest household language is already used for routine On/Off and page labels. Keep precise warnings about relay reports, UID cloning, experimental gas and acknowledgment. Technical UID formatting belongs in owner setup; ordinary household members should not need it. “Reauthenticate,” “controller,” and “uncalibrated” still need native-language/user comprehension trials, not indiscriminate simplification.

Unslop is development writing tooling only. Its existing audit/scanner workflow was reviewed, not rerun because it writes outside docs/audit. Ten before/after fixtures are checked by audit-copy.py, but those fixture comparisons are not an exhaustive proof that every rendered occurrence was replaced: for example, the old “Four ways to feel at home” still appears in appearanceView while Settings uses the new wording. This is a QA/copy-coverage observation, not an additional safety defect or a reason to reword already-clear text. Hindi needs native manual review; English scanner scores do not establish Hindi quality.

## Remaining visual/human validation

Before household release, test actual mobile Safari/Chrome and physical safe areas, native200%/400% zoom, soft keyboards, NVDA, full keyboard task completion during telemetry, screen-reader announcement frequency, Hindi translations and older/nontechnical user tasks. Preserve the four palettes and the default while fixing behavior. Reference boards include unsupported cameras/scenes/climate controls and “home protected” claims; their omission is appropriate, not a visual regression.

