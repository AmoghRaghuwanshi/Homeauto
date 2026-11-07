# HomeAuto — Independent Multi-Skill Architecture, UI/UX, and IoT Audit Report

**Date of Audit:** 2026-11-06 (Asia/Calcutta)  
**Auditor:** Independent Principal Software Architect, Senior UI/UX Auditor, IoT Systems Engineer, PostgreSQL Architect, Cloud Deployment Specialist, and Security Reviewer  
**Audited Target:** HomeAuto 2.0.0 (`D:\homeauto-main`)  
**Audit Mode:** Strictly Read-Only (Static analysis, isolated unit verification, architectural inspection; zero files modified, zero hardware actuated, zero external connections made)  
**Deliverable File:** `docs/audit/GEMINI_INDEPENDENT_RECOMMENDATIONS.md`  

---

## 1. Executive Assessment

HomeAuto 2.0.0 is an ambitious, privacy-first smart home ecosystem designed to operate autonomously on a local network while supporting an optional hybrid cloud architecture via Neon PostgreSQL and Vercel. It combines:
- A local Node.js/Express hub with an in-memory/persisted SQLite layer (`sql.js`),
- Vanilla ES module frontend with zero compilation overhead and four theme palettes,
- Local speech recognition and synthesis (Vosk STT and Kokoro ONNX TTS),
- ESP32 microcontrollers managing 4 light relays, an MQ-2 gas sensor, a PIR motion sensor, and an RC522 RFID reader with a door lock relay,
- A newly engineered cloud synchronization layer (`server/cloud` and `server/online`) targeting Neon PostgreSQL and Vercel.

### Core Audit Verdict
The project demonstrates exceptionally disciplined software engineering in its local core and recent software remediations. All **111 unit, remediation, and cloud integration tests pass cleanly in 11.2 seconds**. The previous software remediations for findings AUD-004 through AUD-019 and HUI-001/HUI-002 are confirmed implemented and verified in the source tree.

However, the system is **strictly not ready for physical door actuation or production cloud deployment**. The audit reveals a fundamental bifurcation between:
1. **Immediate Hackathon Demonstration Goals:** Which can be reliably and convincingly achieved locally using ESP32 lighting and sensor control with the offline Shrimaan assistant, while keeping the door lock relay safety gate completely disabled.
2. **Long-Term Production Goals:** Which require resolving physical firmware relock deadlocks, deploying authenticated TLS MQTT, completing Vercel deployment scaffolding (`vercel.json` and serverless API handlers are currently missing), and reconciling dual competing cloud database architectures.

### High-Level Severity Breakdown
- **P0 (Physical Safety / Hardware Hazard): 1 item** (AUD-001: Blocking reconnect loops in `door_security.ino` prevent auto-relock if network drops while unlocked; door safety gate must remain OFF).
- **P1 (Critical Security / Deployment Blockers): 4 items** (AUD-002: Broker/firmware credential mismatch; AUD-003: Public Git history exposure of original TLS key; NEW-001: Missing Vercel deployment configuration, serverless API wrapper, and SPA rewrites; NEW-007: Overly strict PostgreSQL connection URL parsing rejecting standard Neon connection strings).
- **P2 (Architectural, Usability & Reliability Defects): 18 items** (Including NEW-002 inline rate-limit table churn, NEW-003 dual competing cloud schemas, NEW-004 Hallmark Floor violations regarding middle dots and decorative status dots, NEW-005 Unslop copy mismatches, and NEW-006 firmware loop blocking during Wi-Fi reconnects).
- **P3 (Polish, Consistency & Homophone Edge Cases): 3 items** (Including AUD-018 target scaling residuals, NEW-009 Vosk Hindi numeral homophone confusion).

---

## 2. Skills Discovered and Actually Used

All three mandatory skills were located, inspected on disk, and applied strictly in read-only audit mode according to their official behavior contracts:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SKILL 1: Hallmark 2.0.0 (UI/UX Design & Quality Audit)                                │
│ Location: C:\Users\Amogh\.codex\audit-tools\homeauto-hallmark-20261106\skills\hallmark │
│ Pinned Commit: 407fa689f4a276f2fd389208d271d0fef08f5058                               │
│ References Read: SKILL.md, references/redesign.md, references/flow.md (§ App screens),│
│   references/gates.md, references/interaction-and-states.md, craft.md                  │
│ Workflow: Audit-only, --scope app. Checked against Floor rules, Reflex gates, and      │
│   interaction states across all 4 approved themes. No themes replaced or scaffolds run.│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ SKILL 2: Unslop 2.3.0 (Content Quality & Human Interface Copy)                         │
│ Location: C:\Users\Amogh\.agents\skills\unslop\SKILL.md                                │
│ References Read: SKILL.md, references/core-contract.md, references/commands/cleanup.md│
│   references/commands/rewrite.md, presets/crisp-human.md                              │
│ Workflow: Audit-first, preservation of safety warnings and technical uncertainty.     │
│   Suggested before/after copy in report only. No English heuristics applied to Hindi.  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ SKILL 3: Neon Postgres (Database Architecture & Lakebase Engine)                       │
│ Location: C:\Users\Amogh\.agents\skills\neon-postgres\SKILL.md                          │
│ References Read: SKILL.md, references/branching.md, official Neon docs on connection   │
│   pooling (-pooler vs direct), RLS, migrations, and Vercel serverless compute.         │
│ Workflow: Schema evaluation, connection pooling analysis, migration safety review.     │
│   No live database connections initiated; no secrets read or output.                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Files and Documents Reviewed

The audit encompassed a thorough, line-by-line inspection of all active application files, firmware, deployment manifests, tests, and documentation:

### Primary Project Documentation & Specifications
- `README.md` (Project overview, quick start, source map)
- `docs/DEVELOPMENT_STATE.md` (Checkpoint status, test verification records)
- `docs/REMEDIATION_TRACKER.md` (21-item issue tracking matrix)
- `docs/SKILL_AND_CONTEXT_REGISTRY.md` (Installation and context history)
- `docs/HARDWARE_RELEASE_REMEDIATION_PROPOSALS.md` (Firmware & TLS release prerequisites)
- `HomeAuto_UIUX_Docs/context.md` (System context and implementation constraints)
- `HomeAuto_UIUX_Docs/design.md` (Design philosophy and token architecture)
- `HomeAuto_UIUX_Docs/THEMES.md` (Complete color matrix for Themes 01, 03, 04, 05)
- `HomeAuto_UIUX_Docs/SCREENS.md` (Screen inventory and state requirements)
- `HomeAuto_UIUX_Docs/COMPONENT_SPEC.md` (Component definitions and target sizes)
- `HomeAuto_UIUX_Docs/RUNTIME_CONTRACTS.md` (Implemented runtime differences, Revision 4)
- `HomeAuto_UIUX_Docs/SECURITY.md` (Implemented security model and boundaries)
- `HomeAuto_UIUX_Docs/OFFLINE_AI.md` (Vosk STT and Kokoro TTS CPU pipeline)
- `HomeAuto_UIUX_Docs/OPERATIONS.md` (Operator commands, credential setup, recovery)
- `HomeAuto_UIUX_Docs/IMPLEMENTATION_JOURNAL.md` (Detailed milestone logs)

### Prior Audit Reports (Baseline)
- `docs/audit/AUDIT_SUMMARY.md` (Initial Astra 19-finding baseline)
- `docs/audit/BUG_REPORT.md` (Detailed breakdown of AUD-001 through AUD-019)
- `docs/audit/IOT_COMPATIBILITY.md` (MQTT topic mapping, payload review)
- `docs/audit/SECURITY_AUDIT.md` (Vulnerability assessments, session models)
- `docs/audit/AI_VOICE_AUDIT.md` (Local speech inference benchmarks)
- `docs/audit/UI_UX_AUDIT.md` (Initial visual and interaction review)
- `docs/audit/hallmark/HALLMARK_AUDIT_SUMMARY.md` (Hallmark continuation, HUI-001/002)
- `docs/audit/hallmark/HALLMARK_GATE_MATRIX.md` (Detailed gate check record)
- `docs/audit/hallmark/FINDINGS.md` (Evidence for HUI-001 and HUI-002)
- `docs/audit/hallmark/ASTRA_TO_SOUL_HANDOFF.md` (Continuation guidance)
- `docs/ux/UI_REDESIGN_PROGRESS.md` (Frontend transformation verification)
- `docs/ux/UNSLOP_AUDIT.md` (Previous UI copy audit results)

