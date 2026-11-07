# Cloud implementation verification

## Current production continuation — 2026-11-07

The earlier reproducible suites below remain isolated. Later user authorization added actual Neon branch/role/RLS checks, Vercel deployment and live public signup/sign-in/browser checks on the existing custom domain. Their exact evidence and tooling limits are in [production acceptance](PRODUCTION_ACCEPTANCE.md). No live physical controller was used. These production checks do not turn the older PGlite suite into a native networking/load test.

## Original isolated implementation scope

All tests use synthetic identities, disposable databases, loopback servers and fake MQTT publications. No broker, physical device, native microphone, Neon account, deployment or DNS record is contacted. Primary evidence directory: `D:/homeauto-audit-tools/production-cloud-20261107/evidence`. Earlier baseline/initial failures remain at `C:/Users/Amogh/.codex/audit-tools/homeauto-production-cloud-20261106`.

## Reproducible checks

From the root, install the separate cloud runtime with `npm ci --ignore-scripts`; the existing hub dependencies remain under server. Then:

```text
npm --prefix server test
npm --prefix server run test:online
npm --prefix server run test:ux
npm --prefix server run test:remediation
node server/scripts/online-browser-check.js
npm run build
```

Set HOMEAUTO_CLOUD_QA_DIR/TEMP to disposable paths when collecting screenshots; the browser checker creates and closes its own simulated cloud stack. Native speech/hardware scripts are not part of this workflow. PGlite runs real PostgreSQL SQL/RLS/constraints/transactions in-process; it is not native Neon networking, actual PgBouncer, fleet concurrency or a hosted Vercel test.

Coverage includes normalized migration/rollback/idempotence, restricted role and inherited ownership rejection, tenant/private data isolation, durable login/CSRF/logout, viewer control denial, gateway key expiry/revocation, scoped telemetry, controller-report reconciliation, command/idempotency/expiry/lease/redeem, concurrent requests, transaction faults, lost exchange/redeem responses, local internet outage, stale/retained/invalid MQTT data, repeated telemetry/history limits, clock differences, process restart, restored sequence blocking, key rotation, password recovery, retention and quarantine. Client tests cover stale snapshot/cursor/preference ordering, freshness expiry/future timestamps, late-session401 guards, Vercel route restoration/consumed JSON streams and bounded bilingual suggestion grammar.

Browser tests cover sign-in/no guest bypass, four themes/05 default, mobile/tablet/desktop, qualified statuses, pending refresh, one simulated publication, expired feedback, controller/API disconnect/retry, local-only door/RFID/voice, typed requests, persisted theme/language, accessibility and bounds. Local navigation/history/focus/preferences regressions remain separate. Cloud WebSocket termination is not applicable to the chosen polling transport; retained local WebSocket reconnection is tested.

## Result ledger

Final run:145 backend/API/PostgreSQL/gateway/client tests,30 local UX groups,9 remediation groups and66 cloud screenshots/axe scans (11 scenario groups), all passing with0 browser violations/errors/external requests. Logs: backend-verified.log, ux-verified.log, remediation-verified.log and browser-verified/results.json. This includes atomic session rotation/logout lineage, current-password issuance checks and event cursor survival after retention. Root trace456 files/0 native hub files;29 protected original hashes match. See [readiness](DEPLOYMENT_READINESS.md) for the complete ledger. The earlier97-test baseline/135-test pass and145 historical local screenshots are separate evidence, not relabeled current cloud verification.

The final supplemental browser-csp-verified run repeats66 captures under the checked-in Vercel headers:0 application CSP errors/violations/page errors/external requests. Its132 blocked inline style probes originate specifically from /__qa/axe.js, directive style-src-elem, blockedURI inline; those are recorded separately from application violations. A prior console-only check failed because it mixed them together (browser-security-verified). A focused before/after probe found0 before axe and2 source-attributed axe events. The app's strict policy was preserved. Automated accessibility coverage has these tooling limits and is not manual/native WCAG certification.

Corrected test issues are retained in raw logs: invalid replay fixture failed protocol validation; retained MQTT fixture wrongly expected a live report to be overwritten; an assistant test used unsupported grammar; an expired-copy locator required text matching with its recovery hint; quarantine setup tried to create a request against deliberately unavailable test state. None was treated as a successful application run. Native rendered Hallmark results are never inferred from separate Playwright evidence.

## External acceptance still required

Approve an isolated Neon branch and hosted staging deployment. Test native role grants/forced RLS, real TLS/pooler/acquisition/timeouts, two simultaneous API instances and conflicting users, quota/cold-start/region/latency/cost behavior, restart/backup/PITR/quarantine, actual Vercel rewrites/headers/body handling/ingress, canonical custom-domain/cookie/DNS/TLS and actual-device accessibility. The older `test:cloud-staging` harness tests the **metadata mirror**, not this online API.

The new `npm --prefix server run test:online-staging` harness is prepared but **not network-executed**. It requires HOMEAUTO_ONLINE_STAGING_APPROVED=1, the expected direct hostname/database, separate owner/runtime URLs, a reviewed matching schema checksum, and zero existing online homes/users. It seeds random synthetic identities in a transaction, checks native pooling/RLS, loopback HTTP login, competing requests through independent runtime pools, one fake publication/controller report, rollback and logout. Finally it deletes only its generated IDs; expired synthetic rate-limit buckets are left to normal retention. If cleanup is interrupted, preserve the target and remove only those synthetic records after operator review. It never provisions, migrates, deploys or connects to a real broker. Guard refusal is unit-tested; native execution and hosted Vercel acceptance remain separate checks.

After AUD-001/002/003 closure and separate approval, validate the secured household gateway/broker and supervised indicator-load lighting behavior. Physical door acceptance, real Vosk/Kokoro/microphone quality, calibrated sensors, phone/notch/NVDA/native-language/older-user trials remain open.
