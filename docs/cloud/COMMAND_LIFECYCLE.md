# Cloud light command lifecycle

Only on/off lighting is implemented remotely. Toggle input is resolved once to an absolute action against a fresh report. Remote door requests always fail, sensors remain read-only, and both cloud and gateway light gates default OFF. A simulated publication or ESP32 status is never physical-actuation verification.

| State | Meaning |
|---|---|
| queued | Authorized request durably recorded; no MQTT publication implied |
| delivered | Short-lived lease issued once to the assigned gateway; admission still required |
| pending_observation | Gateway redeemed admission and may attempt one local request; no report confirmation yet |
| observed | A matching qualified controller report was reconciled; `physical_verified=false` |
| rejected | Permission/policy/freshness/admission prevented a permitted attempt |
| failed | A known local operation failure was reported |
| expired | Queued deadline elapsed before delivery |
| uncertain | Delivered/admitted outcome could not be established before deadline or after interruption |

`accepted` is the HTTP 202 result, not an extra stored success state. Default expiry is 15s, schema ceiling 20s. Requests include UUID command/idempotency IDs, actor/session hash, device, action, timestamps and request digest. Reusing a key with changed input fails. One active request per light plus household transaction locking prevents racing on/off requests. Controller role, fresh report/board/broker/gateway, policy and rate limits are checked server-side; session and membership are checked again before lease/admission.

Gateway delivery is not retried as a fresh lease. The gateway durably records consumption **before** calling the single-use redeem endpoint, then verifies the server's relative remaining budget against monotonic round-trip time and current local conditions. The existing Home request path has a final admission callback immediately before publication. MQTT remains QoS0, non-retained with the original topic/action strings. It does not have a command-ID acknowledgment protocol.

An ambiguous timeout is terminal uncertainty, not permission to republish. Local process restart changes claimed records to uncertain. Lost cloud delivery/redeem responses, expiry, logout/role revocation before admission, duplicate envelopes and stale cached state are tested. No design can retract a publication already admitted during a simultaneous logout/network change; stop subsequent requests and report uncertainty. At-most-once local admission deliberately sacrifices delivery on an ambiguous failure. Exactly-once physical operation is not claimed.

The UI distinguishes “Queued for home hub,” “Waiting for home hub,” “Waiting for controller,” “Request expired/rejected/failed” and “Not confirmed.” Fresh status labels always describe controller reports. Door text retains the unsensed physical-position warning. Commands are not persisted as authoritative hardware state in localStorage.