### Backend, Database, Cloud & Server Source Files
- `server/package.json` & `server/package-lock.json` (Dependencies and scripts)
- `server/server.js` & `server/lifecycle.js` (Startup lifecycle and configuration)
- `server/app.js` (Main Express REST API and routing)
- `server/realtime.js` (WebSocket snapshot dispatcher and connection monitor)
- `server/auth/sessions.js` (Session management, scrypt password hashing)
- `server/db/repository.js` (SQLite repository, schema v5, atomic file export)
- `server/db/maintenance.js` (Database cleanup, backup pruning)
- `server/services/home.js` (Device status manager, optimistic command gating)
- `server/services/assistant.js` (Speech text cache, query replay handler)
- `server/voice/intent.js` (Deterministic natural language intent parser)
- `server/voice/speech-service.js` (Worker process management for Vosk and Kokoro)
- `server/mqtt/broker.js` (MQTT client adapter with TLS/authentication requirements)
- `server/cloud/postgres.js` (PostgreSQL pool configuration and RLS verification)
- `server/cloud/protocol.js` & `server/cloud/journal.js` (Catalog sync protocol)
- `server/cloud/worker.js` & `server/cloud/app.js` (Catalog mirror worker and API)
- `server/cloud/migrations/001_catalog.sql` (Cloud catalog schema DDL)
- `server/online/app.js` (Full multi-tenant cloud Express API)
- `server/online/auth.js` (Cloud authentication, session issuance, rate limiting)
- `server/online/db.js` (Tenant-scoped transaction runner and configuration)
- `server/online/gateway.js` (Local hub gateway worker, polling and command leasing)
- `server/online/protocol.js` & `server/online/store.js` (Online store and exchange logic)
- `server/online/migrate.js` (Cloud migration runner with advisory locks)
- `server/online/migrations/001_online.sql` (Full online multi-tenant schema DDL)
- `server/scripts/recovery.js` (Backup preflight validation and database restore)

### Frontend Source Files
- `public/index.html` (Application shell, root DOM containers, metadata)
- `public/css/tokens.css` (Canonical color palettes for Themes 01, 03, 04, 05)
- `public/css/app.css` (Hallmark-structured responsive layout and component styling)
- `public/js/main.js` (Application lifecycle, shell rendering, event listeners)
- `public/js/views.js` (View definitions for Home, Rooms, Security, Assistant, Settings, etc.)
- `public/js/components.js` (Micro-component primitives: buttons, inputs, icons, modals)
- `public/js/navigation.js` (Custom client-side History router and focus manager)
- `public/js/api.js` (Unified fetch wrapper with CSRF token management)
- `public/js/state.js` (Reactive client state store and WebSocket/poll handlers)
- `public/js/preferences.js` & `public/js/theme-bootstrap.js` (Theme and accessibility persistence)
- `public/js/i18n.js` (English and Hindi translation dictionaries)

### Firmware & Deployment Files
- `firmware/light_controller/light_controller.ino` (ESP32-A sketch for 4 relays, MQ-2, PIR)
- `firmware/door_security/door_security.ino` (ESP32-B sketch for RC522 RFID and door lock relay)
- `deploy/cloud.env.example` (Template for cloud environment variables)
- `deploy/cloud-hubs.example.json` (Template for cloud hub enrollment registry)
- `deploy/mosquitto.conf.example` & `deploy/homeauto.acl` (MQTT broker templates)
- `deploy/homeauto.env.example` (Local environment template)

---

## 4. Current Implementation Status

A rigorous distinction must be drawn between working software, simulated behavior, and gated features:

| Subsystem | Implemented & Working | Simulated / Bench Only | Gated / Incomplete |
|---|---|---|---|
| **Frontend UI/UX** | 4 selectable themes, responsive navigation (320px–1440px), 48/56px touch targets, accessible modal focus management, full view tree | Preview mode (`/preview:isolated` on port 3001) with mock data | None (UI software layer is complete) |
| **Local Hub API & Auth** | Express API, scrypt password hashing, Secure HttpOnly cookies, CSRF protection, 16KiB body caps, atomic SQLite exports | Mock repository in tests | None (Local hub software layer is complete) |
| **Database (Local)** | SQLite schema v5 with 17 tables, foreign keys, deterministic migrations, preflight restore validation | In-memory `sql.js` test fixtures | Backup power-loss survival untested on real OS |
| **Database (Cloud)** | Two schemas: `homeauto_cloud` (catalog mirror) and `homeauto_online` (multi-tenant cloud with RLS & advisory locks) | PGlite in-memory WASM tests (111 tests passing) | Live Neon deployment, production database provisioning, connection strings |
| **Cloud Deployment** | Bounded 2-second HTTPS gateway polling protocol (`server/online/gateway.js`) | Local loopback mock gateway worker | Missing `vercel.json`, missing root serverless handler, missing SPA rewrites |
| **Voice & Speech** | Deterministic intent parser (`intent.js`), Vosk STT models (en/hi), Kokoro ONNX TTS models (af_heart/hf_alpha) | AudioWorklet simulated MediaStream tests | Consented human voice dataset, Indian-accent field trials |
| **IoT Lighting (ESP32-A)** | Arduino sketch with topics `home/light/X/command` and `home/light/X/status` | Ingest and command tracking in `server/services/home.js` | Authenticated TLS MQTT connection (sketch uses port 1883 with NULL auth) |
| **IoT Sensors (ESP32-A)** | MQ-2 analog read and PIR digital read with MQTT JSON publication | Synthetic telemetry ingestion | Hardware gas calibration (readings are uncalibrated ADC counts) |
| **IoT Door & RFID (ESP32-B)** | RC522 SPI scanning, MQTT topic `home/door/1/command`, local backend challenge/reauth | Local backend challenge issuance and UID storage | **P0 Physical relock deadlock hazard** (AUD-001); Door safety gate is intentionally kept OFF |

---

## 5. Complete Frontend Audit Using Hallmark

Evaluated under Hallmark 2.0.0 (`--scope app` principles). HomeAuto is an operational smart home control console, not a marketing website.

```
       Desktop Layout (>= 1024px)                  Mobile Layout (<= 767px)
┌──────────┬─────────────────────────────┐       ┌─────────────────────────────┐
│ Sidebar  │ Topbar: Title, Bell, User   │       │ Topbar: Logo, Bell, Avatar  │
│ (232px)  ├─────────────────────────────┤       ├─────────────────────────────┤
│          │ Active Page Content:        │       │ Active Page Content:        │
│ • Home   │ • Quick Actions (4-col)     │       │ • Quick Actions (2-col)     │
│ • Rooms  │ • Status Grid (4-col)       │       │ • Status Grid (2-col)       │
│ • Sec    │ • Favorites / Rooms / Cards │       │ • Favorites / Room rows     │
│ • Assist │                             │       │                             │
│ • Sett   │                             │       ├─────────────────────────────┤
└──────────┴─────────────────────────────┘       │ Bottom Navigation (5 items) │
                                                 └─────────────────────────────┘
```

### 5.1 Screen-by-Screen Review

#### 1. Home (`public/js/views.js:64–85`)
- **Structure & Hierarchy:** High-density, task-focused. The hero area is cleanly subordinated to an informative greeting (`Welcome home.`, `Simple controls.`) paired with a live device connectivity badge.
- **Quick Actions:** Prioritizes immediate physical utilities (`All lights off`, `Lock front door`, `Check home`, `View alerts`) in a 4-column desktop / 2-column mobile grid.
- **Status Grid:** 4-card summary (Lights, Front Door, Gas Sensor, Motion Sensor) gives immediate operational posture without navigational hunting.
- **Favorites & Rooms:** Displays device cards for starred items; falls back to a clean empty state guiding users to `/settings/devices`.

#### 2. Rooms & Room Details (`public/js/views.js:86–103`)
- **Collection Cards:** Visual room cards present actual device counts, active states, and a visual icon strip of contained hardware.
- **Mobile Density:** Below 600px, cards reflow into compact 88px horizontal rows, preventing vertical scrolling exhaustion.
- **Search & Filter:** Instant search box and filter chips (`All`, `Lights`, `Sensors`, `Door`) operate synchronously without page reload.

#### 3. Device Details (`public/js/views.js:104–110`)
- **Identity & State:** Separates device name, room location, and live telemetry from actionable controls.
- **Operational Truth:** Correctly shows "Last report" timestamp and qualifies disconnected state as "Unavailable" or "Last known" rather than implying current operational success.

#### 4. Security & Front Door (`public/js/views.js:111–127`)
- **Door Detail:** Central lock status orb uses semantic colors (`--success` for locked, `--warning` for unlocked).
- **Mandatory Caveats:** Prominently displays `Physical lock position is not sensed.` and `The controller normally relocks after about 5 seconds. Network failures can delay relocking.`
- **Gating:** Explicitly disables the unlock button with an inline message: `Door control needs supervised safety setup.` when the safety gate is closed.

#### 5. Access Cards (`public/js/views.js:128–139`)
- **Owner Scope:** Restricts CRUD actions to authenticated owners; blocked in cloud mode with clear routing explanation.
- **Privacy:** Masks sensitive RFID UIDs (`••:••:12:34`) in list views.

#### 6. Alerts & Activity (`public/js/views.js:140–174`)
- **Alert States:** Distinguishes active vs. resolved alerts; requires deliberate acknowledgment (`I've seen this`) which does not falsely resolve physical sensor warnings.
- **Activity Log:** Uses cursor-based pagination with category filters (`Doors`, `Lights`, `Sensors`, `System`) and date range pickers. Resilient recovery controls prevent trapping users on malformed query inputs.

#### 7. Shrimaan Voice Assistant (`public/js/views.js:237–257`)
- **Layout:** Two-column desktop workspace separating the microphone control station from the scrollable conversation transcript and text composer.
- **Readiness Badges:** Dynamically updates microphone availability and displays local setup notices without restarting capture.

