# Hallmark gate matrix — HomeAuto app scope

2026-11-06. Hallmark 2.0.0, commit 407fa689f4a276f2fd389208d271d0fef08f5058. Read-only audit. Gates refer to the actual installed references/gates.md; unnumbered app-state requirements are named explicitly rather than assigned invented gate numbers.

## Raw mechanical output and contextual disposition

Scan inputs: isolated copies of index.html, app.css and tokens.css. Legacy style.css and unloaded scripts were intentionally excluded. Native .js DOM construction is not among sloplint's static markup extensions, so dynamic labels/forms need browser/source review. The static scan is not an inventory of every rendered control.

| Gate / tier | Raw count | Evidence | Contextual assessment; recommendation only |
|---|---:|---|---|
| 34 / Floor | 1 FAIL | No overflow-x:clip on html/body, index.html:1 attribution | Real Hallmark house requirement departure; **no actual horizontal scroll in 158 cases**. Do not clip blindly and conceal an oversized element. Check zoom/long names first. Not a new confirmed UX defect. |
| 67 / Floor | 3 FAIL | app.css:25 .eyebrow; :34 .nav-label; :189 .settings-section-label | Two active styles: Accessibility “Preview” and desktop “Controls”; measured 1.56px and 1.8px tracking in Theme 05. Third selector has no active JS use. Active styles depart from Hallmark's house rule; cosmetic optional cleanup, not a security/accessibility failure established by this test. Keep raw failures visible. |
| 40 / Floor | 1 WARN | app.css:106 .icon-well-light, 4.43:1 against a 4.5 text threshold | This well contains an SVG bulb, with the textual name elsewhere. 4.43 exceeds the applicable 3:1 icon threshold. Dismiss as a text-threshold false positive for that element; no color rewrite justified. |
| 24b / Reflex | 64 REFLEX | app.css off-scale padding/margin/gap, e.g. :32 gap10, :117 gap18 | Real 4px-scale deviations grouped into **one spacing-consistency concern**, including inactive legacy selectors. No measured overlap attributable to them. Normalize only in a later deliberate component pass; preserve target sizes and approved geometry. Not 64 bugs. |
| 25 / Reflex | 2 WARN | app.css:226 empty description42ch; :236 login story36ch | Both brief supporting descriptions fit Hallmark's own short-copy exception (from28ch). Login is not normal guest-preview content. No change required. |
| F3 / Finish | 1 WARN | app.css:17 no text-wrap:balance | Optional typographic refinement after Hindi/large-text checks. No clipped heading found in the matrix. |
| F5 / Finish | 1 WARN | app.css:144 assistant invitation icon well | Protected approved consumer-app icon treatment; a meaningful microphone cue. No standalone defect. |
| F6 / Finish | 1 WARN | app.css:110 .status inferred numeric display selector | False inference: actual .status is .8125rem and contains status words; not a display-size numerical metric. No change justified. |
| F24 / Finish | 1 WARN | app.css:219 dialog hairline plus shadow | Intentional modal separation, including strong-outlines accessibility support. Preserve unless a measured rendering problem is found. |

**Raw totals:** Floor 4 FAIL/1 WARN; Reflex 64/2 WARN; Finish 4 WARN. Total75. Waived0, rejected0, answered0, dismissed0 in the tool output. Report-level contextual dispositions do not edit the tool output or constitute CSS-stamped waivers.

**After contextual review:** 0 confirmed new functional defects caused by these 75 records; 2 active tracked-label style departures, 1 absent clipping rule and 1 grouped spacing concern remain documented. The two new functional findings were discovered through Hallmark's app-state procedure and isolated browser checks, not emitted by sloplint. No aggregate “Hallmark pass” is awarded.

Gate 20 was suppressed by --before as implemented by the tool. No Hallmark stamp was added to existing production CSS. --before's exit0 is bookkeeping, not evidence of zero failures.

## Judged and application-specific checks

