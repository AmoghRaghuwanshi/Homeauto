# Neon evaluation — checked 2026-11-06

## Architecture comparison

| Option | Offline commands/auth/voice | Complexity | Decision |
| --- | --- | --- | --- |
| Local SQLite, no cloud | Complete local operation | Lowest | Supported default; no configuration required |
| Local hub + optional Neon metadata mirror | Complete local operation; cloud can fail independently | One consented exporter and a small isolated API | Selected extension |
| Cloud-primary database + local gateway | Requires replicated identity, command authority and conflict/recovery machinery | Highest; threatens local availability | Rejected for this assignment |

Cloud-primary PostgreSQL cannot safely stand in for the existing synchronous sql.js transaction API. A wholesale async repository rewrite would create risk without solving a current local requirement. The cloud is a versioned read model, not a second command owner.

## Verified services and fit

| Capability | Current provider capability | HomeAuto choice |
| --- | --- | --- |
| PostgreSQL | Standard PostgreSQL access, branching and pooled/direct endpoints | Optional selected metadata only; node-postgres and checked-in SQL |
| Functions | Long-running Node.js 24 JS/TS HTTP, WebSocket/SSE; branch-scoped; can be evicted/restarted | Technically suitable for a future catalog API wrapper; not selected or deployed |
| Auth | Managed Better Auth keeps users/sessions in PostgreSQL and branches them | Retain local scrypt/session implementation; no proven offline equivalence for replacement |
| Object Storage | S3-compatible branch-aware storage | Unneeded: no approved cloud files or audio |
| Realtime | SQL live queries, currently beta | Unneeded: local WS remains authoritative for device reports |
| AI Gateway/Data API | Optional provider primitives | Unneeded; no cloud AI or browser database surface |

Provider sources: [Functions overview](https://neon.com/docs/compute/functions/overview), [Managed Better Auth](https://neon.com/docs/auth/overview), [Object Storage](https://neon.com/docs/storage/overview), [Realtime](https://neon.com/docs/realtime/overview). These describe capabilities, not a HomeAuto integration test.

Functions currently use 2048 MiB fixed memory. First response and silent-stream heartbeat limits are 15 minutes; waitUntil work also has a 15-minute limit and is not a durable job runner. Shutdown gives SIGINT followed by a five-second deadline. Isolate memory is lost on eviction and not shared across replicas. The documented default account concurrency is 100. Therefore any future Functions wrapper must persist receipts in PostgreSQL, verify hub tokens before work, keep a small per-isolate pool, and move rate enforcement out of process memory before scaling. Native Python/Kokoro and continuous LAN supervision do not belong there. [Runtime limits](https://neon.com/docs/compute/functions/reference/runtime-limits).

## Hosting, region and connections

The implemented catalog API is ordinary Node/Express and can run under a conventional supervisor with an HTTPS reverse proxy. This gives a predictable single-process rate limiter and no provider-specific deployment dependency. A Functions wrapper would need its runtime export/auth/deployment smoke tests; none is claimed here. Local Vosk/Kokoro, MQTT, SQLite and device safety remain on the household machine in either case.

Functions are currently available in Ohio, N. Virginia, Frankfurt and Singapore. For an India-based household, Singapore is a reasonable candidate for measurement, not an asserted latency result. PostgreSQL regions and existing project placement must be checked before provisioning; project region cannot be changed in place. [Functions availability](https://neon.com/docs/compute/functions/overview), [Regions](https://neon.com/docs/introduction/regions).

Use a pooled URL for API traffic, direct URL for reviewed DDL/dumps. Transactions pin one pg client; tenant context uses transaction-local set_config, with no session state or named prepared statements. Pool maximum is four, acquisition three seconds, statement five seconds, idle ten seconds. No connection string reaches the hub or browser. TLS certificate/hostname verification cannot be disabled by URL sslmode parameters in this adapter. [Neon pooling](https://neon.com/docs/connect/connection-pooling), [node-postgres SSL](https://node-postgres.com/features/ssl).

## Costs and observability

The current pricing page lists Free at 100 CU-hours and 1 GB PostgreSQL storage per project; Launch at $0.106/CU-hour and $0.35/GB-month. Functions/Object Storage are separately metered; typical-spend examples are not quotes or all-in estimates. Recheck before purchase. No plan was purchased and no monthly HomeAuto cost was measured. [Pricing](https://neon.com/pricing).

Only metadata changes produce cloud writes. There is no sensor polling, keep-alive query loop, raw audio storage or cloud event firehose. The worker returns immediately when its outbox is empty, allowing database idle suspension. Monitor compute, storage, receipts growth, egress and branch expiration; set a spending alert before deployment. Keep logs to status codes, queue counts and request IDs, never tokens, SQL parameters or connection errors. Branch logs/metrics and API supervisor logs complement local owner diagnostics; these operational monitors are deployment work.

## Tooling provenance

Official neon and neon-postgres skills were installed using npx skills add neondatabase/agent-skills -g -a codex -s neon -s neon-postgres -y, outside HomeAuto, and their actual SKILL.md files plus branching reference were read. Installation was verified at C:/Users/Amogh/.agents/skills/{neon,neon-postgres}. No Neon CLI/account/MCP connection or database credentials were available. No account, claimable database, project, branch or deployment was created. Hallmark/Unslop were retained from the preceding verified frontend work. No skill files entered production frontend code.