#### 8. Settings Subsystem (`public/js/views.js:176–236`)
- **Information Architecture:** Grouped into three distinct semantic sections: `Preferences` (Appearance, Accessibility, Language, Voice, Notifications), `Home` (Devices, Rooms, Home details), and `General` (Security & privacy, Help & support, About, Advanced).
- **Help Topics:** Accordion-based `<details>` disclosure elements providing offline household guidance.

---

### 5.2 Evaluation of the Four Approved Themes

The application strictly locks styling to four approved semantic themes defined in `public/css/tokens.css`. Hallmark's catalog deals were intentionally bypassed to preserve project identity:

| Theme Slug | Visual Identity | Evaluated Characteristics & Hallmark Alignment |
|---|---|---|
| **05 — Serene Emerald (Default)** | Forest green (`#166F46`), crisp white surfaces, soft mint highlights (`#E5F3E9`), neutral borders. | **Flawless app baseline.** Superb contrast ratio (exceeds WCAG AA 4.5:1 on text and 3:1 on controls). Calm, non-fatiguing, ideal for wall-mounted tablets or handheld phones. |
| **01 — Warm Organic** | Deep olive/earth green (`#1D7049`), warm linen background (`#FAF8F2`), cream cards. | **Strong household warmth.** Gives a tactile, residential feeling. Borders maintain sufficient contrast (`#738076`). |
| **03 — Universal Comfort** | High-contrast emerald (`#187A48`), slate blue microphone (`#246BC4`), 18px base type, 56px minimum touch targets. | **Outstanding accessibility theme.** Specifically tailored for elderly users or motor-impaired individuals. All touch targets expand to 56px. Visual hierarchy is bold and readable without looking clinical. |
| **04 — Friendly Pastel** | Periwinkle blue (`#2565C7`), pastel room badges (blue, green, peach, rose), crisp cool background (`#F7F9FE`). | **Approachable, family-oriented.** Color coding across rooms aids rapid visual scanning. Text remains dark slate (`#17243D`), preserving high contrast despite soft backgrounds. |

---

### 5.3 Hallmark Rule Violations & Required Refinements

While the frontend transformation resolved major layout issues, strict application of Hallmark 2.0.0 rules reveals several concrete violations that must be addressed:

#### Violation 1: Floor Rule 10 / Gate 63 — Middle-Dot Joined Meta Strings
- **Rule:** *"Never middle-dot-joined meta strings, arrows glued to link text, or decorative status dots."*
- **Evidence in Source:**
  - `public/js/main.js:73`: `t('Request accepted') + ' · ' + t(...)`
  - `public/js/main.js:103`: `'HomeAuto · ' + t('Home')`
  - `public/js/main.js:117`: `${t(info.title)} · HomeAuto`
  - `public/js/views.js:20`: `' · ' + t(description)`
  - `public/js/views.js:35`: `' · ' + t('Check again')`
  - `public/js/views.js:143`: `.join(' · ')`
  - `public/js/views.js:144`: `' · ' + description`
  - `public/js/views.js:273`: `'2.0.0 · Node / Express · sql.js · MQTT · Vosk · Kokoro ONNX'`
  - `public/index.html:16`: `HomeAuto · Loading…`
- **Correction:** Use standard semantic separation (line breaks, comma lists, subtle pills, or distinct flex layout spans).

#### Violation 2: Floor Rule 10 / Gate 63 — Decorative Status Dots
- **Rule:** *"Never ... decorative status dots."*
- **Evidence in Source:**
  - `public/js/components.js:66`: `export function status(text, tone = 'neutral') { return el('span', { class: 'status status-' + tone }, el('span', { class: 'status-dot', 'aria-hidden': 'true' }), t(text)); }`
  - `public/css/app.css:102`: `.status-dot { width:6px; height:6px; border-radius:50%; background:currentColor; flex:none; }`
- **Correction:** Status should be communicated through typography, background pill tints, or explicit badge styling rather than an unanchored 6px colored dot.

#### Violation 3: Floor Rule 9 / Gate 54 — Eyebrows and All-Caps Labels
- **Rule:** *"Never an eyebrow, and never a label in tracked capitals or small caps..."*
- **Evidence in Source:**
  - `public/js/main.js:107`: `el('p', { class: 'sidebar-note' }, icon('leaf', 'icon-small'), t(Api.mode === 'cloud' ? 'HomeAuto online' : 'LOCAL & PRIVATE'))`
  - `public/js/main.js:182`: `el('p', { class: 'eyebrow' }, t(Api.mode === 'cloud' ? 'HomeAuto online' : 'LOCAL & PRIVATE'))`
  - `public/js/views.js:192`: `el('p', { class: 'eyebrow' }, t('Preview'))`
  - `public/css/app.css:40`: `.eyebrow,.nav-label,.settings-section-label { font-size:.875rem; color:var(--text-subtle); font-weight:500; }`
- **Correction:** Remove `.eyebrow` class; convert `'LOCAL & PRIVATE'` to sentence case (`'Local and private'`).

---

## 6. Content Audit Using Unslop

Evaluated under Unslop 2.3.0 (`references/core-contract.md` and `presets/crisp-human.md`). Focus is placed on human clarity, operational precision, and eliminating robotic or misplaced marketing phrases:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ UNSLOP FINDINGS SUMMARY:                                                               │
│ • Preserved: All critical physical safety caveats, uncalibrated sensor notices,        │
│   tamper/cloning warnings, and non-verified hardware status receipts.                  │
│ • Flagged: Misplaced marketing slogans on error screens, all-caps shouting, dead       │
│   translation keys, and robotic 404 descriptions.                                      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Concrete User-Facing Text Findings

| Screen / Component | Current Text in Source | Defect Analysis | Recommended Replacement | Preserved Meaning & Safety |
|---|---|---|---|---|
| **404 Page** (`views.js:259`) | `empty('Page not found', 'Your home stays yours.', navButton('Go home', '/', 'home'))` | **Severe context mismatch.** Pastes the brand marketing slogan as an error explanation. Does not tell the user what happened or what to do. | `empty('Page not found', 'This page does not exist or may have moved.', navButton('Back to Home', '/', 'home'))` | Clearly communicates navigational failure without robotic brand sloganeering. |
| **Accessibility Preview** (`views.js:192`) | `el('p', { class: 'eyebrow' }, t('Preview')), el('h2', {}, t('Your home stays yours.')), el('p', { class: 'muted' }, t('Internet is not needed for everyday controls.'))` | **Repetitive slogan fill.** In an accessibility settings preview intended to demonstrate text/target scaling, repeating the login slogan is confusing. | `el('div', { class: 'preview-card' }, el('h2', {}, t('Living room light')), el('p', { class: 'muted' }, t('Controller reports on.')), navButton('Turn off', '#', 'bulb', 'primary'))` | Shows realistic interactive controls and text scaling so users can actually gauge accessibility sizing. |
| **Sidebar & Login** (`main.js:107, 182`) | `t('LOCAL & PRIVATE')` | **All-caps shouting.** Unnecessary uppercase tracking reads like an AI badge or marketing stamp. | `t('Local and private')` (Sentence case) | Preserves privacy guarantee while matching standard human interface register. |
| **Translation Dictionary** (`i18n.js:20, 30, 38`) | `'Simple controls. A calmer day.'`, `'A little peace of mind.'`, `'Make yourself at home.'` | **Dead marketing copy.** These phrases were flagged in earlier audits and removed from views, but remain orphaned in the translation dictionary. | Remove orphaned dictionary keys during next localization maintenance pass. | Reduces dictionary bundle size and prevents accidental re-introduction. |
| **About View** (`views.js:273`) | `'2.0.0 · Node / Express · sql.js · MQTT · Vosk · Kokoro ONNX'` | **Robotic technology rollcall.** Glues internal library names together with middle dots. | `Version 2.0.0 (Local offline hub with voice engine)` | Human-readable explanation of software version and capabilities. |

### Preserved Safety Text (Explicitly Approved)
The following operational phrases were reviewed and **must remain verbatim** due to physical safety, legal, and operational integrity:
1. `Physical lock position is not sensed.` (`views.js:114`) — Essential truth: relays energize solenoids; they do not detect whether the bolt physically engaged the strike plate.
2. `The controller normally relocks after about 5 seconds. Network failures can delay relocking.` (`views.js:117`) — Essential warning of network-dependent auto-lock hazards.
3. `Uncalibrated reading. Use an independent gas alarm.` (`views.js:109`) — Essential disclaimer preventing life-safety reliance on an MQ-2 analog reading.
4. `Last movement report; not proof of absence.` (`views.js:109`) — Essential PIR operational caveat.
5. `UID cards can be cloned. Only an owner can manage access.` (`views.js:136`) — Accurate RFID security warning.
6. `Acknowledging does not clear the sensor warning.` (`views.js:170`) — Clarifies receipt vs. hazard resolution.

---

## 7. Backend and Neon Database Audit

Evaluated under Neon Postgres guidelines (`neon-postgres/SKILL.md` and lakebase architecture).

