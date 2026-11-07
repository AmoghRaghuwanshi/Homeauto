# Full system verification and publication checkpoint

2026-11-07. Target: https://github.com/AmoghRaghuwanshi/Hosmeauto, main. Source workspace D:/homeauto-main. This continues the existing implementation; prior tests are historical until rerun. No live household broker, physical relay/door/RFID, production database, cloud provisioning or domain change is part of this verification.

## Fresh software evidence

Evidence is outside the publish tree at D:/homeauto-audit-tools/publication-20261107. Backend full run:148 passed before the additional browser-launch cleanup regression; the four focused publication regressions also pass. Clean-checkout/CI final totals will be recorded after the actual push. Local browser:145 screenshots, four themes,320/390/768/1024/1440 widths, Hindi/English, secondary routes and accessibility states;0 violations/errors/external requests. Cloud browser:86 final captures/11 groups,0 app CSP/errors/violations/external requests, including320 and visible expired feedback. Four-theme320 quick-action recaptures also pass4 axe scans and measured single-line labels. Local UX30 groups and remediation9 groups pass. Native synthetic CPU English/Hindi TTS/STT and four browser voice scenario groups pass on isolated simulated hardware; this is not human speech accuracy or microphone/physical acceptance. An initial concurrent-load TTS readiness timeout is retained; isolated retry succeeded. The injected-stream browser test reports actual microphone hardware unverified.

Version2 adds a forward maintenance migration without changing001 or rewriting household/command records; it removes expired-row DELETE from the per-request rate limiter, indexes expiry and provides bounded owner-only maintenance. Safe Neon endpoint-routing/system-root parameter compatibility is implemented without permitting arbitrary PostgreSQL startup options or TLS downgrade. Cloud target is explicitly online; legacy catalog mode/shared helpers remain compatible and mutually exclusive. 404/privacy/status copy is corrected in place, with approved palettes and navigation retained. A Windows Chromium launch denial exposed a disposable-fixture cleanup gap; cleanup and a regression were added rather than suppressing the launch error.

## Historical audit crosswalk

Original reports remain local source evidence; this table records current dispositions against actual source and fresh tests, not their old pass counts.

| ID | Current disposition/evidence |
|---|---|
| AUD-001 | OPEN physical relock/blocking reconnect hazard; door gate OFF; no firmware flash |
| AUD-002 | OPEN authenticated TLS broker/firmware rollout; unchanged anonymous legacy sketches cannot use secured broker template |
| AUD-003 | OPEN household key/trust replacement; old key excluded from publication and never used by active runtime |
| AUD-004 | Fixed: bounded grammar/questions/negations/scheduling rejection and no-publication regressions |
| AUD-005 | Fixed: reads do not renew idle sessions; explicit activity, absolute bounds and revocation tests |
| AUD-006 | Fixed: heartbeat/storage failure containment; isolated runtime regressions |
| AUD-007 | Fixed: durable room deletion/backfill only during migration |
| AUD-008 | Fixed: metadata versions persist; conflict/persistence/browser tests |
| AUD-009 | Fixed: queries re-read observations; command replay remains qualified historical speech |
| AUD-010 | Fixed: focus/disclosure state survives live updates; keyboard/modal tests |
| AUD-011 | Fixed: disconnect/stale/future/retained reports neutralize UI/control authority |
| AUD-012 | Fixed: aggregate assistant results retain per-target failures |
| AUD-013 | Fixed: per-user alert read/count state and navigation |
| AUD-014 | Fixed: acknowledgment failure visible; receipt does not clear active safety warning |
| AUD-015 | Fixed: malformed/reversed date recovery and URL filters |
| AUD-016 | Fixed: unsupported restore rejected in disposable preflight without replacing original |
| AUD-017 | Fixed: Auto speech follows resolved language; Hindi regression |
| AUD-018 | Fixed: large controls/favorite targets, narrow/zoom/keyboard checks |
| AUD-019 | Fixed: microphone readiness updates both ways without automatic capture |
| HUI-001 | Fixed: startup503/Retry preserves auth boundary and usable unavailable screen |
| HUI-002 | Fixed: async loading title/Back and late-response generation guards |
| NEW-001 | Superseded by implemented Vercel config/API entrypoint/SPA fallback; fresh build trace passes; hosted acceptance OPEN |
| NEW-002 | Fixed in forward002: no per-request purge; bounded private maintenance and privilege tests |
| NEW-003 | Compatibility decision: online is target; legacy metadata mirror retained/deprecated for new deployment, not run together; no unsafe schema merge |
| NEW-004 | Confirmed decoration/copy corrected: status-dot removal, sentence case and normal punctuation; app scope preserves functional icons and palettes |
| NEW-005 | Fixed404 instruction/Hindi; existing About text retains its valid translation key rather than blind dead-key deletion |
| NEW-006 | OPEN firmware reconnect stalls sensors; compiler/bench/supervised rollout required; no firmware changes |
| NEW-007 | Fixed tested endpoint options and system-root hint with verified Node TLS defaults; arbitrary paths/options rejected explicitly |
| NEW-008 | Superseded by existing attachDatabasePool/Fluid/pg package;456-file trace excludes native hub; native pooling acceptance OPEN |
| NEW-009 | OPEN human/native Hindi accuracy. Observed synthetic number omission; guessing homophone-to-device mappings rejected as unsafe |

## Boundaries and publication gates

All software checks use memory/temp databases, fake publishers and simulated observations. No database success, HTTP202 or controller report is physical proof. Remote lights default OFF at both ends; remote door always rejected. The household SQLite and local voice runtime remain separate from cloud. Agent skills are design/review instructions, never frontend dependencies.

The exact public remote was verified empty and writable; no hooks/deployments/workflows were recorded. Configured Git authentication is available; commit identity uses the owner's GitHub noreply address. Vercel Git deployments are explicitly disabled. No migrations execute in builds or CI. No live Neon/Vercel/DNS/physical acceptance is claimed. Candidate/history secret checks, exact remote SHA, clean public clone and Actions outcomes are recorded separately in GITHUB_PUBLICATION_REPORT.md and CLEAN_CHECKOUT_TEST_RESULTS.md after execution.