| Gates / requirement | Evidence and disposition |
|---|---|
| 2a/2b, 7a/7b, 22/23, 29, 65, 74: color/material | Four approved palettes retained. White surfaces and restrained category colors are intentional. No glowing/gradient-heavy layout found in selected rendered views. Accent coverage was not measured with Hallmark's renderer. |
| 1, 37, 38, 55, 64, 75: type | System face is permitted in app scope. Hindi local fallback is appropriate. No essential clipped text found by inspection; no native-script quality certification. More font assets are not necessary. |
| 3/4: repeated/nested cards | Device controls repeat because they expose a fixed set of equivalent devices. Flat settings rows and mixed security/home composition provide hierarchy. Theme swatch miniature cards represent a preview, not nested operational controls. No new functional card defect. |
| 10a/10b, 11/12, 15, 17/18, 27/28: motion | Source has explicit short transform/opacity route transitions and reduced-motion overrides, instant focus outline, no auto-carousel/video. This continuation did not run a dedicated OS reduced-motion/forced-colors matrix; earlier evidence remains separate. |
| 26a: focus | Visible CSS outline exists; native modal Escape returns to Add room. **AUD-010** remains: rerendering loses checkbox focus and Help state. This is a behavioral access failure outside static focus-style detection. |
| 26b/39a + eight states | Native buttons/disabled attributes/field labels are present. Several handlers lack an error boundary (**AUD-014**); readiness captions conflict (**AUD-019**). **HUI-001/002** cover startup error and loading boundaries. Not every pointer/disabled/form-error state was rendered. |
| 40/41: contrast | Configured axe checks report no violations in158 cases. That is not a measured pass for every icon/ring/disabled pair; the one raw icon warning is contextualized above. Color perception/manual contrast review remains a release check. |
| 34/50/73: reflow/overlap | 320/390/768/1440 matrix and Hindi/large variants had0 document overflow. Selected screenshots show readable titles and controls. No 1920px/native 400% zoom claim; no exhaustive pixel occlusion algorithm ran. |
| 48 and24a: tokens | Main color/surface/focus values use semantic tokens. Manual source note: app.css:10 includes literal Hindi font names beside var(--font); moving that fallback stack into a language token would improve consistency, but must preserve glyph support. No --space-* scale exists, so24a does not explain the 64 raw24b records. |
| 49a/49b: wrapping | Some long Home action labels wrap at 390, especially Theme 03. They remain readable and targets grow; forcing nowrap would harm localization/reflow. Record as a protected audience/design tradeoff, not an invented clipping defect. |
| 19/54/63/67: copy/labels | “Unlock” is an actual lock action, not a marketing buzzword. Live status dots and separators can communicate state; do not delete safety context. Accessibility Preview is a small repeated label before a sample heading; optional cleanup only. English scanner objections do not justify rewriting Hindi. |
| 30a/30b/33: icons/access | One local SVG family, decorative icons aria-hidden, native labels. No important emoji action icon found. |
| 46a/70: honesty | Simulation is explicitly labelled. No camera/scene/climate functionality invented. Preserve sensor and relay-position caveats. **AUD-011/009/012/019** undermine freshness or completeness despite generally careful wording. They are cross-references, not new mechanical gate failures. |
| 62: script visibility | The shell shows “HomeAuto · Loading…” without JS. It is not a CSS reveal hidden-at-rest defect; no claim of a functional no-JS smart-home app. A clear static troubleshooting fallback is an optional resilience recommendation, distinct from tested HUI-001. |
| 76/80/84: assets | All assets local in the tested application. Small approved house illustration preserved; no need for stock photos or a replacement theme. Mocked data was used expressly for a safe audit, not represented as a live product deployment. |
| App screens: URL/state/navigation | My Home 34/34, nested history/reload and modal return pass. Activity bad filter still traps users (**AUD-015**). Alerts History filter stays in ctx.filters rather than URL (views.js:145,151); note as a consistency improvement, not a duplicate of AUD-013 or an additional confirmed release blocker. |
| App screens: loading/empty/error/full | Empty favorites/cards/activity/alerts and filled room/device regions render. Slow data leaves blank main (**HUI-002**); initial503 shows credentials (**HUI-001**). Existing stale/pending/partial/error findings retain original IDs. |
| Remaining Finish checks | No demonstrated release blocker. Hairline/shadow, colored icon wells, heading balancing and helper-slot reservation are craft questions. Device controls and warnings take priority; no numerical Finish score invented. |

Marketing-only skipped families:1,6,8,9,32,42,44,46b,58,59,66,68,77–79,81–83,85,F8,F15,F20, as documented by app scope. When this table mentions a related user requirement (e.g. width containment), it is independently evaluated rather than claiming the skipped gate ran.

## Render coverage by screen/theme/width

| Screen set | Themes | Widths | Cases | Result |
|---|---|---|---:|---|
| Home, Rooms, Security, Assistant, Settings |05,01,03,04|320,390,768,1440|80|0 axe violations;0 document overflow |
| 29 secondary/not-found routes listed in screen report |05|390,1440|58|0 axe violations;0 document overflow |
| Five main screens, Hindi + large text/controls |05,01,03,04|320|20|0 axe violations;0 document overflow |

These are **separate Playwright measurements**, not Hallmark-rendered gate results. Raw per-case route/theme/width/title/heading/label records: [browser-results.json](C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/run/evidence/browser-results.json). The screenshots show simulated state. A source-held behavior can still fail while the settled layout passes.

