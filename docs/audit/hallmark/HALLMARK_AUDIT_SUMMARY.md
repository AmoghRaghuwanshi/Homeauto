# HomeAuto — Hallmark audit continuation

Date: 2026-11-06 (Asia/Calcutta). Target: HomeAuto 2.0.0 at D:/homeauto-main. Mode: **audit only, app scope**. This supplements the six original Astra reports; it does not replace their evidence or implement recommendations.

## Outcome

**19 prior findings remain open; 2 distinct P2 findings are added.** Combined inventory: **21 findings — 1 P0, 5 P1, 14 P2, 1 P3**. No finding was marked fixed or regressed without evidence. The additional findings are:

- **HUI-001:** startup service failure is presented as a sign-in requirement, including in the login-free simulator.
- **HUI-002:** data-dependent navigation renders a blank content area while loading, without the destination header, Back control or progress indication.

Both were reproduced against a copied frontend and fully intercepted synthetic APIs. Details, exact lines and safe reproduction are in [FINDINGS.md](FINDINGS.md). These are functional app-state defects, not a reason to replace the four-theme design.

The existing firmware relock hazard, secure broker/firmware deployment gap and unsafe intent interpretation remain higher priorities. Keep the physical-door gate off. This report is not Hallmark approval, WCAG certification or hardware certification.

## Hallmark initialization and provenance

