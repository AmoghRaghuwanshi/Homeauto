# Failure recovery and operational checks

Local SQLite/MQTT/voice continue without cloud access. Cloud errors neutralize controls and qualify old reports. A reconnect uploads newly captured state; it never resumes expired physical requests. One coalesced telemetry envelope and at most 32 pending gateway results bound local queues. Old consumed IDs are retained 30 days; cloud command deadlines remain at most 20s. Restoring/discarding journals requires quarantine, not blind retries.

| Failure | Implemented behavior / operator response |
|---|---|
| API/Neon/network unavailable | Sanitized retryable error; transaction rollback; browser disconnected state; gateway bounded backoff; local operation unaffected |
| Gateway heartbeat absent | 15s liveness expires independently of board and device status; no new cloud commands |
| MQTT/board lost | Broker/board predicates fail; controls unavailable; fresh controller reports required after reconnect |
| Delayed/duplicate/out-of-order upload | Ticket/age/sequence/digest rejection; no repeated command delivery |
| Lost delivery/redeem/status response | No blind actuation retry; pending deadline becomes expired/uncertain |
| Hub restart/storage fault | Durable claimed IDs become uncertain; final local admission/persistence gates prevent unsafe publication |
| Key expiry/revocation | Worker blocks on authorization failure; rotate privately and preserve journal sequence |
| Local/cloud restore mismatch | Old sequence blocks; turn remote gates OFF and reconcile before rotation/re-enrollment |

## Backup/PITR procedure

Before an approved restore, disable cloud and gateway remote lights, stop the gateway worker through the operator's service procedure and preserve the current local journal/backup and cloud restore-point identity. Restore only the approved target. With the schema-owner tool run `quarantine HOUSEHOLD_UUID --apply`: it atomically revokes household sessions and gateway keys, rejects queued/delivered requests, marks admitted requests uncertain, removes transient intents/tickets and records the quarantine. Restored credentials/requests must not regain authority.

Compare gateway identity/sequence with the retained journal; do not reset to zero, copy another household's journal or overwrite consumed IDs. Resolve any mismatch under an approved recovery plan. Rotate a new gateway key, revoke old credentials and require fresh login/reports. Keep all remote gates OFF during staged verification, then obtain separate authorization before any physical lighting test. Door remains OFF regardless. Never automatically drop/recreate a live database for rollback.

## Observability

`/api/health` is process/startup liveness, not continuous database/hardware readiness. Authenticated owner `/api/system` queries PostgreSQL and returns gateway/boards, qualified broker status, command-state counts/mean controller-report latency and **instance-scoped** uptime/RSS. Local `/api/system` retains broker/database/voice status and adds gateway backlog/error/sequence plus local-hub uptime/RSS. They do not certify the physical actuator. A cold function's memory/uptime is not fleet telemetry.

Sanitized API result logs include request UUID, route template, status/error code and elapsed time for failures/control operations. Authentication/operator audit records are durable, private and bounded; no payload/token/connection-string logging. Gateway journal exposes last acknowledgment, retry/block status and pending-result count. Use existing OS service supervision and Vercel/Neon metrics for restart/crash, memory/compute/storage/connection saturation and request volume. External alerts/notification destinations are not configured or sent by this implementation.

Initial operator thresholds to validate in staging: any admitted command uncertainty, sustained API 5xx >1min, gateway absent >30s, repeated authorization blocks, result backlog nearing32, repeated commands near15s expiry, pool timeout/saturation, or storage/memory >80% allocated capacity. Inspect logs/state without automatically repeating hardware requests. Gas/motion telemetry is not a certified alarm or proof of occupancy/absence; use independent safety devices.
