# Astra — Resume Independent HomeAuto Audit with Hallmark v2

You are continuing the **independent, read-only HomeAuto audit**, not resuming coding and not starting a redesign. The previous Astra assessment (dated 2026-11-06) covered the local HomeAuto 2.0.0 code and reported **19 findings: 1 P0, 5 P1, 12 P2, 1 P3**. The user now wants an additional **Hallmark v2 UI/UX audit layer**, while preserving all prior findings and keeping the live IoT system untouched.

**Your responsibility is to understand and apply Hallmark's *audit-only* workflow, identify genuinely additional or still-valid frontend/interaction defects, and create Markdown reports for GPT-6.1 Soul High to evaluate later. You must not write or modify application code.**

## 1. Read the existing evidence before proceeding

Inspect the current local workspace and its documentation. Start with:

- `docs/DEVELOPMENT_STATE.md`, `TASKS.md`, `context.md`, `plan.md`, `design.md` and actual source code, where present.
- Existing Astra audit reports: `AUDIT_SUMMARY.md`, `BUG_REPORT.md`, `IOT_COMPATIBILITY.md`, `UI_UX_AUDIT.md`, `AI_VOICE_AUDIT.md`, `SECURITY_AUDIT.md` in `docs/audit/` or their actual locations.
- If present, `docs/audit/FIX_PRIORITY.md` and `docs/audit/HANDOFF_TO_SOUL.md`; these were referenced by the previous report but not supplied in the user-uploaded set. If missing, note that fact without inventing their contents.
- **`HALLMARK_HOMEAUTO_AUDIT.md`**, the new companion guide the user has supplied. It maps Hallmark's source instructions to HomeAuto's requirements and existing audit findings.

Do not assume the previous audit matches the current working tree. Record dates, file versions or hashes where practical. Distinguish inherited, newly introduced, fixed, regressed, untested, and not-applicable issues. Preserve the original `AUD-###` IDs for historical findings; assign `HUI-###` IDs only to genuinely distinct Hallmark discoveries.

## 2. Read and correctly invoke Hallmark

Source: https://github.com/nutlope/hallmark

Read the actual Hallmark skill documents, preferably from an existing local installation or a disposable read-only source copy:

- `skills/hallmark/SKILL.md`
- `skills/hallmark/references/redesign.md`
- `skills/hallmark/references/flow.md` — especially **App screens**
- `skills/hallmark/references/gates.md`
- `skills/hallmark/references/interaction-and-states.md`
- `skills/hallmark/scripts/sloplint.mjs` flags and output behavior

Hallmark has an explicit `audit <target>` report-only mode. **Do not invoke `redesign`, `scaffold`, a theme deal, a build flow, or any automatic fixer.** For current HomeAuto, use Hallmark's **`--scope app`** rather than its marketing-page scope: dashboards, Rooms, Security, Assistant, Activity and Settings are stateful app screens. Marketing hero, photograph, CTA, 80-word, and section-count rules are not appropriate acceptance criteria here.

Its **Floor / Reflex / Finish** gate tiers are diagnostic metadata. Interpret results in context: verify a finding before claiming a HomeAuto defect, preserve domain-valid copy and documented design choices, and identify false positives or protected cases.

Do not install packages, global skills, hooks, or browsers without permission. If Hallmark is not available locally, read the GitHub source and perform a manual Hallmark-grounded audit. If a linter can run, note that `--before` and `--render` write `.hallmark` records/screenshots: run these only in a **disposable, isolated audit copy** and keep their outputs away from the protected working tree. Do not connect to the real home or start its real backend. Never claim rendered validation if only static scanning was possible.

## 3. Honor the approved HomeAuto design

The project is a fully local smart-home app intended for elderly, middle-aged and nontechnical users, and for English/Hindi/Hinglish household use. The design should be approachable, accessible, and predictable, informed by consumer-app UX (including iOS-style navigation) without copying other brands.

**Four immutable theme choices:**

- **05 Serene Emerald — default**
- **01 Warm Organic**
- **03 Universal Comfort**
- **04 Friendly Pastel**

Do not introduce Hallmark's 50 catalog themes or replace these four. Check exact token usage, coherent colors, control hierarchy, contrast, typography, reduced motion, correct theme persistence, and theme-03 large-control behavior. Compare with the actual saved design documentation and original approved reference images, not general taste.

Do not demand marketing hero sections, invented decorative photos, new icons, online fonts, or expensive animation. Preserve offline runtime behavior.

## 4. Run a comprehensive, auditable frontend review

Cover all primary screens and significant secondary routes: Home, Rooms, room details, all supported device detail types, Security, alerts, RFID, Activity, Shrimaan Assistant, Settings, Help, and Advanced/Local AI configuration.

For each screen inspect:

1. Visual system: layout, hierarchy, typography, spacing, contrast, card nesting, icon consistency, token discipline and theme identity.
2. Functional controls: every button/link/form field has a real purpose and correct destination/handler; all relevant default/hover/focus/active/disabled/loading/error/success states exist.
3. App data states: loading, empty, error, full, stale, pending, and disconnected where applicable.
4. Accessibility: focus order, `:focus-visible`, keyboard retention during live updates, labels, target sizes, screen-reader announcements, Hindi glyph rendering, reduced motion, 200–400% zoom when safely testable.
5. Navigation: My Home, contextual Back, nested routes, browser Back/Forward, direct reload, URL filters, alert details, modal focus return, scroll restoration.
6. Consistency and honesty: don't imply physical lock confirmation, calibrated gas PPM, working cameras, fake AI readiness, cloud-free operation without evidence, or command success without device report.
7. Nontechnical/older-person comprehension: action discoverability, plain copy, useful error recovery, large targets and safe security confirmations.

