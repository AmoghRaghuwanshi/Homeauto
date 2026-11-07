# Astra → GPT-6.1 Soul High — independent audit handoff

2026-11-06. **Audit and recommendations only. No implementation was performed.**

## Decision and scope

The software can be repaired with isolated fixtures, but household/physical-door release is not established. Preserve the original 19 AUD IDs and the 2 new HUI IDs. Combined count 21: P0=1, P1=5, P2=14, P3=1. No prior issue was declared fixed; unchanged-source verification and new mocked reproductions are distinguished in FINDINGS.md.

Read these in order:

1. [Hallmark summary](HALLMARK_AUDIT_SUMMARY.md) and [findings](FINDINGS.md).
2. [Remediation recommendations](REMEDIATION_RECOMMENDATIONS.md).
3. Original [BUG_REPORT.md](../BUG_REPORT.md), [IOT_COMPATIBILITY.md](../IOT_COMPATIBILITY.md), [SECURITY_AUDIT.md](../SECURITY_AUDIT.md), [AI_VOICE_AUDIT.md](../AI_VOICE_AUDIT.md) and [UI_UX_AUDIT.md](../UI_UX_AUDIT.md).
4. [Gate matrix](HALLMARK_GATE_MATRIX.md) and [screen coverage](SCREEN_AND_INTERACTION_AUDIT.md).
5. Actual application source and existing design/runtime contracts. Earlier implementation checkmarks are not substitutes for the new failing cases.

The older FIX_PRIORITY.md and HANDOFF_TO_SOUL.md referenced by the original summary are absent. Their contents were not fabricated; this new folder supplies the consolidated recommendation package without editing the earlier reports.

## Tooling and verification record

Hallmark 2.0.0 was installed into a private external directory by Codex's helper, at pinned official commit 407fa689f4a276f2fd389208d271d0fef08f5058. Instructions were loaded from that source and applied manually in-session. This was not a globally registered skill or native slash-command run. Static --scope app/--before scan ran; Hallmark's render tier did **not** run because puppeteer-core was unavailable.

Raw result: Floor 4 FAIL +1 WARN; Reflex 64 +2 WARN; Finish 4 WARN. No CSS waivers/fixes/stamp were added. These 75 diagnostics are contextualized rather than presented as75 application defects.

A separate isolated Playwright matrix completed 158 cases with 0 axe violations/0 document overflow. All 20 primary mobile theme screenshots were inspected; selected tablet/desktop/Hindi/failure images were also inspected. My Home 34/34, contextual Home/Security Back, room history/refresh, modal focus return and corrected theme persistence passed. Source/browsers still demonstrate existing AUD-010/011/015/018/019. HUI-001 startup 503→login and HUI-002 blank slow route were newly reproduced.

Earlier 14 HTTP tests,57 JS parses,2 Python AST checks, memory probes and108-case visual matrix belong to the preceding independent audit. Prior implementation 63 tests/30 UX groups/145 screenshots/native speech evidence also remain historical. Do not relabel those as rerun Hallmark checks.

External runner/evidence root: C:/Users/Amogh/.codex/audit-tools/homeauto-hallmark-20261106/run.
Use evidence/probe-results.json for corrected persistence and large-controls probes. The first runner seeded preferences on every load; that harness limitation was corrected and is disclosed in the screen report.

## Preservation and isolation

The earlier 125-entry protected source/document/artifact manifest matched 125/125 before report writing. The final verification below records the closing comparison. Application/firmware/config/dependency files were not edited; tests read copied source and an in-memory fixture without a publisher. No live localhost preview/backend, database migration, MQTT, real microphone, card scan, door command or firmware flash was used. No running household service was restarted.

Only six new Markdown files were added within HomeAuto, all in docs/audit/hallmark. The six earlier Astra reports and the user-supplied guides remain untouched. External outputs contain copied source, fake data, scripts and screenshots; they are not production dependencies.

## Future remediation prompt — copy only into a separately authorized coding session

> Continue the existing HomeAuto project at D:/homeauto-main. Read docs/audit/hallmark/HALLMARK_AUDIT_SUMMARY.md, FINDINGS.md, REMEDIATION_RECOMMENDATIONS.md, the original six Astra reports and current runtime/design contracts before edits. Preserve all 19 AUD IDs plus HUI-001/002. Reproduce each selected defect with an isolated fixture before repairing its owner module. Start with unsafe intent interpretation, session idle policy and heartbeat failure containment while keeping the door gate off; plan the firmware/TLS/key release work separately with the operator. Fix truthful state/result reporting, startup/loading/error recovery, persistent metadata and live-update focus before optional visual craft. Preserve the four themes (05 default), login-free simulation, production authentication and every MQTT/device/security contract. Do not treat raw Hallmark house-style failures as hardware vulnerabilities. Do not add cloud dependencies, replay uncertain commands, operate physical devices, flash firmware or mutate the live database. Use mocked APIs/publishers, fake clocks and disposable storage. For any firmware or contract change, prepare a concrete reviewable proposal and compile/test it safely before any separately authorized deployment. Record each finding as reproduced, fixed, partly fixed or blocked with evidence; do not claim hardware or human accessibility acceptance from software tests.

This prompt was **not executed** during the audit.

## Outstanding manual and external gates

- Actual broker CA/credentials/ACLs and authenticated TLS firmware, supervised relock/network/power/egress validation.
- Inventory/retirement of any deployment trusting the public legacy key; no exploit attempted.
- Real phone browsers, keyboard/zoom/NVDA, permission behavior and older/nontechnical household trials.
- Native Hindi/Hinglish language and consented microphone/speech quality/latency testing; this stage did not start native workers.
- Production recovery/power interruption/license/packaging review. Never use the original database as a test fixture.

These limits remain release conditions, not reasons to rewrite the product or fill it with unsupported features.

## Final preservation verification

Closing comparison completed on 2026-11-06 after all six reports were created:

- **125/125** protected source/document/artifact hashes match the original audit snapshot; changed or missing: **0**.
- **6/6** original Astra audit report hashes match the Hallmark-stage opening snapshot; changed or missing: **0**.
- New HomeAuto output is exactly the six Markdown reports listed in HALLMARK_AUDIT_SUMMARY.md. No application fix is included.
- Both isolated browser runs completed and their browsers closed. The native Hallmark renderer remained unavailable; no render pass is implied.

Preserved report SHA256 values:

| Original report | SHA256 |
|---|---|
|AUDIT_SUMMARY.md|7A27CBA077A7EC477E12499DDC3E5E72806A1F8ACB4E05185D41E9670D8E02FD|
|BUG_REPORT.md|5A8D9D8751F8F1333FA9F12107937EBA8A3D3E8D0124B54CCA4516283B344D34|
|UI_UX_AUDIT.md|1E7A59B9DBD7C9D37D0B4C876B895B74459248FCFA3958DF2858FA11F05E7056|
|IOT_COMPATIBILITY.md|D628942A59C28D282D77BB34A878B1C7C8FF91B8F2C713F5CFF3ACAA491AE318|
|AI_VOICE_AUDIT.md|D34B07A5D69D6BC0ABC87D51F38FCE68A880E18AB5FD677877BDF0FA20D88D8A|
|SECURITY_AUDIT.md|BDA479E4E3636182CAAFAE8F862BB3D634839E6C4FBC76597E3A6312DA24EF28|

Audit complete. Production code and IoT control behavior were left unchanged. The findings are ready for GPT-6.1 Soul High to review and implement.