The user-supplied [companion guide](../HALLMARK_HOMEAUTO_AUDIT.md) and continuation attachment were read completely. The official [Hallmark repository](https://github.com/nutlope/hallmark) was accessed. Version **2.0.0**, pinned commit **407fa689f4a276f2fd389208d271d0fef08f5058**, was obtained with Codex's skill-installer helper:

```text
python C:/Users/Amogh/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --repo nutlope/hallmark --path skills/hallmark --ref 407fa689f4a276f2fd389208d271d0fef08f5058 --dest C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/skills --method download
```

The helper reported success and the installed files were read and hashed. No Hallmark installation was found in the ordinary Codex/.agents skill directories before this step. **Classification: verified isolated filesystem installation; source instructions loaded directly and the audit procedure applied manually in this session. Native automatic discovery/slash-command registration was not established or claimed.** No global hooks, HomeAuto packages or agent configuration were changed.

Installed root: C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/skills/hallmark.

Read: SKILL.md; references/redesign.md, flow.md (including App screens and Harnesses), gates.md, interaction-and-states.md; relevant sloplint.mjs argument/output logic and sloplint-render.mjs dependency/browser/output behavior. SKILL.md SHA256: 25A1FF92D925B2389E8409F42FB8AD7E033FCECA8B5D1F07ED4CA4C28DA53DC3. sloplint.mjs SHA256: 23FB94903AE0E3B709019380443163BDC50390A246911E3423B83695E4BC8037.

The audit stops at the Before/read/judged-gates stage of redesign.md. No redesign, theme deal, scaffold, build, --kept comparison, automatic fixer or CSS stamp was run/written. Build-specific fresh-context reviews were not invoked as an audit requirement.

## Pre-flight and protected design

- Native browser modules: public/index.html:9–13 and public/js/main.js:1–8. No framework migration is warranted.
- Semantic palettes: public/css/tokens.css:1 onward. Theme 05 remains default; 01 Warm Organic, 03 Universal Comfort and 04 Friendly Pastel retain their approved identities.
- System/local fonts and geometry: public/css/app.css:1–21. Hindi uses local fallback fonts. No online font dependency was added.
- Navigation: public/js/navigation.js:1–104; shared History API owner, explicit parent fallback and a real Home anchor.
- Existing design documents: HomeAuto_UIUX_Docs/design.md, THEMES.md, COMPONENT_SPEC.md and SCREENS.md; DEVELOPMENT_STATE.md and the prior audit distinguish implemented software from unfulfilled release gates.
- **Preserved:** all source, shell, palettes, content, handlers, hardware/security contracts and existing documentation.
- **Introduced into HomeAuto:** only the six new Markdown reports listed below.

The inferred linter genre was modern-minimal for functional app chrome; this is diagnostic scope, not a replacement theme. App scope exempts marketing heroes, fold composition, screen word budgets and section-rhythm rules. HomeAuto's 48px/56px target requirements override Hallmark's smaller visual app-control suggestion. No protected warning, Hindi text or operational “unlock” label was rewritten.

## Mechanical and browser verification

Command executed from the isolated run directory:

```text
node ../skills/hallmark/scripts/sloplint.mjs ./copy/public/index.html ./copy/public/css/app.css ./copy/public/css/tokens.css --scope app --genre modern-minimal --render --before --json
```

**Static scan ran. Hallmark rendered tier did not run:** “no puppeteer-core found locally, globally or via HALLMARK_PUPPETEER.” No browser package was installed. The --before invocation exits zero even with findings; that exit is not a quality pass. It wrote .hallmark/before.json outside HomeAuto. JSON mode emitted the diagnostics to evidence/sloplint.json; it did not produce before.txt or Hallmark screenshots.

| Tier | Raw result |
|---|---|
| Floor | 4 FAIL + 1 WARN |
| Reflex | 64 REFLEX + 2 WARN |
| Finish | 4 WARN |
| Total | 75 diagnostic records; no waivers or fixes |

The 64 Reflex records are off-scale spacing occurrences, not 64 independent UX bugs. Missing overflow clipping is not proof of actual overflow; two active tracked-label styles are genuine house-rule departures; the third is dormant. The icon-contrast warning uses a text threshold for an icon. See [gate matrix](HALLMARK_GATE_MATRIX.md) for every disposition. Counts were not silently reduced to a false “Floor 0.”

**Separate Playwright/Chromium verification did run**, using only copied source, synthetic HTTPS routing and intercepted WebSockets:

- **158 render/axe cases**, **0 detected horizontal overflow**, **0 axe violations** for the selected WCAG A/AA tags.
- 80 main-page cases: five pages × four themes × 320/390/768/1440px.
- 58 secondary/not-found cases: 29 routes × 390/1440px, Theme 05.
- 20 Hindi + Large text + Large controls cases: five main pages × four themes at 320px.
- All 20 English main-page screenshots at 390px were visually reviewed; additional tablet, desktop, Hindi and failure screenshots were reviewed.
- My Home passed from 34 routes, including unknown route recovery. Home → Security → Back, room Back/Forward/reload, modal Escape/focus return and corrected theme persistence passed.
- Focus loss, Help collapse, stale door status, invalid Activity filters, undersized large-mode favorites and stale readiness captions reproduced existing issues.
- HUI-001 and HUI-002 reproduced. Zero page errors, outbound app requests or microphone calls in the matrix; all API operations recorded by the Hallmark-stage harness were GETs.

This is not a Hallmark-renderer pass or a full state-by-theme-by-device certification. [Screen and interaction audit](SCREEN_AND_INTERACTION_AUDIT.md) gives coverage and caveats.

## Baseline, preservation and continuity

The earlier audit's **125 protected source/document/artifact SHA256 entries match the current files**. This supports retaining the prior findings as open against unchanged source; it does not claim every backend/hardware probe was rerun. The six existing Astra report hashes were separately captured for preservation. A final read-only comparison is recorded in the handoff.

docs/audit/FIX_PRIORITY.md and docs/audit/HANDOFF_TO_SOUL.md are absent. The original summary references them, but their contents were not invented and the original summary was not edited. This continuation supplies recommendations and handoff in the new Hallmark folder.

All linter records, copied code, simulated fixture JSON, runner scripts and screenshots are outside HomeAuto under C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/run. The browser served copied static bytes through Playwright interception; no HTTP server or HomeAuto backend was started. The synthetic hostname never resolved to a real server. WebSockets were handled locally without connectToServer; microphone access was denied in the harness. The fixture repository used :memory: and Home had no publisher. Existing installed test dependencies were read without modifying them.

## Report set and limits

New Markdown reports:

1. [HALLMARK_AUDIT_SUMMARY.md](HALLMARK_AUDIT_SUMMARY.md)
2. [HALLMARK_GATE_MATRIX.md](HALLMARK_GATE_MATRIX.md)
3. [SCREEN_AND_INTERACTION_AUDIT.md](SCREEN_AND_INTERACTION_AUDIT.md)
4. [FINDINGS.md](FINDINGS.md)
5. [REMEDIATION_RECOMMENDATIONS.md](REMEDIATION_RECOMMENDATIONS.md)
6. [ASTRA_TO_SOUL_HANDOFF.md](ASTRA_TO_SOUL_HANDOFF.md)

Raw evidence: [browser matrix](C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/run/evidence/browser-results.json), [corrected probes](C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/run/evidence/probe-results.json), [sloplint](C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/run/evidence/sloplint.json). These disposable local artifacts are not required at application runtime.

Not executed in this continuation: live preview/backend, production database writes/migrations/restores, actual MQTT/broker credentials/ACLs, physical relays/door/RFID, firmware build/flash, real microphone/native speech workers, OS notification permission changes, NVDA, actual phones/notches, native browser 200–400% zoom, participant usability or native-language speech acceptance. No household safety inference follows from screenshots. Earlier HTTP/syntax/memory/native-speech evidence retains its original provenance; those suites were not rerun merely to inflate this continuation's totals.

