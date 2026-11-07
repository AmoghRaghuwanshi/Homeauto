# Backend decisions — 2026-11-06

| ID | Decision | Rationale / rejected alternative |
| --- | --- | --- |
| B-01 | Keep local SQLite authoritative | Cloud-primary persistence would put LAN operation and identity behind internet availability |
| B-02 | Preserve synchronous repository API | Current atomic sql.js callbacks cannot safely masquerade as asynchronous PostgreSQL queries |
| B-03 | Optional one-way catalog mirror | Clear consent/authority; no conflicts with hardware truth or remote action replay |
| B-04 | Versioned JSON catalog, four cloud tables | One validated atomic read model; no unapproved cloud user/control/event product |
| B-05 | Raw checked-in SQL + node-postgres | Existing CommonJS service, small schema, no ORM migration burden |
| B-06 | Retain local scrypt sessions | No demonstrated offline equivalent from managed cloud Auth; do not replace working identity |
| B-07 | Separate Node catalog API | Ordinary tested runtime, one-process rate limiting, private DB credentials; Functions remains a future wrapper option |
| B-08 | Durable coalesced snapshot/outbox | Bounded local storage during long outages; missing records carry deletion semantics at a higher revision |
| B-09 | Single enrolled hub per household | Avoid split-brain writers; multi-hub authority transfer is an explicit future operation |
| B-10 | Fail blocked on restore/revision conflict | Never overwrite cloud history silently or label old metadata synchronized |
| B-11 | Forced tenant RLS + trusted API scope | Defense against omitted WHERE clauses; does not pretend a stolen shared SQL credential is harmless |
| B-12 | Pooled runtime/direct migration URLs | PgBouncer transaction mode compatible with one-client transaction-local scope; no session state/named prepares |
| B-13 | Disposable PGlite + fault doubles | Executes actual PostgreSQL SQL/RLS/transactions without accounts/live data; network/PgBouncer/real concurrency still require staging |
| B-14 | Retain existing audit dispositions | 18 software fixes stay verified; three physical/deployment blockers are not cleared by database work |

No Supabase/PostgREST dependency, managed Auth, Object Storage, AI Gateway, Redis, queue service, mandatory external font or cloud telemetry service was introduced. No sensor events are duplicated to cloud. Remote catalog editing/user administration, Functions deployment, managed disaster-recovery automation and a cloud UI remain outside this implementation.
