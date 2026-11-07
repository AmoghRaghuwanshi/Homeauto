# IoT compatibility and physical-safety audit

Date: 2026-11-06. Read-only firmware/backend tracing; no physical commands, scans, MQTT connections, service changes or flashing. Issue details and line references are authoritative in [BUG_REPORT.md](BUG_REPORT.md).

## Verdict

**Wire vocabulary is preserved. End-to-end secure deployment compatibility is not established.** AUD-002 prevents the supplied anonymous sketches from using the supplied authenticated TLS broker template. AUD-001 independently blocks door release: connectivity failure can delay the local relock indefinitely. Neither concern should be solved by bypassing authentication or enabling the door gate early.

## Board and pin matrix

| Feature | ESP32 source contract | Active server contract | Assessment |
|---|---|---|---|
| ESP32-A light relays | Four active-HIGH outputs GPIO 4, 5, 18, 19; boot LOW/off | light-1 through light-4, type light, board lights | IDs, ordering and action polarity preserved |
| Gas | ADC GPIO34; raw 0–4095 mapped linearly to gas_ppm 0–1000; alert at mapped value >=400 | sensor-gas; bounded integer raw/gas_ppm and boolean alert | Payload compatible; value is uncalibrated, not defensible measured PPM |
| Motion | PIR GPIO27; hold detected for 5 seconds after last HIGH; publish only when boolean changes | sensor-motion; boolean motion, current observation expires | Compatible but no initial/periodic clear report; no absence guarantee |
| Door relay | GPIO4; HIGH unlock, LOW lock; nominal 5-second unlock | door-1, actions lock/unlock; gate default off | Command polarity unchanged; AUD-001 |
| RFID reader | RC522 SS5, RST21; default SPI 18/23/19; uppercase colon UID | Canonical 4/7/10-byte UID; server-side authorization | Format compatible; UID is cloneable identity, not cryptographic proof |
| Door LEDs/buzzer | Red15, green16, buzzer17; deny flashes red using blocking delays | deny emitted for rejected scan | No unsupported buzzer control exposed |
| Transport | WiFiClient/1883/anonymous in both sketches | Credentials required; remote MQTT TLS; secure broker template loopback8883 | Incomplete migration AUD-002 |
| Mechanical feedback | No bolt/contact-position sensing | physical_verified=false throughout | Correct limitation; physical fail mode and egress untested |

Sources: firmware/light_controller/light_controller.ino:18–49, 82–217, 219–282; firmware/door_security/door_security.ino:20–57, 94–138, 153–208, 224–275; server/lib/registry.js:1–10.

## Topic/payload/QoS comparison

| Direction | Exact topic(s) | Firmware behavior | Backend behavior |
|---|---|---|---|
| Hub → A | home/light/1/command through home/light/4/command | Accepts on, off, toggle; applies corresponding output | Publishes explicit on/off. API toggle resolves only from a fresh report. qos0, retain=false. |
| A → hub | home/light/1/status through home/light/4/status | on/off, retained publish after command, connect and every30s | Exact known ID/status validation; live report can reconcile pending command |
| Hub → B | home/door/1/command | lock, unlock, toggle_lock, deny | Only explicit lock/unlock through command policy; deny for rejection. toggle_lock not exposed. qos0, retain=false. |
| B → hub | home/door/1/status | locked/unlocked retained after action/connect/30s; denied retained after LED flash | denied is logged as an event and does not become lock position |
| B → hub | home/door/1/rfid | Nonretained JSON uid and timestamp=millis(); minimum scan interval2s | Rejects retained scans, canonicalizes UID, server lookup, 2s per-UID cooldown; does not authenticate millis timestamp |
| A → hub | home/sensor/gas/data | Nonretained JSON raw, gas_ppm, alert every2s | Validates types/ranges, 10s state age, persistent alert episodes; latest flush up to10s |
| A → hub | home/sensor/motion/data | Nonretained JSON motion on transitions only | Validates boolean; no manufactured fresh clear from board heartbeat |
| Boards → hub | home/esp32/lights/online and home/esp32/door/online | Retained true at connection; retained QoS1 false LWT | Accepts true/false/1/0; retained true does not establish current liveness; false marks unavailable |

