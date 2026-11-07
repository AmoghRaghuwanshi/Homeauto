# Deployment readiness — 2026-11-07

**Cloud software is implemented and passes the available isolated checks. Production acceptance remains open.** No cloud resource, paid service, public deployment, DNS change, live migration, broker/firmware change or physical operation occurred. No credentials were requested or fabricated.

## Delivered

Normalized PostgreSQL migrations/RLS/repositories; durable cloud accounts/sessions/memberships; role/CSRF/origin/throttle controls; outbound gateway tickets, sequence/digest/replay/freshness checks; durable command leases/admission/observations; operator recovery/quarantine/key rotation; lean Vercel API/static deployment configuration; integrated cloud frontend; all10 cloud documents and a guarded native staging harness.

Atomic PostgreSQL rotation retains logout lineage and rechecks current password verification. Household event high-water marks survive history pruning. Local SQLite, MQTT, RFID, WebSocket and Vosk/Kokoro remain. Cloud metadata editing/RFID/microphone streaming are explicitly local-only; cloud preferences/favorites/alert receipts, household switching and typed assistant requests work.

Remote light gates default OFF in cloud and gateway. Remote door commands always fail; the physical door gate stays OFF. Sensors are read-only. Controller reports and simulated publications are never physical-actuation verification.

## Latest verification

Evidence root: D:/homeauto-audit-tools/production-cloud-20261107/evidence.

| Check | Observed result | Evidence |
|---|---|---|
| Full backend/API/PostgreSQL/gateway/client suite | 145 passed,0 failed/skipped | backend-verified.log |
| Local UX/navigation regressions | 30 groups,0 errors | ux-verified.log |
| Audit-remediation browser regressions | 9 groups,0 errors | remediation-verified.log |
| Cloud browser suite | 11 groups;66 captures/axe scans;0 violations/page errors/external requests | browser-verified.log; browser-verified/results.json |
| Vercel dependency trace | 456 files;0 native/hub/private files | npm run build |
| Root cloud dependency audit | 0 vulnerabilities including development tools after scoped build-tool override | cloud-full-audit.json |
| Protected original artifacts | 29 match baseline; original DB28,672bytes | protected-hashes.json |
| Hallmark app/modern-minimal CSS | 0 Floor FAIL,0 Reflex,2 contextual warnings | hallmark/static-final.json |
| Fresh Hallmark finish review | 3 cloud-copy findings;3 resolved and visually recaptured | docs/ux/UI_UX_REFINEMENT.md continuation |
| Unslop English audit | Phrase0; silhouette0; one structural soft flag and2 readability advisories protected as consistent status labels | unslop-*.json; docs/ux/UNSLOP_AUDIT.md |

PostgreSQL tests use disposable PGlite SQL/RLS/transactions, not native Neon/PgBouncer. Browser traffic is loopback with fake MQTT. Supplemental browser-csp-verified.log/results repeat all66 captures under the actual Vercel headers:0 application CSP errors. They separately record132 blocked inline style probes from /__qa/axe.js; an initial unsplit console check failed on those tool probes. Source-qualified SecurityPolicyViolation events distinguish the QA styles; application policy was not relaxed. Earlier accessibility scans without that tooling restriction also had0 violations; none constitutes full accessibility certification. Native Hallmark rendering was attempted against a disposable server but unavailable because puppeteer-core was absent. No hardware/native speech pass is inferred.

## Preview and continuity

Earlier preview PID12212 was no longer running when checked; it was not stopped by this work. A fresh hidden **local-only in-memory simulator** runs at [localhost3001](http://127.0.0.1:3001), launchPID448 (verify before managing it). No login; fake MQTT; gateway/cloud flags forced OFF; native voice not started. Health/runtime/snapshot return200 with seven simulated devices. This is local UI mode, not a deployed Neon product. Previous transient preview edits are not claimed recovered; authoritative household files are untouched.

Workspace D:/homeauto-main is now published as sanitized source to [AmoghRaghuwanshi/Homeauto](https://github.com/AmoghRaghuwanshi/Homeauto). See [publication verification](../verification/GITHUB_PUBLICATION_REPORT.md) for secret gates, Actions and anonymous checkout results. Source publication has not deployed Vercel or provisioned Neon. Earlier baseline/evidence remains at C:/Users/Amogh/.codex/audit-tools/homeauto-production-cloud-20261106; its initial empty inventory was corrected to170 files before editing. Later C: capacity pressure moved disposable cache/TEMP/output to D:/homeauto-audit-tools/production-cloud-20261107; no user files were deleted. Test servers/browsers closed; only the documented preview remains.

## External acceptance still required

1. Approve an empty/schema-only Neon staging target; privately configure owner/direct and restricted/pooled roles, apply reviewed migration/grants, then run test:online-staging. Test native TLS/pooler/concurrency/timeouts/load/restore/latency/cost. The new harness refusal guard is tested; its network path was not executed.
2. Approve hosted Vercel staging and environment/branch setup; verify actual hosted build, routes/headers/auth/body handling/ingress/runtime limits. Attach the actual custom domain using its displayed ownership/DNS instructions, then verify HTTPS, redirects, cookies, phone navigation and nested refresh. Nothing is publicly hosted yet.
3. Resolve AUD-001 physical-door relock hazard, AUD-002 authenticated firmware/broker rollout and AUD-003 private TLS/key replacement under the existing operator proposals. Separately approve secure gateway enrollment and supervised indicator-load lighting tests. Keep remote gates OFF until approval; keep physical door OFF.
4. Complete native Vosk/Kokoro/microphone, real phone/notch/zoom/NVDA, Hindi/Hinglish and household usability acceptance.

Current Vercel supports WebSockets; this version deliberately uses durable bounded polling. Hosted fleet fanout/alert destinations/public self-service recovery are not claimed. Bolt position, physical actuation and calibrated safety sensing remain unverified. Original21 audit dispositions remain:18 software fixes; AUD-001/002/003 external blockers.

Read [architecture](CLOUD_ARCHITECTURE.md), [migration](DATABASE_MIGRATION.md), [Vercel/domain](VERCEL_DEPLOYMENT.md), [security](SECURITY_AND_AUTH.md), [gateway](REALTIME_GATEWAY.md) and [test limitations](PRODUCTION_TESTS.md). Configure future secrets through private platform/operator environments, never chat.

