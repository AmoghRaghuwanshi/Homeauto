# Outbound gateway and browser synchronization

Implemented by `server/online/gateway.js`, optional local lifecycle wiring, `server/online/{protocol,store,app}.js` and `public/js/{api,state,cloud-state}.js`. Household routers need no public IP, inbound MQTT exposure or cloud database connection on the gateway. Existing MQTT topics/payloads, fixed seven-device registry and local WebSocket/voice runtime remain unchanged.

## Transport decision

Current Vercel WebSockets are supported, instance-pinned and bounded by function duration; multi-instance durable fanout would need shared infrastructure. This initial implementation uses short HTTPS requests and shared PostgreSQL state: browser polls every 2s foreground/15s hidden; gateway polls at roughly 2s healthy with bounded exponential backoff/jitter to 30s. Request timeout, abort on shutdown and single-flight execution prevent overlapping worker loops. PostgreSQL remains the authority across API instances. Tests exercise loopback loss/retry and shared-instance state; 2s is a configured interval, not a measured internet SLA.

No cloud WebSocket endpoint was added, so cloud-socket termination is not applicable. Existing local WebSocket reconnect remains covered by regression tests. See [architecture](CLOUD_ARCHITECTURE.md) for current official Vercel sources and scaling/cost implications.

## Enrollment and protocol

After separate approval, use `enroll-gateway HOUSEHOLD_UUID PRIVATE_OUTPUT_PATH --apply`. A random 256-bit token is written once to an exclusive file outside the project; only its SHA-256 hash and expiry go into PostgreSQL. Restrict file permissions/Windows ACLs before use. Key lifetime is 30 days (schema maximum 31); at most two active keys permit rotation. `rotate-gateway-key HOUSEHOLD_UUID GATEWAY_UUID PRIVATE_OUTPUT_PATH --apply`, verify fresh exchange, then `revoke-key KEY_UUID --apply`. Never print or commit the output file/token.

Local environment names are in root `.env.example`. Set gateway enabled, explicit `telemetry-v1` consent, lowercase household/gateway UUIDs, private token and HTTPS origin. Gateway receives no DATABASE_URL. Legacy catalog mirror and the new transport cannot run together. Physical door flag must stay OFF. Remote lights additionally require local remote enable, secure-gateway approval, MQTT enabled and authenticated MQTTs; cloud has its own two independent default-off gates.

Each upload first gets a 10s single-use server ticket. It then captures **fresh** metadata, connectivity, qualified report ages, gas/motion alerts and at most 32 durable command results. Version 1 messages carry UUID event/ticket/gateway/household/epoch, positive monotonic sequence and canonical digest. Maximum upload is 64KiB; registry/shape/ranges/statuses are validated. No RFID IDs, audio, password hashes or user records are uploaded. Ticket transit time is conservatively included in age, so replayed or delayed captures cannot regain freshness.

The local versioned journal stores one coalesced outbox, monotonic sequence and consumed command IDs/results. Lost telemetry is replaced with a newly captured envelope, never an aged full snapshot relabeled current. Cloud sequence/digest/inbox checks reject altered duplicates and old ordering. An exact retry returns no new command leases. Lower restored local sequence blocks synchronization until operator reconciliation. Key rotation does not reset sequence.

Gateway online (15s), broker connected, board online (60s), report freshness (gas 10s/other supported reports 65s), retention and epoch are separate predicates. A healthy gateway cannot make an offline board/device current. Browser freshness timers also neutralize aged controls without waiting indefinitely for another poll. Foreground recovery refreshes state; old cursor/sequence responses and stale preference revisions are ignored.
