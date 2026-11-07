# Catalog synchronization v1

Implemented one-way metadata replication, disabled by default. Only local authorized APIs edit the catalog. There are no inbound edits, remote controls, cloud preference overrides or command replay. Multiple local clients retain existing optimistic versions; one enrolled hub owns the cloud household catalog.

## Operation and response

POST /v1/sync/catalog receives exactly schema_version:1, household_id, hub_id, operation_id, revision, catalog, digest. IDs are lowercase UUIDs supported by the existing UUID validator; revision is a positive JavaScript-safe integer. digest is SHA256 over the canonical envelope excluding digest. Object keys are sorted, arrays retain order; local projection sorts room/device IDs. No timestamps decide ordering. HTTP body maximum is 32,768 bytes, rooms maximum 100, exactly seven supported devices, every device references an included room. Extra fields at every level are rejected.

Response is exactly operation_id, revision, digest, status (accepted or stale). It confirms a **metadata transaction**, never hardware execution. GET returns {metadata:null|{schema_version:1,source:cloud_metadata,revision,catalog,received_at}}. No browser consumes this as device state.

## State transitions

1. Enabling requires HOMEAUTO_CLOUD_SYNC_ENABLED=1, consent=catalog-v1, stable household/hub IDs, HTTPS origin and a random private hub token. Existing journal identity mismatch stops startup rather than silently sending to a different household.
2. Metadata changes capture a full catalog in the local transaction, increment its durable revision and replace earlier pending snapshots. Telemetry/auth/command writes leave the catalog hash unchanged and enqueue nothing. Source storage failure rolls back metadata and journal together.
3. Worker is asynchronous, single-flight and checked every ten seconds. Empty queue means no network/database request. Each upload/reply is limited to five seconds; redirects are forbidden and HTTPS is required. Response bodies are capped at 2 KiB. A stop aborts the in-flight request and leaves unacknowledged work durable.
4. Cloud authentication derives household/hub scope from the private registry, never from client claims. A transaction sets local RLS scope, acquires a household advisory lock and checks active enrollment.
5. Existing operation ID plus same digest/revision returns the prior receipt. Reuse with different content returns 409. Different operation at a used revision also returns 409. A lower revision is recorded stale without changing the catalog. A newer revision atomically replaces the whole catalog and records its receipt.
6. Matching accepted acknowledgment writes the local inbox and deletes only that operation ID. An old acknowledgment cannot erase a newer replacement. Newest local operation acknowledged stale is blocked CLOUD_AHEAD; restored data must not be mislabeled synchronized. Older in-flight stale responses can be recorded without deleting newer work.

Full-snapshot replacement is the deletion mechanism: a removed empty room is absent at the newer revision, so its cloud representation disappears atomically. Old uploads cannot resurrect it. Individual permanent tombstone rows are unnecessary because the complete catalog and its revision are retained. Seven physical device identities cannot be deleted through this protocol.

## Failure handling

Transport failures and408/425/429/5xx use exponential retry from one second with ±20% jitter and a hard five-minute delay cap; polling may make actual retry later. A backward wall-clock jump clamps a far-future retry to five minutes. Revision comparisons never use wall clocks. Other4xx responses are blocked for operator review. Error strings are enums; raw fetch/SQL errors, URLs and headers are never persisted.

Commit plus lost acknowledgment is safe: retry the same operation. New metadata can coalesce past an unacknowledged snapshot because it is a complete replacement with a higher revision. Deployment restart reads the durable outbox again. SQL failure rolls back receipt and catalog together. Unsupported protocol versions fail 422. Missing or invalid acknowledgments leave the queue pending. Invalid local envelope blocks INVALID_LOCAL_CATALOG.

Invalid/oversized local catalog blocks only mirroring and clears obsolete pending data. It does not add a room limit to the local product. A later valid projection queues a fresh snapshot. State/diagnostics are owner-only under /api/system.cloud_sync, with disabled, pending, blocked or idle state; idle means no pending catalog, not cloud reachability or physical success.

## Privacy and consent lifecycle

Catalog names reveal household organization. Enrollment/consent are operator-managed environment settings; no misleading cloud switch was added to Settings. Disable sync to stop outbound work; this does not erase a previously uploaded copy. Revocation/removal of cloud enrollment/data requires a separately authorized administrative action. No raw audio, password hashes, session/CSRF tokens, RFID IDs/decisions, activity details, sensor data, physical reports or command records are in the format.

A restored older journal may collide with cloud history. Disable sync and follow RECOVERY_PLAN.md; never auto-reset IDs/revisions, replay a physical action or accept cloud status as a new local observation. Bidirectional metadata edits, multiple active hubs per household, and remote resident access require a separate protocol version and authorization design; they are intentionally unavailable.