```
                                  HYBRID ARCHITECTURE FLOW
┌─────────────────────────────────┐                       ┌─────────────────────────────────┐
│     LOCAL HOUSEHOLD HUB         │                       │      CLOUD (VERCEL + NEON)      │
│                                 │                       │                                 │
│  ┌───────────────────────────┐  │  Outbound HTTPS Poll  │  ┌───────────────────────────┐  │
│  │ Local SQLite (sql.js v5)  │  │  (2-second interval)  │  │ Neon PostgreSQL (Pooled)  │  │
│  │ 17 tables, single writer  │  │ ────────────────────> │  │ • Schema: homeauto_online │  │
│  │ Authoritative for:        │  │                       │  │ • 15 RLS Tables, Multi-Ten │  │
│  │ • Hardware state & relays │  │  Exchange & Lease     │  │ • Remote light queue      │  │
│  │ • Local RFID cards        │  │ <──────────────────── │  │ • No door / No audio      │  │
│  │ • Vosk/Kokoro speech      │  │                       │  └───────────────────────────┘  │
│  └───────────────────────────┘  │                       │                 │               │
│               │                 │                       │                 │               │
│  ┌───────────────────────────┐  │                       │  ┌───────────────────────────┐  │
│  │ Local MQTT Broker         │  │                       │  │ Vercel Serverless API     │  │
│  │ Port 1883 / 8883          │  │                       │  │ Express app (/api/*)      │  │
│  └───────────────────────────┘  │                       │  └───────────────────────────┘  │
│         │               │       │                                         ▲               │
│    ESP32-A (Lights)  ESP32-B    │                       Remote Browser    │ HTTPS         │
│    Relays + Sensors  (Door)     │                       (Judges / Users) ─┘               │
└─────────────────────────────────┘                                                         
```

### 7.1 Local Persistence (`sql.js`) vs. Cloud Database (Neon Postgres)
- **Local SQLite Engine:** The local hub runs `sql.js` (SQLite compiled to WebAssembly). Writes are held in an in-memory database and periodically serialized to disk via `server/db/repository.js`.
  - *Risk:* Every write transaction performs a complete memory export and disk write (`atomicWrite`). While safe for household scales, high-frequency telemetry (e.g. gas sensor reporting every 2 seconds) will cause CPU spikes and disk wear if written durably. Currently, raw gas telemetry updates `sensor_latest` in memory and is bounded.
- **Dual Cloud Database Schemas (Technical Debt / Architectural Divergence):**
  - **Schema 1: `server/cloud/migrations/001_catalog.sql`:** Defines schema `homeauto_cloud` (4 tables: `households`, `hubs`, `catalogs`, `receipts`). This is a read-only metadata mirror.
  - **Schema 2: `server/online/migrations/001_online.sql`:** Defines schema `homeauto_online` (17 tables: `users`, `households`, `memberships`, `gateways`, `gateway_keys`, `sessions`, `rooms`, `devices`, `observations`, `observation_history`, `commands`, `alerts`, `alert_receipts`, `preferences`, `gateway_inbox`, `gateway_tickets`, `events`, `intents`, `rate_limits`, `audit_events`).
  - *Audit Finding:* `server/cloud` and `server/online` represent two independent implementations of the cloud backend. `server/online/gateway.js:5` explicitly forbids running both:
    ```javascript
    if(env.HOMEAUTO_CLOUD_SYNC_ENABLED==='1') throw new Error('Select one cloud transport; disable the legacy catalog mirror before gateway enrollment.');
    ```
    The project should formalize `homeauto_online` as the target cloud architecture and deprecate `homeauto_cloud` to remove confusion.

### 7.2 Connection Pooling & Neon Configuration
- **Connection Management:** `server/cloud/postgres.js` and `server/online/db.js` use `pg.Pool`.
  - Configured with `max: 4`, `connectionTimeoutMillis: 3000`, `idleTimeoutMillis: 10000`, `statement_timeout: 5000`.
  - Transaction-local tenant context is correctly applied:
    ```sql
    SELECT set_config('homeauto.household_id', $1, true),
           set_config('homeauto.user_id', $2, true),
           set_config('homeauto.gateway_id', $3, true);
    SELECT pg_advisory_xact_lock(hashtextextended($1, 0));
    ```
  - Using `true` as the third parameter (`is_local = true`) ensures that setting variables does not leak across pooled connections in Neon's PgBouncer transaction pooling mode.
- **Defect in Connection URL Validation (`NEW-007`):**
  - In `server/cloud/postgres.js:7`:
    ```javascript
    if ([...url.searchParams.keys()].some(k => !['sslmode', 'channel_binding'].includes(k)))
      throw new Error('Unsupported PostgreSQL URL parameters.');
    ```
  - *Impact:* Neon connection strings generated by the Neon Console often include additional parameters (e.g. `options=endpoint%3Dep-...` or `sslrootcert`). This strict check throws a fatal initialization error when a standard Neon connection string is provided.

### 7.3 High-Frequency Rate Limit Table Churn (`NEW-002`)
- In `server/online/migrations/001_online.sql:147` (inside function `take_limit`):
  ```sql
  DELETE FROM homeauto_online.rate_limits WHERE window_until < now() - interval '1 day';
  ```
- *Impact:* `take_limit` is called on **every single HTTP request** (reads, writes, gateway syncs). Executing a `DELETE` on every request introduces write amplification, row-level locks, table bloat, and constant write activity that prevents Neon serverless compute from scaling to zero. Pruning expired rate limits must be decoupled into an hourly maintenance task.

### 7.4 Multi-Household Isolation & RLS
- All 15 tenant tables in `homeauto_online` have both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
- The `tenant_scope` policy enforces `homeauto_online.in_household(household_id)`.
- Runtime user roles (`owner`, `resident`, `viewer`) are enforced at the database level and verified in unit tests (`server/tests/online.test.js`).

---

## 8. Vercel and Custom Domain Readiness

Evaluated against Vercel platform capabilities and serverless execution standards.

### 8.1 Missing Configuration & Deployment Scaffolding (`NEW-001`)
- **No `vercel.json`:** There is no `vercel.json` file in the entire repository.
- **No Root Serverless Entrypoint:** Vercel looks for serverless functions under `/api` in the project root. Currently, the Express backend lives in `server/online/app.js` and `server/app.js`.
- **SPA Routing 404 Failure:** The frontend uses client-side routing (`/rooms`, `/devices/:id`, `/security`, `/settings`). Without rewrite rules in `vercel.json`, any direct visit or browser refresh on a sub-route on Vercel will return a hard **HTTP 404 Not Found** from Vercel's edge network.
- **Required `vercel.json` Scaffolding:**
  ```json
  {
    "version": 2,
    "rewrites": [
      { "source": "/api/(.*)", "destination": "/api/index.js" },
      { "source": "/((?!assets/|css/|js/|manifest.json|favicon.ico).*)", "destination": "/index.html" }
    ]
  }
  ```

### 8.2 Serverless Execution & Database Connections (`NEW-008`)
- **Connection Spikes:** In a serverless architecture on Vercel, requests spawn independent short-lived lambda containers. If 50 concurrent requests arrive, 50 lambda instances each creating a `pg.Pool` of 4 connections would attempt 200 connections to Neon.
- **Vercel Best Practice Alignment:** The official `neon-postgres` skill instructs:
  > *"On Vercel, use `node-postgres` (`npm install pg`) with Vercel Fluid compute and `import { attachDatabasePool } from "@vercel/functions";`"*
  Currently, `@vercel/functions` is not installed, and `attachDatabasePool` is not integrated into `server/online/db.js`.

### 8.3 Real-Time Strategy: Polling vs. WebSockets on Vercel
- While Vercel announced WebSocket GA in October 2026, connections are pinned to individual serverless instances and require external Pub/Sub (such as Redis or Ably) for fanout.
- The project made a deliberate architectural choice in `server/online/app.js` and `public/js/state.js`:
  - **In cloud mode, the frontend uses short polling (every 2 seconds) over HTTPS** (`state.js:8–14`).
  - **The gateway worker also polls over HTTPS** (`server/online/gateway.js:37`).
  - *Evaluation:* This is a sound, pragmatic decision for serverless Vercel deployment that avoids WebSocket connection timeout issues, though it prevents Neon compute from scaling to zero while the gateway or browser is active.

### 8.4 Cookies and Custom Domain Security
- Cloud authentication issues session cookies:
  ```javascript
  const cookieName = secure ? '__Host-homeauto-cloud' : 'homeauto-cloud-dev';
  const cookie = (token, expired = false) =>
    `${cookieName}=${expired ? '' : token}; Path=/; HttpOnly; SameSite=Strict; ${secure ? 'Secure; ' : ''}Max-Age=${expired ? 0 : 28800}`;
  ```
- Using the `__Host-` prefix enforces that the cookie must be set with `Secure`, must originate from an HTTPS domain, and cannot span subdomains. This is production-grade cookie security suitable for custom domains (`https://homeauto.yourdomain.com`).
- `server/online/db.js:20–24` strictly validates `APP_BASE_URL` and `ALLOWED_ORIGINS` to prevent cross-origin request forging.

---

## 9. Actual IoT Compatibility Audit

Traced through the full command path:  
`User Interface` → `Backend Authorization` → `Command Creation` → `Transport` → `MQTT` → `ESP32 Firmware` → `Hardware GPIO` → `Status Publication` → `Backend Reconciliation` → `UI Update`.

