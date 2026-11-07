# Hallmark for HomeAuto — Audit Integration Guide

> **Document type:** auditor's reference / implementation-free UI/UX assessment protocol  
> **Prepared:** 2026-11-06  
> **Target:** HomeAuto 2.x, local workspace (Astra previously reported `D:\homeauto-main`)  
> **Source skill:** [Nutlope/hallmark](https://github.com/nutlope/hallmark) (reviewed v2.0.0 source on `main`)  
> **Use:** Astra's next *read-only* assessment. **This is not an instruction to redesign or modify the application.**

## 1. What Hallmark is — and is not

Hallmark is an agent design skill for Claude Code, Codex, Cursor, and OpenCode. It provides a design-quality contract, static and optional rendered checks, and explicit modes for builds, redesigns, and audits. Unlike *Unslop*, which primarily checks and improves prose, **Hallmark can evaluate a working interface's visual system and browser rendering**. It does not, by itself, establish hardware correctness, security, or authentic device state.

**Authoritative references (read the actual local skill when available):**

- [README](https://github.com/nutlope/hallmark/blob/main/README.md)
- [Skill entrypoint](https://github.com/nutlope/hallmark/blob/main/skills/hallmark/SKILL.md)
- [Audit/redesign protocol](https://github.com/nutlope/hallmark/blob/main/skills/hallmark/references/redesign.md)
- [App-screen exceptions](https://github.com/nutlope/hallmark/blob/main/skills/hallmark/references/flow.md)
- [Gate definitions](https://github.com/nutlope/hallmark/blob/main/skills/hallmark/references/gates.md)
- [Interaction and states](https://github.com/nutlope/hallmark/blob/main/skills/hallmark/references/interaction-and-states.md)
- [Sloplint script](https://github.com/nutlope/hallmark/blob/main/skills/hallmark/scripts/sloplint.mjs)

Hallmark documents `audit <target>` as **report-only**: inspect the existing UI and screenshots, classify findings and recommend the lightest appropriate repair. `redesign <target>` is a separate, change-producing command; **do not invoke redesign, scaffold, build, or automatic fixing in Astra**. The v2 README specifies `--scope app` for app interfaces and states that app screens skip marketing-hero, fold, word-budget and section-shape rules. Hallmark's project-specific preflight honors an existing `design.md` and product brand; its catalog of 50 themes is **not an invitation to replace HomeAuto's four approved themes**.

### Compatibility with the existing HomeAuto visual contract

The user's already approved themes supersede aesthetic theme suggestions from Hallmark:

| ID | Approved name | Role | Audit requirement |
|---|---|---|---|
| `05` | Serene Emerald | **Default** | Correct first-load rendering, token integrity, contrast, preference persistence |
| `01` | Warm Organic | Alternative | Correct cream/green theme identity, no arbitrary borrowed palette |
| `03` | Universal Comfort | Alternative | Senior-friendly readability, enlarged touch targets, states, contrast |
| `04` | Friendly Pastel | Alternative | Soft blue/pastel treatment, readable status/action contrast |

Themes should share functional layout and interaction semantics. An auditor may recommend a change when a theme fails contrast, legibility, or consistency, but must **not** suggest switching to a random Hallmark catalog theme, or copying Apple, Google Home or Mi Home visual identity.

## 2. Hallmark's evaluation vocabulary

| Tier | Actual Hallmark meaning | How to report it in HomeAuto |
|---|---|---|
| **Floor** | Hallmark's non-waivable quality floor for its own builds (tokens, contrast, visible focus, reduced motion, functional correctness, responsive rendering, noninvented facts) | Report a verified breach with gate ID, screenshot/source evidence and impact; do not change production code |
| **Reflex** | A common generated-looking design pattern; may be defensible in context | Mark contextual concern, applicable/protected exception, and the least disruptive improvement |
| **Finish** | Craft and fine polish checks; not automatically release blockers | Record optional improvement without equating taste with a defect |

**Do not mistake a Hallmark FAIL for proof of a HomeAuto regression or a safety exploit.** The skill's rules are stringent, and some (e.g., its CSS stamp requirement or stylistic bans) concern Hallmark-produced builds more than pre-existing apps. Determine applicability before severity. For security or IoT severity, use the existing `AUD-###` evidence process instead of converting the Hallmark gate labels directly into `P0` issues.

### Particularly relevant gates and app-review requirements

| Area | Hallmark source / gate | HomeAuto application |
|---|---|---|
| Contrast and text on surfaces | Floor **40/41** | Device states, unread alerts, error text, light/pastel surfaces, all themes |
| Focus and keyboard access | Floor **26a** | Back, Home, light controls, favorites, cards, RFID, filters, dialogs |
| Reduced motion / visibility | Floor **27/62** | Microphone feedback, transitions, skeletons, content visible if scripts fail |
| Token integrity | Floor **48**, spacing **24a** | No arbitrary accents/fonts; preserve the four semantic palettes |
| Overflow / small widths | Floor **34/50** | 320, 375/390, 768, 1440; card and navigation reflow |
| Form and disabled states | Floor **39a**, states reference | Login, RFID forms, preferences, confirmations, Activity filters |
| Touch/focus target | Interaction reference: **44px minimum** | HomeAuto's own primary-target preference is **48px normal / 56px large**; honor stricter project design |
| Generated-style tells | Reflex gates (repetitive cards, glow, default gradients, odd spacing) | Flag only when reducing clarity or making the app feel generic; do not remove deliberate branded design |
| App-specific state model | `flow.md` **App screens** | **Loading, empty, error, full** for data regions; status/uncertain/disconnected for hardware |
| URL state | `flow.md` **App screens** | Filters, tabs, detail URLs, browser back/forward, nested refresh |
| Component state model | `interaction-and-states.md` | Default, hover, focus, active, disabled, loading, error, success where meaningful |
| Real-data honesty | Floor **46a**, app notes | Never invent active devices, gas PPM accuracy, door physical-lock verification or model availability |

### Scope and exceptions matter

HomeAuto is a **stateful application**. Use `--scope app`. Do not issue false findings because there is no marketing hero, photo gallery, sign-up banner, or 80-word screen limit. Also do not enforce Hallmark's suggested 32–40px visual control height if HomeAuto's audience and approved design require larger targets. Distinguish **visible control dimensions** from **interactive hit area**. The project's accessibility and device-safety contracts outrank aesthetic preferences.

## 3. Safe use of the actual Hallmark audit mode

### 3.1 Discovery and verification

1. Locate the HomeAuto workspace and its `design.md`, theme token files, active UI entrypoint, routing, components, translations, and tests. Use local code as the current implementation source of truth.
2. Locate an already installed Hallmark skill (e.g., Codex `~/.agents/skills/hallmark` or an accessible checked-out copy). Read `SKILL.md`, `references/redesign.md`, `references/flow.md` (**App screens**), `references/gates.md` and `references/interaction-and-states.md`.
3. If not installed, obtain its source read-only or use a disposable downloaded copy **outside the protected HomeAuto workspace**. Do not run `npx skills add` unless the user explicitly approves installing a tool; do not alter `AGENTS.md`, hooks, package manifests, lockfiles, dependencies, or source as part of an audit.
4. Log the skill commit/version and invocation method. If only the static analyzer is available, report `render not performed`, not a visual pass.

### 3.2 Example commands, only when the environment is safely isolated

Hallmark's script supports `--scope app`, `--render`, `--url`, `--before`, `--json` and `--help`. These commands are **examples for Astra to adapt after reading the script and checking side effects**; they are not automatically approved against the live project:

```bash
# Display supported flags without touching the app:
node /path/to/hallmark/skills/hallmark/scripts/sloplint.mjs --help

# Static assessment of an isolated copy of the active UI:
node /path/to/hallmark/skills/hallmark/scripts/sloplint.mjs /isolated/homeauto/public --scope app --json

# Rendered assessment ONLY against a fully mocked/isolated dev server:
node /path/to/hallmark/skills/hallmark/scripts/sloplint.mjs /isolated/homeauto/public --scope app --render --before --url http://127.0.0.1:<mock-port>/
```

The actual script **writes records** such as `.hallmark/before.json`, `.hallmark/before.txt` and screenshots when `--before`/`--render` is used. Run it in a disposable copy or dedicated temporary audit workspace, not the protected production tree. Its rendered checks use Chrome plus `puppeteer-core` when available. Do not install browser packages into HomeAuto or silently start/stop live services. Inspect the exact command and path effects before executing. If the route requires authentication or backend data, provide **mocked and intercepted** data; never use a real broker, home control API, production DB, microphone, RFID reader or physical device. If the isolation cannot be proved, perform source-based audit only.

**Do not run** `/hallmark redesign`, `theme.mjs scaffold`, `sloplint --kept` as a replacement workflow, install hooks, formatters, or scripts that modify application files. `--kept` is designed to compare a redesign against a baseline; Astra is not producing a redesign. `.hallmark/` output in a disposable copy is evidence only, not application code.

## 4. What Astra should inspect on HomeAuto

### Functional screen coverage

1. **Home:** My Home/brand link, quick actions, favorite controls, home status, lights, entrance door, sensor and alert summaries, navigation.
2. **Rooms and Devices:** room lists and nested details, device cards, on/off, pending/uncertain states, favorites, metadata edits, room CRUD, unsupported features correctly absent.
3. **Security:** front door lock/unlock state and confirmation, gas/motion alerts, alert detail/read/ack, RFID cards, access history and safe return paths.
4. **Assistant:** microphone Start/Stop, permission, typed command, intent review, transcription, local voice model readiness, reply language, playback/replay, offline fallback and safety messaging.
5. **Settings:** all four themes, theme-05 first-load default, larger controls/text, language, privacy, notification preferences, advanced diagnostics, Help disclosures.
6. **Activity and secondary views:** filtering, invalid-URL recovery, empty/loading/error states, date ranges, accessible navigation, detail dialogs, status messaging.

### Interaction paths (sample scenarios)

- Home → Rooms → Room → Device → Back → Room → Back → Rooms; browser Back/Forward.
- Security → alert detail → mark read independently from acknowledgment; return using contextual Back.
- Settings → My Home always goes Home; nested route survives refresh.
- Theme change on any page → navigation → reload and theme still applied; no flash of incorrect theme.
- Toggle Large controls / Large text using keyboard → focus remains on logical control; state persists.
- Expand Help item → mocked sensor snapshot → disclosure stays open and reading focus survives.
- Disconnect mocked WebSocket after a door report → per-device status becomes last-known/unverified, not physically confirmed.
- Assistant Auto reply receives Hindi response while UI English → spoken language consistent with resolved response.
- Microphone readiness changes missing→ready→failed → badge, instructions and button agree; no automatic mic capture.
- Activity URL `?from=bad` or reversed dates → visible editable filters and reset path, no retry trap.
- Acknowledge simulated alert with API 503 → visible error, safe retry, no unhandled rejection.
- Mixed group command with one simulated failure → display and speech reflect both success and failure, without duplicate publishing.

### Render/a11y matrix (extend the existing audit)

| Dimensions | Required |
|---|---|
| Themes | 05 (default), 01, 03, 04 |
| Primary screens | Home, Rooms, Security, Assistant, Settings |
| Widths | 320, 390, 768, 1440px; add actual phone browser only when safe |
| States | Loading, empty, full, error; disabled, pending, stale, disconnected when applicable |
| Inputs | Keyboard, focus-visible, screen-reader labels, touch targets, scroll/zoom, reduced-motion |
| Localization | English, Hindi (including font fallback), long translated labels |
| Mobile | Browser history, Back control, bottom-bar safe-area, no clipped dialogs or hidden controls |

Prior audit reported 108 intercepted rendered/axe cases without static violations; those checks do **not** invalidate its demonstrated focus, Help reset, stale-state or async-handler bugs. Cite the prior evidence and retest changed code where applicable, rather than claiming screenshots prove end-to-end IoT behavior.

## 5. Use the existing Astra audit as the baseline (not as an assumed current truth)

The uploaded 2026-11-06 Astra reports state **19 confirmed findings** (1 P0, 5 P1, 12 P2, 1 P3), based on its then-current local workspace. The following crosswalk is a starting point; reverify against current source before reclassifying status.

| Prior finding(s) | Hallmark audit connection | Verification target |
|---|---|---|
| **AUD-010** | Accessibility, focus, content stability | Keyboard checkbox and Help disclosure survive unrelated rerenders |
| **AUD-011** | Honest status language / states | Disconnected hub cannot display fresh-looking cached lock reports |
| **AUD-012** | Complete result feedback | Mixed multi-device command retains per-target failures; speech agrees |
| **AUD-013** | Navigation / affordance / accessibility | Motion and gas alert read paths; updated bell label |
| **AUD-014** | Interaction error state | Async failures produce visible feedback and no unhandled rejection |
| **AUD-015** | URL state, recoverability | Invalid Activity filters are editable/resettable |
| **AUD-017** | Voice and UI consistency | Auto reply language follows resolved response |
| **AUD-018** | Component consistency | Large-controls setting enlarges favorite/filter targets as designed |
| **AUD-019** | Loading/readiness state | Assistant mic, readiness label and help text update together |
| **AUD-004** | Dangerous affordance / spoken intent UX | Status questions never silently become actuator commands; backend remains authoritative |
| **AUD-001/002/003/005/006/007/008/009/016** | Outside Hallmark's main visual remit; cross-references only | Keep security/firmware/backend findings unchanged unless separately proven; no physical tests |

Do not fabricate fresh fixes or reopen resolved findings without evidence. Maintain `AUD-###` IDs as historical references; new Hallmark items can use `HUI-###`. Every item should include **confirmed/reproduced, source-derived, context-dependent, or not tested** and identify overlap or contradiction with `AUD-###`. Never turn a Hallmark theme preference into a P0/P1 hardware issue.

## 6. Audit scoring and evidence discipline

### Separate four dimensions

1. **Mechanical Hallmark gates:** counts by Floor/Reflex/Finish, gate ID, raw result, and explicitly protected false positives/app exceptions.
2. **Browser-visible UX defects:** reproducible action, screenshot/DOM state, expected vs actual, accessibility effect, interaction regression.
3. **Consumer usability judgments:** elderly/nontechnical comprehensibility; careful label clarity, discoverability, large touch targets, error recovery. Label as expert heuristic unless tested with real people.
4. **IoT/voice safety cross-check:** ensure findings do not recommend bypassing auth, command confirmation, sensor truth, microphone consent, offline operation or hardware gating.

### Each finding must include

- ID; title; severity or priority with justification; Hallmark tier/gate if applicable.
- Screen, theme, viewport and interaction state.
- File path and line numbers (where verified), route, selector/control.
- Evidence method: static, rendered, intercepted mocked browser, or human heuristic.
- Exact reproduction steps / screenshot path when available.
- Expected and observed behavior, user impact, senior/nontechnical impact.
- Smallest recommended correction **without implementing it**.
- Cross-reference to old `AUD-###` if relevant; confidence/unknowns.
- Explicit regression/IoT safety risk and isolated verification strategy.

### Audit outputs (create reports only)

Preferred folder inside the local project, if writing documentation is allowed: `docs/audit/hallmark/`.

- `HALLMARK_AUDIT_SUMMARY.md` — scope, version, app exceptions, verdict, counts, verified baseline and limitations.
- `HALLMARK_GATE_MATRIX.md` — per-screen/theme/viewport gates; raw findings vs confirmed issues, waivers/protected cases (for reporting only).
- `SCREEN_AND_INTERACTION_AUDIT.md` — navigation, controls, four states, a11y, old-age/nontech heuristics, illustrated evidence references.
- `FINDINGS.md` — individually evidenced HUI-### items and crosswalk to AUD-###.
- `REMEDIATION_RECOMMENDATIONS.md` — priority, affected files, least disruptive change proposal, safe tests, implementation owner; **no edits**.
- `ASTRA_TO_SOUL_HANDOFF.md` — read-only independent review; exact audit limits; verification instructions for the future coding model; never a claim that implementation is done.

Do not alter prior six Astra reports, `plan.md`, `design.md`, `context.md`, `TASKS.md`, app source, configs, `server/`, `firmware/`, dependency files, certificates or databases. If the two prior missing artifacts `docs/audit/FIX_PRIORITY.md` and `docs/audit/HANDOFF_TO_SOUL.md` now exist, read them; if not, do not invent their contents. Documentation may summarize them only after actual inspection.

## 7. Physical-device safety and offline boundaries

**No application or live-device changes** during Hallmark work. Do not publish MQTT messages, toggle relays, open/lock doors, perform RFID scans, record microphone input, run production DB migrations, start the live hub, touch LAN credentials or flash firmware. Do not initiate browser checks against a live home instance where loading or scripts could invoke actions. An isolated mocked preview must intercept/block **all** command, HTTP, WebSocket, microphone, speech, and broker access. Do not change the deliberate disabled-door default. Keep the existing *hardware relay/controller report is not proof of physical lock position* distinction.

Protect localization and offline behavior: never propose an online-only icon/font, new external AI service, hosted recognition, remote analytics script, or external asset required at runtime. Hallmark's photography and catalog themes are **not required** to audit the existing HomeAuto app; external assets may violate offline operation.

## 8. Completion checklist for Astra

- [ ] Correct local project, version, and last reviewed state identified.
- [ ] Hallmark v2 `SKILL.md`, `redesign.md`, `flow.md` app scope, gates and states read.
- [ ] Audit-only behavior respected; no redesign/build operation invoked.
- [ ] Four existing themes audited without replacement or theme dealing.
- [ ] All primary and relevant secondary screens considered; coverage gaps stated.
- [ ] Mechanical sloplint results separated from human/app-context judgments.
- [ ] Navigation, accessibility, persistence, async errors and voice feedback reviewed.
- [ ] Old Astra `AUD-###` findings reconciled rather than duplicated as new defects.
- [ ] Physical I/O and all operational changes avoided.
- [ ] Audit report files are the only durable changes in HomeAuto; temporary runner outputs isolated.
- [ ] A clear implementation handoff is ready, while the source tree remains unchanged.

---

**Summary decision:** Use Hallmark's **`audit`** protocol and **`--scope app`** checks as an additional layer on top of Astra's existing QA. Its useful contribution is better visual and interaction scrutiny, not a new design theme, code changes, or a substitute for IoT safety evidence.