Where possible use a **fully isolated, fully mocked browser** and inspect screenshots/DOM results at 320, 390, 768 and 1440px, across all four themes and relevant data states. Ensure 100% command/network isolation; the browser must not reach live MQTT, backend, microphones, RFID or hardware. If such isolation cannot be proven, limit yourself to source and pre-existing screenshot review.

## 5. Revisit prior Astra findings, not just aesthetic polish

The previous report identified UI/voice issues that Hallmark should help scrutinize:

- **AUD-010:** checkbox focus and Help disclosure collapse during live rerender.
- **AUD-011:** disconnected hub still showing current-looking cached door status.
- **AUD-012:** partial multi-device assistant failure lost from final response/speech.
- **AUD-013:** motion alert read path missing and stale notification bell label.
- **AUD-014:** async action failures lack visible feedback.
- **AUD-015:** invalid Activity URL/date filters trap users in Retry.
- **AUD-017:** automatic spoken reply language conflicts with resolved Hindi reply.
- **AUD-018:** Large controls does not grow favorites/filters to the approved size.
- **AUD-019:** assistant mic readiness and status text become contradictory.
- **AUD-004:** questions or future/compound requests can be misinterpreted as immediate device controls.

Check current code and, when safe, independent reproduction. Do not mark findings fixed from appearance alone or duplicate old findings under new IDs. Connect Hallmark's user-facing gate IDs to each relevant issue.

The prior Astra audit also identified **AUD-001** (door reconnect/relock hazard), **AUD-002** (secure broker/firmware mismatch), **AUD-003** (public legacy TLS key), **AUD-005** (passive traffic defeats idle expiry), and **AUD-006** (WebSocket heartbeat crash risk). Hallmark is **not** a substitute for these security/IoT reviews. Keep their protective restrictions intact, with the door gate off. Do not modify firmware or test real actuation.

## 6. Strict read-only boundaries

**Do not change any application code.** Specifically do not edit `public/`, `server/`, `firmware/`, CSS, JS, HTML, models, tests, package/dependency files, config, live DB or backups, certificates/keys, routes, MQTT contracts or existing planning files.

Do not install or update packages, run autofixers/formatters, push commits, start live services, send MQTT, unlock/toggle doors, change RFID cards, access live microphone, flash devices or migrate production databases. Do not run tests with side effects against the real system. Do not run attack/exploit tests.

You may **create new Markdown audit reports** in `docs/audit/hallmark/` and disposable evidence outside the protected project. Do not alter the six prior reports. If write access is unavailable, provide the reports as final Markdown without claiming files were written.

## 7. Required Markdown outputs

Write and verify:

- `docs/audit/hallmark/HALLMARK_AUDIT_SUMMARY.md`
- `docs/audit/hallmark/HALLMARK_GATE_MATRIX.md`
- `docs/audit/hallmark/SCREEN_AND_INTERACTION_AUDIT.md`
- `docs/audit/hallmark/FINDINGS.md`
- `docs/audit/hallmark/REMEDIATION_RECOMMENDATIONS.md`
- `docs/audit/hallmark/ASTRA_TO_SOUL_HANDOFF.md`

Every confirmed item must have: ID, Hallmark gate/tier if relevant, route/screen, theme and viewport, path:line, actual vs expected, evidence and safe reproduction, affected users, severity and confidence, relation to old AUD ID, **recommended** minimal fix, and a mock-only validation plan. Keep source-based, rendered, heuristic and untested judgments separate. Capture baseline file state and confirm only audit documents were added.

`ASTRA_TO_SOUL_HANDOFF.md` must be an implementation **recommendation package** for GPT-6.1 Soul High, not a request for Astra to begin writing code. Rank safety and functional blockers ahead of decorative refinements. List regression risks for every recommendation, especially MQTT, door unlock, RFID, offline voice and status freshness. Include a ready-to-copy future remediation prompt but **do not execute it**.

## 8. Final response

Report:

- Whether Hallmark was loaded and whether its linter and rendered mode actually ran.
- Routes/themes/viewports covered versus not covered.
- Floor / Reflex / Finish diagnostic counts, with applicability caveats.
- Confirmed **new** UI/UX findings and status of prior AUD issues.
- Critical consumer-use and accessibility risks.
- IoT/voice compatibility assessment based only on nonintrusive evidence.
- Exact audit files written and their paths.
- Tests/probes not executed and why.
- Safe priority order for the later GPT-6.1 Soul remediation session.

**Do not claim that Hallmark approved the interface or that household hardware is certified.** Do not call Hallmark's stylistic objections security vulnerabilities.

Start by reading `HALLMARK_HOMEAUTO_AUDIT.md` and the earlier Astra reports. Then resume the independent audit with Hallmark's `audit` mode, document findings, and STOP. **No implementation, redesign or production-code changes.**