Ordinary PubSubClient publish calls are QoS0; the firmware LWT explicitly uses QoS1. The hub subscribes through wildcard filters but validates exact known topic/ID/payload combinations in Home.ingest. The wording “exact topics” in documentation refers to accepted hardware topics, not a literal absence of wildcard subscriptions.

**Retained nuance:** publishing with retain=true does not make every delivery to an already-established subscriber a replay. MQTT retained replay on subscription is distinguished by the received retain flag. Home.ingest correctly treats retained replay as history and a live nonretained delivery as current evidence. No mismatch is inferred solely from retained firmware status publication.

Online is announced at connect, not periodically on the online topic. Live status/gas reports refresh board lastSeen. Thus the server can eventually establish liveness after its own reconnect without trusting an old retained online=true; relays/door may wait until the next heartbeat. The simulator's online-only heartbeat is a simplified fixture, not an exact firmware emulator.

## Complete command lifecycle

1. A light button or protected door flow calls the same-origin REST client. The client does not change authoritative device status. Controls use roles, connectivity and pending state.
2. app.js validates body fields, session, Origin/CSRF and mutation rate. Manual unlock additionally needs can_unlock, fresh password reauthentication and a short-lived session/device challenge.
3. Home.request validates the fixed registry/action, idempotency, availability, persistence and one pending command per device. Voice/text unlock is rejected independently of the intent parser.
4. The repository durably records the accepted request and consumes the unlock challenge before publication. A fresh already-matching non-unlock state is an explicit no-op, not a new physical confirmation.
5. The broker publishes one explicit action with QoS0, no retained flag, clean session and no QoS0 offline queue. There is no application reconnect replay.
6. Firmware receives the legacy string and writes the relay output. Its status reflects software/relay-command state, not measured electrical load or mechanical position.
7. A fresh, nonretained matching report before the 8s light/3s door deadline changes the command to observed. Correlation is temporal because the wire has no command ID. Unrelated matching reports can therefore satisfy this weak evidence.
8. The server persists the observation and broadcasts an authenticated full snapshot. Device controls remain pending until evidence arrives; expiry/disconnect/restart becomes uncertain, with no automatic retry.
9. Frontend/TTS present results. This last step contains AUD-009, AUD-011 and AUD-012: stale replay, current-looking cached outage labels and omitted partial failures.

No new wrong-ID mapping or MQTT command-string regression was found. Packet loss can still lose a QoS0 action. TCP/network buffering and legacy firmware without command expiry mean the design cannot promise hard delivery deadlines or exactly-once execution. These are protocol limitations, not proof of observed unsafe delivery.

## Door and RFID boundary

The door gate, fresh password, explicit confirmation, single-use challenge and backend refusal of assistant unlock are meaningful safeguards. RFID grants use the same Home.request service after an authorized database lookup and durable scan log. Owner-only card administration is reauthenticated; revocation is saved before response.

Those safeguards do not protect a broker that accepts unauthorized command publishers. Firmware directly accepts unlock/toggle_lock and has no application-level authentication, command nonce or expiration. A malicious retained command or a replayed/cloned UID is a deployment/protocol risk. Actual broker ACL enforcement, credential security and installed firmware were not tested. The current hub rejects retained scan packets, but a republisher can label captured UID data as a new nonretained message if it already has the necessary broker permission. The legacy millis timestamp is not a trustworthy wall-clock freshness signal.

Do not describe the door as physically locked solely because a report says locked. Do not treat denied as locked. Acknowledging a gas alert must not clear the sensor episode. No browser notification is a substitute for independent gas detection or safe egress.

## Required isolated and supervised validation

First use an isolated broker with unique test principals and indicator loads/emulated firmware: ACL allow/deny in both directions, no anonymous access, CA failures, retained replay, status-heartbeat startup, lost/late/duplicated reports, disconnect/restart and no queued command replay. Test disk failure before command persistence and ensure zero grant publication.

Prepare an authorized nonblocking TLS firmware build while preserving pins/topics/payloads. Only with separate physical authorization and supervision should a safe fixture verify unlock/relock timing through Wi-Fi/broker outages, repeated denial/scan traffic, power interruption, startup polarity, relay behavior and actual lock fail mode/egress. Verify gas/motion with safe signal simulation; do not release gas.

The present audit certifies neither installed-device behavior nor household safety.