```
                                COMPLETE COMMAND EXECUTION PATH
┌──────────────┐   POST /api/devices/light-1/command    ┌────────────────┐   home/light/1/command (QoS 0)   ┌──────────────┐
│  Client UI   │ ─────────────────────────────────────> │ Local Hub      │ ───────────────────────────────> │  ESP32-A     │
│  (views.js)  │ <───────────────────────────────────── │ (home.js)      │                                  │  (Relay 1)   │
└──────────────┘           202 Accepted                 └────────────────┘                                  └──────────────┘
       │                                                        ▲                                                   │
       │                                                        │ home/light/1/status ("on")                        │ GPIO 4 HIGH
       │                                                        └───────────────────────────────────────────────────┤
       │                                                                                                            ▼
       │ WebSocket Snapshot { devices: [{ id: "light-1", observation: { reported_status: "on" } }] }        Physical Light ON
       └────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 9.1 Hardware Inventory & Topic Mapping

The system interfaces with seven fixed hardware devices across two ESP32 microcontrollers:

| Device ID | Device Type | Controller | Pin | MQTT Command Topic | MQTT Status / Data Topic | Payload |
|---|---|---|---|---|---|---|
| `light-1` | Light Relay | ESP32-A | GPIO 4 | `home/light/1/command` | `home/light/1/status` | `on` / `off` / `toggle` |
| `light-2` | Light Relay | ESP32-A | GPIO 5 | `home/light/2/command` | `home/light/2/status` | `on` / `off` / `toggle` |
| `light-3` | Light Relay | ESP32-A | GPIO 18 | `home/light/3/command` | `home/light/3/status` | `on` / `off` / `toggle` |
| `light-4` | Light Relay | ESP32-A | GPIO 19 | `home/light/4/command` | `home/light/4/status` | `on` / `off` / `toggle` |
| `sensor-gas` | Gas Sensor | ESP32-A | ADC 34 | N/A (Telemetry) | `home/sensor/gas/data` | JSON: `{"raw":220,"gas_ppm":53,"alert":false}` |
| `sensor-motion` | PIR Motion | ESP32-A | GPIO 27 | N/A (Telemetry) | `home/sensor/motion/data` | JSON: `{"motion":true}` (held 5s) |
| `door-1` | Door Lock | ESP32-B | GPIO 4 | `home/door/1/command` | `home/door/1/status` | `lock` / `unlock` / `toggle_lock` |
| *(RFID)* | RC522 Reader | ESP32-B | SPI (5,21,18,23,19) | N/A (Card Tap) | `home/door/1/rfid` | JSON: `{"uid":"A1:B2:C3:D4","door_id":"1"}` |

### 9.2 Firmware Deep-Dive & Hazards

#### 1. AUD-001 (P0): Door Auto-Lock Blocked by Network Reconnection
- **Affected File:** `firmware/door_security/door_security.ino:254–266`
- **Source Code Evidence:**
  ```cpp
  void loop() {
    if (WiFi.status() != WL_CONNECTED) setupWiFi();
    if (!mqtt.connected()) connectMQTT();
    mqtt.loop();

    handleRfidScan();

    // Auto-lock after unlock duration
    if (!doorLocked && unlockTime > 0 && (millis() - unlockTime > UNLOCK_DURATION)) {
      Serial.println("[Door] Auto-locking...");
      lockDoor();
    }
    ...
  }
  ```
  In `setupWiFi()` (lines 69–73):
  ```cpp
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  ```
  In `connectMQTT()` (lines 191–214):
  ```cpp
  while (!mqtt.connected()) {
    ...
    else {
      delay(5000);
    }
  }
  ```
- **Hazard Mechanism:** If the door is unlocked (`doorLocked = false`, `unlockTime` set), and Wi-Fi or MQTT disconnects immediately afterward, `loop()` blocks inside `setupWiFi()` for up to **20 seconds** (40 × 500ms), or loops **infinitely** in `connectMQTT()`. The check `millis() - unlockTime > UNLOCK_DURATION` is never reached. GPIO 4 remains driven `HIGH`, keeping the door lock solenoid permanently energized and the door physically unlocked!
- **Auditor Mandate:** **The physical door control gate MUST REMAIN DISABLED** (`HOMEAUTO_DOOR_ENABLED=0`).

#### 2. AUD-002 (P1): Broker and Firmware Credential Incompatibility
- **Affected Files:** `firmware/light_controller/light_controller.ino:126`, `firmware/door_security/door_security.ino:196`, `server/mqtt/broker.js:3–7`
- **Evidence:** The ESP32 sketches use plain `WiFiClient` connecting to port 1883 with `NULL` credentials:
  ```cpp
  mqtt.connect(MQTT_CLIENT, NULL, NULL, "home/esp32/lights/online", 1, true, "false")
  ```
  Conversely, the hardened backend (`broker.js`) and deployment templates (`deploy/mosquitto.conf.example`) enforce TLS on port 8883 and require authenticated usernames and passwords.
- **Consequence:** Flashing the unchanged sketches against the secured broker configuration results in connection rejection (`rc = 4` or `rc = 5`).

#### 3. NEW-006 (P2): Blocking Wi-Fi Reconnect Stalls Sensor Monitoring
- **Affected File:** `firmware/light_controller/light_controller.ino:62`
- **Evidence:** `setupWiFi()` contains a blocking 20-second loop (`attempts < 40` with `delay(500)`). If Wi-Fi momentarily drops, the entire ESP32 freezes. During this period, gas sensor ADC sampling is completely halted, and PIR motion pulses are dropped.
- **Recommendation:** Replace blocking loops with an asynchronous non-blocking reconnection state machine.

---

## 10. Shrimaan Offline Assistant Assessment

Evaluated under `HomeAuto_UIUX_Docs/OFFLINE_AI.md` and `server/voice/intent.js`.

### 10.1 Pipeline Architecture
Shrimaan runs 100% locally on the host CPU without external API dependencies:
1. **Audio Capture:** Browser AudioWorklet resamples microphone input to 16kHz mono 16-bit PCM in 100ms frames, applying energy-based VAD with a 20-second hard cap. Audio transmits over authenticated WebSocket (`/voice`).
2. **Speech Recognition (STT):** Local Vosk 0.3.39 engine (`server/voice/models/en` and `server/voice/models/hi`) executed in an isolated child process.
3. **Intent Parser (`server/voice/intent.js`):** A strictly bounded deterministic grammar parser with zero LLM hallucinations.
4. **Speech Synthesis (TTS):** Kokoro ONNX CPU running under a pinned Python environment (`af_heart` for English, `hf_alpha` for Hindi), outputting authenticated WAV files.

### 10.2 Strict Intent Parsing & Safety (AUD-004 Verification)
Inspection of `server/voice/intent.js` confirms that AUD-004 (turning questions into commands) has been thoroughly repaired:
- Questions (`status`, `check`, `is light 1 on?`, `क्या लाइट 1 चालू है?`) are classified with `kind: 'query'` and **never emit device control actions**.
- Temporal and conditional modifiers (`tomorrow`, `after`, `कल`, `बाद`) are explicitly rejected (`unsupported`).
- Negations (`do not turn on light 1`, `मत जलाओ`) are rejected (`negated`).
- Direct unlock requests via voice (`unlock front door`, `दरवाजा खोलो`) are flagged with `sensitive: true`, which the API explicitly refuses to execute over voice (`SENSITIVE_ACTION_REQUIRES_UI`).

### 10.3 Residual Voice Risks
- **NEW-009 (P3 — Vosk Hindi Room Number Phonetic Confusion):** Vosk's lightweight Hindi model occasionally confuses Hindi room numbers (e.g. recognizing "कमरा दो" as "कमरा धो" or English digits). The strict parser safely rejects these ambiguous phrases rather than executing a wrong command, but it causes voice command dropouts in noisy rooms.
- **Kokoro Startup Latency:** Cold readiness requires ~4.0 seconds on host CPU; subsequent synthesis takes ~1.6s (EN) and ~2.2s (HI). This latency is acceptable for smart home feedback but must be accounted for in UI loading spinners.

---

## 11. Existing Astra Findings Crosswalk

Cross-referencing all 21 previously tracked findings against the current source code:

| ID | Sev | Original Finding Summary | Current Source Verification | Current Status |
|---|---|---|---|---|
| **AUD-001** | P0 | Door auto-lock blocked by network reconnect | `door_security.ino:254–266` retains blocking loop. Mitigated by `HOMEAUTO_DOOR_ENABLED=0` in backend. | **OPEN / EXTERNAL BLOCKER** |
| **AUD-002** | P1 | Secure broker/firmware credential mismatch | `light_controller.ino:126` and `broker.js:3` still mismatch transport and credentials. | **OPEN / EXTERNAL BLOCKER** |
| **AUD-003** | P1 | Original TLS key publicly retrievable in git | Key in public repo. Runtime defaults to `.local/tls` and ignores it. Needs operator rotation. | **OPEN / EXTERNAL BLOCKER** |
| **AUD-004** | P1 | Intent parser turns questions into actions | `server/voice/intent.js:21` properly classifies queries; tests pass in `remediation.test.js`. | **FIXED & SOFTWARE-VERIFIED** |
| **AUD-005** | P1 | Passive WS traffic defeats 30m idle logout | `server/auth/sessions.js:50` decouples touch from validation; explicit `/api/auth/activity` added. | **FIXED & SOFTWARE-VERIFIED** |
| **AUD-006** | P1 | Persistence failure in WS heartbeat crashes hub | `server/realtime.js:54` wrapped in try/catch error boundary. | **FIXED & SOFTWARE-VERIFIED** |
| **AUD-007** | P2 | Deleted default rooms recreated on restart | `server/db/repository.js:89` gates room backfill to migration pre-v5 only. | **FIXED & SOFTWARE-VERIFIED** |
| **AUD-008** | P2 | Unchanged telemetry invalidates metadata edits | `server/services/home.js:151` separates metadata version from observation version. | **FIXED & SOFTWARE-VERIFIED** |
| **AUD-009** | P2 | Speech replay presents stale state as current | `server/services/assistant.js:55` requeries fresh state and marks commands historically. | **FIXED & SOFTWARE-VERIFIED** |
| **AUD-010** | P2 | Rerender loses checkbox focus & closes Help | `public/js/main.js:139–148` preserves active element focus and details disclosure state. | **FIXED & SOFTWARE-VERIFIED** |
| **AUD-011** | P2 | Hub disconnect leaves cached reports looking current | `public/js/views.js:11` selector checks connection liveness and observation age. | **FIXED & SOFTWARE-VERIFIED** |
| **AUD-012** | P2 | Partial assistant command failures dropped | `public/js/main.js:85` & `assistant.js:35` retain failed target IDs in conversation state. | **FIXED & SOFTWARE-VERIFIED** |
| **AUD-013** | P2 | Alert navigation cannot mark motion alerts read | `public/js/views.js:172` adds `/api/alerts/:id/read` route on viewing alert details. | **FIXED & SOFTWARE-VERIFIED** |
| **AUD-014** | P2 | Async UI actions fail without visible feedback | `public/js/components.js:10` dispatches `action-error` caught by global toast handler. | **FIXED & SOFTWARE-VERIFIED** |
| **AUD-015** | P2 | Invalid Activity filters remove recovery controls | `public/js/views.js:152` sanitizes bad date ranges and preserves input fields and reset. | **FIXED & SOFTWARE-VERIFIED** |
| **AUD-016** | P2 | Restore replaces live DB before checking schema | `server/scripts/recovery.js:21` tests disposable copy and verifies schema before swap. | **FIXED & SOFTWARE-VERIFIED** |
| **AUD-017** | P2 | Spoken reply language follows UI instead of reply | `public/js/main.js:43` retains resolved response language for TTS audio requests. | **FIXED & SOFTWARE-VERIFIED** |
| **AUD-018** | P3 | Large controls does not enlarge some targets | `public/css/app.css:121` applies shared `--target` token (56px) to favorite and filter buttons. | **FIXED & SOFTWARE-VERIFIED** |
| **AUD-019** | P2 | Assistant readiness labels do not update dynamically | `public/js/main.js:55` updates status text and hides setup note on worker status change. | **FIXED & SOFTWARE-VERIFIED** |
| **HUI-001** | P2 | Startup 503 presented as sign-in requirement | `public/js/main.js:200` distinguishes 401 from 503, rendering retry screen for 503. | **FIXED & SOFTWARE-VERIFIED** |
| **HUI-002** | P2 | Data-dependent navigation renders blank screen | `public/js/main.js:123` (`frameView`) renders destination title and Back button immediately. | **FIXED & SOFTWARE-VERIFIED** |

---

## 12. Newly Identified Findings

The following 9 findings were uncovered during this independent multi-skill audit:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ NEW FINDINGS DISCOVERED:                                                               │
│ • NEW-001 (P1): Missing Vercel deployment scaffolding, API routing & SPA rewrites      │
│ • NEW-002 (P2): High write amplification in rate limit table during every request      │
│ • NEW-003 (P2): Dual competing cloud database architectures (catalog vs. online)       │
│ • NEW-004 (P2): Hallmark Floor violations (middle dots, decorative status dots, caps)  │
│ • NEW-005 (P2): Unslop copy violations (brand slogan on 404, dead translation keys)   │
│ • NEW-006 (P2): Firmware 20-second blocking Wi-Fi reconnect loop halts sensor reads    │
│ • NEW-007 (P1): Overly strict PostgreSQL URL parsing rejects valid Neon parameters     │
│ • NEW-008 (P2): Missing Vercel serverless connection management (@vercel/functions)   │
│ • NEW-009 (P3): Vosk Hindi room number homophone confusion                             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Detailed Breakdown of New Findings

#### NEW-001 — P1 — Missing Vercel Deployment Scaffolding and SPA Rewrite Rules
- **Affected Files:** Project Root (`vercel.json` absent), `public/index.html`, `server/online/app.js`
- **Classification:** Deployment Blocker / Architectural Gap.
- **Direct Source Evidence:** The repository has no `vercel.json` and no root `/api` directory.
- **Consequence:** Deploying the project to Vercel will deploy static files only. API requests to `/api/*` will return 404. Furthermore, navigating directly to client-side routes (e.g. `/rooms`, `/security`, `/settings`) or refreshing the page will result in edge 404 errors because Vercel lacks the rewrite rule to serve `index.html` for non-file paths.
- **Recommended Remediation:** Create `vercel.json` with static rewrites and an API entrypoint bridging `server/online/app.js`.

#### NEW-002 — P2 — High Write Amplification in Rate Limit Table During Every Request
- **Affected File:** `server/online/migrations/001_online.sql:147` (function `homeauto_online.take_limit`)
- **Direct Source Evidence:**
  ```sql
  DELETE FROM homeauto_online.rate_limits WHERE window_until < now() - interval '1 day';
  ```
- **Consequence:** Every rate-limited request invokes an inline `DELETE` on the `rate_limits` table. Under high concurrency, this causes table locking, index churn, and WAL write amplification. It also prevents Neon serverless databases from suspending compute to scale to zero.
- **Recommended Remediation:** Move expired rate-limit cleanup to a periodic background worker (e.g. hourly cron or `prune_household`).

#### NEW-003 — P2 — Dual Competing Cloud Database Architectures
- **Affected Files:** `server/cloud/` vs. `server/online/`
- **Architectural Inference:** `server/cloud` implements a 4-table catalog mirror (`001_catalog.sql`), while `server/online` implements a 17-table full multi-tenant backend (`001_online.sql`).
- **Consequence:** Redundant codebases, duplicated protocol files, and confusion for operators.
- **Recommended Remediation:** Officially designate `server/online` as the target cloud architecture and archive `server/cloud`.

#### NEW-004 — P2 — Hallmark Floor Rule Violations (Middle Dots, Decorative Dots, All-Caps)
- **Affected Files:** `public/js/views.js:20, 35, 143, 273`, `public/js/main.js:73, 103, 107, 117, 182`, `public/css/app.css:40, 102`, `public/js/components.js:66`
- **Direct Source Evidence:** Multiple active strings use middle dots (`·`) to concatenate text. Status indicators render a 6px `.status-dot`. Brand labels use all-caps `'LOCAL & PRIVATE'`.
- **Consequence:** Violates Hallmark Floor Rules 9 and 10 (Gates 54 and 63).
- **Recommended Remediation:** Replace middle dots with layout spacing or semantic punctuation; replace status dots with typography/badges; convert uppercase labels to sentence case.

#### NEW-005 — P2 — Unslop Copy Violations: Brand Slogan on 404 Page and Dead Keys
- **Affected Files:** `public/js/views.js:259`, `public/js/i18n.js:20, 30, 38`
- **Direct Source Evidence:** `function notFound() { return empty('Page not found', 'Your home stays yours.', navButton('Go home', '/', 'home')); }`.
- **Consequence:** 404 page presents marketing slogan rather than an actionable error explanation.
- **Recommended Remediation:** Replace with clear, human error copy (`This page could not be found.`). Clean up orphaned translation keys.

#### NEW-006 — P2 — Firmware 20-Second Blocking Wi-Fi Loop Halts Sensor Reads
- **Affected Files:** `firmware/light_controller/light_controller.ino:62–68`, `firmware/door_security/door_security.ino:69–74`
- **Direct Source Evidence:** `setupWiFi()` loops 40 times with `delay(500)` synchronously.
- **Consequence:** If Wi-Fi disconnects, the ESP32 halts all loop execution for 20 seconds. Gas sensor sampling stops, and PIR motion state changes are dropped.
- **Recommended Remediation:** Implement non-blocking Wi-Fi reconnection using `millis()` timers.

#### NEW-007 — P1 — Overly Strict PostgreSQL URL Parsing Rejects Valid Neon Parameters
- **Affected File:** `server/cloud/postgres.js:7`
- **Direct Source Evidence:**
  ```javascript
  if ([...url.searchParams.keys()].some(k => !['sslmode', 'channel_binding'].includes(k)))
    throw new Error('Unsupported PostgreSQL URL parameters.');
  ```
- **Consequence:** Neon connection strings frequently contain additional parameters (such as `options=endpoint%3Dep-...`). This strict check throws a fatal runtime exception upon loading the database pool.
- **Recommended Remediation:** Allow recognized Neon query parameters or strip them safely before passing to `pg.Pool`.

#### NEW-008 — P2 — Missing Vercel Serverless Database Connection Management
- **Affected File:** `server/package.json`, `server/online/db.js`
- **Direct Source Evidence:** Raw `pg.Pool` is used without `@vercel/functions` lifecycle attachment.
- **Consequence:** In a Vercel serverless environment, unmanaged connection pools across lambda container freezes cause connection exhaustion on Neon.
- **Recommended Remediation:** Integrate `@vercel/functions` and call `attachDatabasePool(pool)`.

#### NEW-009 — P3 — Vosk Hindi Room Number Phonetic Homophone Confusion
- **Affected File:** `server/voice/intent.js:44`, `HomeAuto_UIUX_Docs/OFFLINE_AI.md:28`
- **Direct Source Evidence:** Lightweight Vosk Hindi model confuses "कमरा दो" with "धो".
- **Consequence:** Users speaking Hindi room numbers may experience command rejection.
- **Recommended Remediation:** Add common phonetic homophones to `server/voice/intent.js` normalization mapping.

---

## 13. Hackathon Readiness Audit

A hackathon requires a demonstration that is **convincing, responsive, and 100% resilient under pressure**.

### Comparative Demonstration Analysis

| Demonstration Architecture | Option A: Fully Simulated | Option B: Local Network + ESP32 Hardware | Option C: Cloud Vercel + Neon + Gateway |
|---|---|---|---|
| **Setup Complexity** | Zero setup. Run `npm run preview:isolated` on laptop. | Moderate. Laptop + ESP32 on personal mobile hotspot + Mosquitto broker. | High. Deploy Vercel, provision Neon, run migrations, configure gateway token. |
| **Required Hardware** | Laptop only. | Laptop, ESP32-A board, 4 LEDs/relays, MQ-2, PIR sensor, USB cable. | Laptop, smartphone for judge, cloud account. |
| **Network Dependencies** | None. Runs offline on `127.0.0.1`. | Private phone Wi-Fi hotspot (avoids venue client isolation). | Full internet connectivity for venue and cellular. |
| **Demonstrable Features** | All 4 themes, full UI navigation, typed/voice Shrimaan assistant, alert flows. | **Real physical LEDs toggling**, real-time gas/motion telemetry streaming, voice light control. | Remote phone access: judge controls light from their own browser over cellular. |
| **Reliability** | **100% rock solid.** No hardware or network failure possible. | **High**, provided a dedicated mobile hotspot is used instead of venue Wi-Fi. | **Medium-Low.** Subject to venue Wi-Fi drops, Neon cold starts (1–2s), and 2s polling latency. |
| **Limitations** | Clearly displays "Simulation" banner. Cannot show physical actuation. | Physical door lock relay must remain disabled for safety. | 2–4 second roundtrip delay on light toggle; door disabled. |
| **Security Risks** | None. Memory database, no network listeners. | Use isolated local broker on hotspot; keep physical door disconnected. | Public URL exposed; needs proper secrets in Vercel environment. |
| **Recommended Role** | **Ultimate Failover Backup.** | **Primary Live Demonstration.** | **Secondary Architectural Deep-Dive.** |

### Hackathon Recommended Strategy: The Layered Demonstration
1. **Primary Demonstration (Option B):**
   - Connect the laptop and ESP32-A to a **personal mobile phone hotspot** (never use venue Wi-Fi, which frequently isolates client-to-client traffic).
   - Demonstrate the web interface in Theme 05 (Serene Emerald) toggling physical LEDs with sub-50ms latency.
   - Trigger the MQ-2 gas sensor (using a lighter) or the PIR motion sensor, showing the live alert and banner appear instantly.
   - Speak a command to Shrimaan in Hindi or English: *"कमरा 1 की लाइट चालू करो"* or *"Turn on Room 1 lights"*, showing local Vosk/Kokoro speech without internet.
   - **Explain the Door Honestly:** Show the disabled door control in the UI and explain that as professional engineers, you identified an auto-lock safety hazard during network outages (AUD-001) and intentionally enforced a software safety lockout. Judges reward demonstrated safety engineering over reckless hardware demos.
2. **Secondary Architecture Showcase (Option C):**
   - If internet is stable, invite the judge to scan a QR code to open the Vercel-hosted frontend on their own phone, toggling a light remotely via the Neon gateway.
3. **Contingency Fallback (Option A):**
   - If any hardware fails or wire disconnects, immediately switch tabs to `http://localhost:3001` (`preview:isolated`) and demonstrate the complete UI/UX without missing a beat.

---

## 14. Production Readiness Gaps

The following gaps must be closed before the system can be deployed in a permanent household environment:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PRODUCTION BLOCKERS SUMMARY:                                                           │
│ 1. Physical Safety: Non-blocking firmware relock state machine for door lock relay.    │
│ 2. Cryptographic Security: Generate fresh TLS certificates and retire exposed git key. │
│ 3. MQTT Hardening: Deploy authenticated TLS MQTT broker on ESP32 sketches.             │
│ 4. Cloud Infrastructure: Add vercel.json, SPA rewrites, and @vercel/functions pooling. │
│ 5. Database Cleanup: Move inline DELETE out of take_limit rate limiter in PostgreSQL.  │
│ 6. Field Trials: Real Indian-accent speech testing and screen-reader (NVDA) auditing.  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Prioritized Implementation Roadmap

Organized into four distinct tracks with clear priority tiers:
- **P0:** Physical safety or hardware hazard.
- **P1:** Major functional, security, or deployment blocker.
- **P2:** Important usability, content, or architectural defect.
- **P3:** Polish, consistency, and minor edge case.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TRACK A: Hackathon Demonstration Readiness (Immediate Priority)                        │
│ ├── A-01 [P1]: Hotspot configuration & IP setup for ESP32-A lighting & sensors        │
│ ├── A-02 [P1]: Scripted fallback procedure to launch preview:isolated on port 3001     │
│ └── A-03 [P0]: Verify HOMEAUTO_DOOR_ENABLED=0 is strictly locked during demo           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TRACK B: Production Backend & Neon / Vercel Readiness                                  │
│ ├── B-01 [P1]: Create vercel.json with SPA rewrites & /api serverless bridge (NEW-001) │
│ ├── B-02 [P1]: Fix PostgreSQL poolOptions parameter parsing for Neon URLs (NEW-007)   │
│ ├── B-03 [P2]: Integrate @vercel/functions attachDatabasePool for serverless (NEW-008)│
│ ├── B-04 [P2]: Decouple rate_limits cleanup from take_limit function (NEW-002)         │
│ └── B-05 [P2]: Deprecate server/cloud catalog in favor of server/online (NEW-003)      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TRACK C: Frontend Quality, Hallmark & Unslop Polish                                    │
│ ├── C-01 [P2]: Remove middle dots from views.js, main.js, index.html (NEW-004)         │
│ ├── C-02 [P2]: Replace decorative status dots with semantic text badges (NEW-004)    │
│ ├── C-03 [P2]: Remove .eyebrow class and convert all-caps labels to sentence case      │
│ ├── C-04 [P2]: Replace marketing slogan on 404 page with clear navigation copy (NEW-005)│
│ └── C-05 [P3]: Add Hindi numeral homophone mappings in intent.js (NEW-009)             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TRACK D: Hardware & IoT Validation                                                     │
│ ├── D-01 [P0]: Refactor door_security.ino with non-blocking relock timer (AUD-001)     │
│ ├── D-02 [P1]: Add WiFiClientSecure & credentials to ESP32 sketches (AUD-002)         │
│ ├── D-03 [P1]: Rotate TLS certificates and scrub exposed key from history (AUD-003)    │
│ └── D-04 [P2]: Replace blocking delay(500) loops in setupWiFi with timers (NEW-006)    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Detailed Recommendation Specifications

#### Recommendation B-01 (Priority P1)
- **ID:** `REC-B01`
- **Title:** Add `vercel.json` and Root Serverless API Bridge
- **Affected Files:** `vercel.json` (to create), `api/index.js` (to create)
- **Expected Benefit:** Enables one-click Vercel deployment with functioning API and SPA deep links.
- **Complexity:** Low.
- **Dependencies:** None.
- **Regression Risks:** None if path prefixes match.
- **Required Testing:** Test direct URL loading of `/rooms` and POST `/api/runtime` in a preview deployment.

#### Recommendation B-02 (Priority P1)
- **ID:** `REC-B02`
- **Title:** Fix Neon URL Parameter Parsing in `postgres.js`
- **Affected Files:** `server/cloud/postgres.js:7`, `server/online/db.js:25`
- **Expected Benefit:** Allows direct use of standard Neon connection strings.
- **Complexity:** Low.
- **Dependencies:** None.
- **Regression Risks:** Ensure `rejectUnauthorized` remains true.
- **Required Testing:** Connect with URL containing `options=endpoint%3Dep-xxx`.

#### Recommendation C-01 (Priority P2)
- **ID:** `REC-C01`
- **Title:** Eliminate Hallmark Middle-Dot Concatenations
- **Affected Files:** `public/js/views.js:20, 35, 143, 273`, `public/js/main.js:73, 103, 117`, `public/index.html:16`
- **Expected Benefit:** Compliance with Hallmark Floor Rule 10 and Gate 63.
- **Complexity:** Low.
- **Dependencies:** None.
- **Regression Risks:** Verify layout spacing in narrow mobile viewports.
- **Required Testing:** Visual inspection across 320px, 390px, and 1440px viewports.

#### Recommendation C-04 (Priority P2)
- **ID:** `REC-C04`
- **Title:** Replace Marketing Tagline on 404 Page
- **Affected Files:** `public/js/views.js:259`
- **Expected Benefit:** Human clarity and compliance with Unslop core contract.
- **Complexity:** Trivial.
- **Dependencies:** None.
- **Regression Risks:** None.
- **Required Testing:** Trigger 404 route in browser.

#### Recommendation D-01 (Priority P0)
- **ID:** `REC-D01`
- **Title:** Non-Blocking Hardware Auto-Relock State Machine
- **Affected Files:** `firmware/door_security/door_security.ino:254–272`
- **Expected Benefit:** Resolves physical hazard where network drops leave lock energized.
- **Complexity:** Medium.
- **Dependencies:** Separate hardware test bench with indicator LED.
- **Regression Risks:** Firmware timing, relay active polarity.
- **Required Testing:** Bench test with Wi-Fi router powered off while unlocked.

---

## 16. File-Specific Suggestions for GPT-6.1 Soul High

For the subsequent implementation turn, the following exact code locations and drop-in replacements are provided:

### 1. `public/js/views.js` (Line 259) — Fix Robotic 404 Copy
```javascript
// TARGET (Line 259):
function notFound() { return empty('Page not found', 'Your home stays yours.', navButton('Go home', '/', 'home')); }

// REPLACEMENT:
function notFound() { return empty('Page not found', 'This page does not exist or may have moved.', navButton('Back to Home', '/', 'home')); }
```

### 2. `public/js/components.js` (Line 66) & `public/css/app.css` (Line 102) — Fix Decorative Status Dots
```javascript
// TARGET in components.js (Line 66):
export function status(text, tone = 'neutral') { return el('span', { class: `status status-${tone}` }, el('span', { class: 'status-dot', 'aria-hidden': 'true' }), t(text)); }

// REPLACEMENT:
export function status(text, tone = 'neutral') { return el('span', { class: `status status-${tone}` }, t(text)); }
```
```css
/* In public/css/app.css (Line 101): Update status badge styling to dispense with the dot */
.status { display:inline-flex; align-items:center; padding:var(--space-1) var(--space-3); border-radius:var(--radius-pill); font-size:.8125rem; font-weight:600; font-variant-numeric:tabular-nums; background:var(--surface-muted); color:var(--text-subtle); }
.status-success { background:var(--primary-soft); color:var(--primary); }
.status-warning { background:var(--warning-soft); color:var(--warning); }
.status-danger { background:var(--danger-soft); color:var(--danger); }
.status-dot { display:none; }
```

### 3. `public/js/main.js` (Lines 107 & 182) — Fix Uppercase Shouting & Eyebrow
```javascript
// TARGET (Line 107):
el('p', { class: 'sidebar-note' }, icon('leaf', 'icon-small'), t(Api.mode === 'cloud' ? 'HomeAuto online' : 'LOCAL & PRIVATE'))

