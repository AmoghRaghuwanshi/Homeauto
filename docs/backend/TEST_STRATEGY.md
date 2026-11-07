# Backend verification

Actual results and evidence paths are in IMPLEMENTATION_TRACKER.md. Existing70 local tests and browser scenarios retain the original audit regressions. New tests are server/tests/cloud.test.js. All new PostgreSQL data is synthetic and all device publications are in-memory functions.

## Levels and limits

1. Protocol/config/journal tests check consent, HTTPS/token/identity validation, strict privacy allowlist, telemetry exclusion, atomic rollback, coalescing, delayed acknowledgment races, durable restart, identity mismatch, invalid/oversized metadata and default-off behavior.
2. PGlite executes PostgreSQL DDL, JSONB, constraints, transactions, advisory-lock SQL, role grants and forced RLS. Tests switch to a non-owner/non-superuser role. They verify migrations/checksum drift/interrupted DDL, duplicate/conflicting/stale/out-of-order operations, tenant context isolation, full-snapshot deletion and source-to-cloud checksum comparison.
3. Mock network/pool faults cover503,401, malformed/oversized replies, commit followed by lost acknowledgment, backoff across repeated outages, backward local clock, cancellation, exhausted/unavailable pool, rollback failure and revoked hub. Native pool wait scheduling is not simulated as if measured.
4. Real loopback HTTP exercises the separate cloud API with synthetic credentials, Origin/scope/body/rate/unknown-route checks. An opt-in hub runtime test routes its HTTPS URL through an injected loopback HTTP transport and actual PostgreSQL engine; speech/MQTT/auth adapters are explicit fixtures. This tests integration, not public TLS.
5. Existing browser suites verify My home across32 routes, nested Back/Forward/reload, preference persistence, mock offline/reconnect, permission/error/focus/date/assistant states and all nine remediation groups. Frontend files remain unchanged; earlier four-theme screenshot/axe evidence is linked in docs/ux/UI_REDESIGN_PROGRESS.md, not relabeled as a new render run.

PGlite is PostgreSQL compiled to WASM with a single exclusive connection ([official documentation](https://pglite.dev/docs/)). Its serialized fixture pool does **not** demonstrate native multi-connection locking, pg wire transport, TLS certificate validation, PgBouncer behavior, Neon cold starts, role LOGIN, deployment failover or service-level latency. These are required separately authorized staging gates. Pool timeouts/TLS policy are configuration and fault-double checks here, not live network benchmarks.

## Failure matrix

| Failure | Expected behavior | Verification / recovery |
| --- | --- | --- |
| Internet/Neon outage or503 | Local API/control continues; bounded metadata retry | New worker tests plus fake local light publication; resume on recovery |
| Power loss during local write | Atomic old/new file, pending actions uncertain; no replay | Existing repository restart/export tests + journal disk-fault test; actual power-loss rig pending |
| ESP32 disconnect/delayed or retained MQTT | Controls unavailable/stale; fresh evidence needed | Existing core/browser simulated freshness tests; physical broker/board test pending |
| WebSocket reconnect | New epoch/sequence snapshot, no stale overwrite | Existing core/browser suite; no cloud state substituted |
| Two local metadata clients | Version conflict; reread | Existing HTTP/UX metadata tests |
| Multiple cloud clients/out-of-order delivery | Highest revision wins; transactional receipt | PostgreSQL SQL tests on serialized WASM fixture; native concurrency pending |
| Duplicate or lost ack | Same receipt/one effect | SQL duplicate and committed-then-disconnected worker tests |
| Database export fails | Metadata/outbox rollback together; unhealthy writer | Injected EIO/rename failure tests; inspect storage |
| DDL interruption | Schema and migration marker rollback | Actual disposable PostgreSQL transaction with injected interruption |
| Token expiry/permission revoked | Local401/403/socket closure; cloud revoked hub403 | Existing auth/realtime tests + new cloud revocation test |
| Misheard assistant/partial group action | Reject unsafe input; preserve per-target error; no stale spoken success | Existing AUD-004/009/012/017 tests/browser checks |
| Speech crash/timeout | Unavailable readiness; typed path remains | Source review/existing mocks; native crash/resource/recognition trial pending |
| Clock skew/backward jump | Revisions, not clocks, order metadata; retry delay bounded | New clock and stale/out-of-order tests |
| Pool exhaustion/rollback failure | Safe503/released broken client; no local dependency | New injected pool faults; native pool saturation pending |
| Deployment restart during sync | Durable same operation retried | Journal reopen and commit-loss tests; actual process-kill rig pending |
| Incompatible backup | Preflight rejects before target replacement | Existing AUD-016 tests; new version/schema inspection checks |
| Unauthorized door/cloud request |403/503/404; no dispatch | Existing local permission/gate tests + cloud absent-control route test |
| Old restored journal | Block CLOUD_AHEAD/409 | New stale acknowledgment test; manual reviewed rebase procedure |

## Measurement target

Before testing, BACKEND_MASTER_PLAN.md set a fixture target of100 local metadata edits under10seconds, one pending snapshot and maximum32KiB. The benchmark uses in-memory SQLite with actual journal transactions; it excludes filesystem fsync, network and cloud time. Do not interpret this as physical command or voice latency. Record actual final measurement in the tracker. Real hub CPU/RAM/disk retention/voice latency and India-region PostgreSQL/API latency remain unmeasured.

Staging must add genuine concurrent pg clients, real role logins, pooled/direct URLs, TLS hostname/CA rejection, max-pool saturation, cold start, network cut during commit, supervisor kill/restart, remote503/429, backup/PITR restore and cost/retention checks, always with disposable synthetic data. Physical hardware/TLS release tests require separate authorization; door gate stays off.

scripts/cloud-staging-check.js is an opt-in native pg concurrency/scope smoke harness for a separately approved database and two synthetic enrolled tenants. Its guards are included in npm test. Network execution remains unperformed; it is a tool for the next staging step, not evidence that staging passed.
