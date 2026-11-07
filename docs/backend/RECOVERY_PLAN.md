# Recovery and incident procedures

These are operator procedures; this assignment did not restore, delete or cut over a household database or cloud branch.

## Local outage or storage failure

Local authoritative state remains in SQLite. A cloud outage must not trigger local restore or alter a hardware report. Network failures leave one durable catalog pending with bounded retry; local light commands/auth/voice remain independent. A local storage/export error rolls memory back, marks repository unhealthy and refuses unsafe writes. Inspect disk space, filesystem permissions and the original file/backup; do not clear a fault by inventing a successful command result.

After actual power loss, controller reports are unverified/stale until a fresh current-epoch nonretained observation and board evidence arrive. Accepted/published commands become uncertain on restart and are not replayed. Sessions/challenges are invalidated. Door firmware may fail to relock while blocked on network; cloud recovery cannot fix that physical safety defect. Keep the physical gate off.

## Backups and local restore

Existing dailyBackup retains seven named daily files and SHA256 sidecars. Preserve independent encrypted offline copies; seven on-disk files are not off-machine disaster recovery. Legacy activity is retained, newer activity/resolved alerts follow the existing90-day policy. A catalog mirror is not a backup for users, RFID, logs, models or hardware evidence.

Use scripts/recovery.js inspect on a coherent private backup. Actual restore requires stopping the household writer, checking the lock/target/source, preserving the previous file and separately authorizing the target. Existing restore preflight migrates/checks a disposable copy before replacing any target (AUD-016). It rejects incompatible/oversized/newer-schema/bad-checksum data. Do not point recovery backup/open operations at the protected original for experimentation.

Disable HOMEAUTO_CLOUD_SYNC_ENABLED before any restore, inspection with a mutating repository, application rollback or hub identity change. Restore tools do not automatically reconcile cloud journal revisions. Keep native/device tests off unless separately authorized.

## Journal/cloud reconciliation after restore

A backup can contain an old last_revision or already delivered operation. Duplicate same-operation delivery is safe; reused revision/different content is blocked409; stale newest snapshot blocks CLOUD_AHEAD. Neither condition authorizes replacing local data with a cloud copy or resetting the journal silently.

Recovery requires an operator to compare a **restored disposable clone** with an authenticated cloud metadata read, confirm household/hub enrollment and preserve the cloud catalog/receipts plus local backup. Choose local catalog authority explicitly. If the same enrolled hub is retained, a reviewed offline transaction on the clone can advance cloud_sync_state.last_revision above every cloud receipt/catalog revision, clear catalog_hash/capture_error and remove pending outbox work; reopening with consent captures a new complete snapshot at the next revision. Do not edit hardware/session/RFID tables or downgrade the cloud revision. Verify counts/checksums and the resulting operation before separately approving replacement of a real target. No automatic rebase CLI is provided; this rare authority repair remains manual and requires target-specific review.

If identity/enrollment has changed, stop and review the ownership transfer. One hub per household is enforced; rotating an ID is not an automatic transfer. Disabling sync is always the safe way to continue local operation while investigating. Turning sync off does not erase a previously uploaded catalog. Privacy deletion must be performed by a separately authorized cloud administrator, including receipts/derived backups according to retention policy.

## Cloud API/PostgreSQL outage

The API returns sanitized503 for DB/pool failure. The hub stores only safe error enums, retains pending metadata and backs off. Retry after service/database recovery. Commit with lost response is handled by the same operation ID/digest receipt; never generate a new ID merely because the acknowledgment was lost. Database transaction failure rolls catalog and receipt back together. Migration DDL and its version marker also roll back together; retry an identical reviewed migration after identifying the target. Checksum drift requires a new migration, not editing history.

For API source rollback, disable outbound sync first and retain the additive schema. Avoid destructive DROP/branch reset. Provider point-in-time restore/retention availability depends on the selected plan and must be verified before deployment. After any cloud restore, reconcile revision/receipt history in staging before resuming; a rolled-back cloud inbox can lose deduplication history. Independent pg_dump/restore drills should use the direct URL and secure encrypted destinations. Neither cloud PITR nor dump/restore was run here.

## Credential or privacy incident

Revoke the affected hub in the database, remove/rotate its private registry token and coordinate an external hub secret update; restart/reload the API under the operator's deployment process. Revoke compromised database credentials and review all tenant records because shared-credential compromise can bypass trusted RLS context. Disable uploads during investigation. Do not log or paste tokens/URLs/passwords/RFID values. AUD-003's historical TLS key remains compromised; separate certificate/key rotation and public-history handling are still required. No credentials were rotated during this assignment.

Native speech worker exit/timeout leaves readiness unavailable and typed input usable. The existing worker is not automatically respawned; investigate checksums/paths/resources and restart the local service only under an operator-approved maintenance action. Audio is RAM-only and disappears. Recognition accuracy/CPU/RAM/startup measurements still need native tests on the target hardware; no cloud fallback should be introduced during recovery.