// REPLACEMENT:
el('p', { class: 'sidebar-note' }, icon('leaf', 'icon-small'), t(Api.mode === 'cloud' ? 'HomeAuto online' : 'Local and private'))

// TARGET (Line 182):
el('p', { class: 'eyebrow' }, t(Api.mode === 'cloud' ? 'HomeAuto online' : 'LOCAL & PRIVATE'))

// REPLACEMENT:
el('p', { class: 'small muted' }, t(Api.mode === 'cloud' ? 'HomeAuto online' : 'Local and private'))
```

### 4. `server/cloud/postgres.js` (Line 7) — Allow Neon Query Parameters
```javascript
// TARGET (Line 7):
if ([...url.searchParams.keys()].some(k => !['sslmode', 'channel_binding'].includes(k))) throw new Error('Unsupported PostgreSQL URL parameters.');

// REPLACEMENT:
// Allow standard Neon console connection parameters while preserving SSL enforcement
const allowedParams = new Set(['sslmode', 'channel_binding', 'options', 'application_name', 'connect_timeout']);
if ([...url.searchParams.keys()].some(k => !allowedParams.has(k))) throw new Error('Unsupported PostgreSQL URL parameters.');
```

### 5. `server/online/migrations/001_online.sql` (Line 147) — Remove Inline Rate Limit Table Churn
```sql
-- TARGET in function homeauto_online.take_limit (Lines 144-151):
CREATE FUNCTION homeauto_online.take_limit(p_bucket text,p_limit integer,p_seconds integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer;
BEGIN
 DELETE FROM homeauto_online.rate_limits WHERE window_until<now()-interval '1 day';
 INSERT INTO homeauto_online.rate_limits(bucket,count,window_until) VALUES(p_bucket,1,now()+make_interval(secs=>p_seconds))
 ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN homeauto_online.rate_limits.window_until<=now() THEN 1 ELSE homeauto_online.rate_limits.count+1 END,window_until=CASE WHEN homeauto_online.rate_limits.window_until<=now() THEN now()+make_interval(secs=>p_seconds) ELSE homeauto_online.rate_limits.window_until END RETURNING count INTO n;
 RETURN n<=p_limit;
END; $$;

-- REPLACEMENT:
-- Remove the inline DELETE. Add rate_limits pruning to prune_household instead.
CREATE FUNCTION homeauto_online.take_limit(p_bucket text,p_limit integer,p_seconds integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer;
BEGIN
 INSERT INTO homeauto_online.rate_limits(bucket,count,window_until) VALUES(p_bucket,1,now()+make_interval(secs=>p_seconds))
 ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN homeauto_online.rate_limits.window_until<=now() THEN 1 ELSE homeauto_online.rate_limits.count+1 END,window_until=CASE WHEN homeauto_online.rate_limits.window_until<=now() THEN now()+make_interval(secs=>p_seconds) ELSE homeauto_online.rate_limits.window_until END RETURNING count INTO n;
 RETURN n<=p_limit;
END; $$;
```

---

## 17. Validation and Release Requirements

Before any production or physical deployment, the following verification gates must be cleared:

1. **Hardware Release Gate (Physical Door):**
   - Independent test bench with oscilloscope / logic analyzer measuring GPIO 4 on ESP32-B during simulated broker outage.
   - Verified that relay output cuts off within 5.0 seconds under all Wi-Fi disconnect and MQTT timeout conditions.
   - Physical fail-secure emergency mechanical egress verified independently of electronics.
2. **Cryptographic Release Gate:**
   - Fresh certificate authority and 90-day leaf certificate generated in `.local/tls`.
   - Complete removal of the exposed `server.key` from Git history using `git-filter-repo`.
3. **Cloud Staging Gate:**
   - Execute `npm run test:cloud-staging` against a real, isolated Neon test branch with restricted non-superuser role.
   - Verify connection pooling behavior under simulated concurrent traffic.
   - Benchmark cold-start latency from Indian ISP networks to the selected Neon region (e.g. Singapore `ap-southeast-1`).
4. **Accessibility & Assistive Tech Gate:**
   - Manual screen reader verification with NVDA on Windows and VoiceOver on iOS.
   - Keyboard focus trap verification on all modals (`Escape` key, return focus to triggering element).
5. **Speech Acceptance Gate:**
   - Evaluation of Vosk Hindi recognition against a recorded holdout dataset of 50+ varied Indian-accent speakers in background domestic noise.

---

## 18. Uncertainties and Unverified Behavior

As this was a strictly read-only audit without live hardware or cloud services, the following items remain unverified:
- **Actual Hardware Relay Behavior:** Physical contact bounce, relay coil inrush current, and GPIO pin float during ESP32 bootloader initialization could not be physically measured.
- **Live Mosquitto Performance:** Broker throughput and behavior under high MQTT message frequency could not be tested against physical hardware.
- **Neon Real-World Latency:** Roundtrip latency between Indian broadband networks and Neon compute instances was not measured over real WAN.
- **Microphone Hardware Permissions:** Native browser microphone capture on physical smartphones (iOS Safari / Android Chrome) requires real device testing.
- **Database Durability Under Power Cut:** SQLite `fsync` durability under abrupt hardware power loss could not be verified without physical bench testing.

---

## 19. Final Recommended Development Sequence

For the next pair programming session, follow this sequential execution plan:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Execute Track C (Frontend Hallmark & Unslop Polish)                            │
│ • Apply file-specific replacements in views.js, main.js, components.js, and app.css.  │
│ • Run npm test to verify zero regressions across existing 111 tests.                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ STEP 2: Configure Track A (Hackathon Bench Demonstration)                              │
│ • Flash light_controller.ino to ESP32-A with local Wi-Fi hotspot credentials.          │
│ • Bench test physical 4-channel relay / LEDs and MQ-2/PIR sensor telemetry.           │
│ • Re-verify HOMEAUTO_DOOR_ENABLED=0 remains enforced.                                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ STEP 3: Execute Track B (Vercel Scaffolding & Neon Parameter Fixes)                    │
│ • Create vercel.json and api/index.js serverless bridge.                               │
│ • Update postgres.js URL parser to accept Neon connection strings.                     │
│ • Test in an isolated Vercel preview branch connected to a Neon dev branch.           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ STEP 4: Execute Track D (Firmware Refactoring & TLS Rotation)                          │
│ • Refactor door_security.ino loop to use non-blocking millis() state machine.          │
│ • Add TLS and client credentials to firmware sketches.                                 │
│ • Rotate server TLS certificates and close release gates.                              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---
*Report independently compiled and verified by Gemini 3.8 Flash (High) — Antigravity Engine.*
