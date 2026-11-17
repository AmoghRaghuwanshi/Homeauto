# IoT and offline software contracts

> Architecture revision2026-11-14: AI runs on the ESP32-connected home hub. Remote clients will relay voice/conversations to that hub and receive its responses; the hub must be active and connected for remote voice and control. Models are installed on the hub only. See [the revised execution contract](../cloud/HUB_AI_EXECUTION_PLAN.md). The implementation descriptions below remain current/historical evidence as dated; remote audio forwarding is not implemented yet.


## Current revalidation and single-board plan — 2026-11-14

Baseline source: `f9c2b36ac9206571a3275c1cea93c9b1338d358d`. User now specifies one ESP32 for all lights, gas/motion and RFID door features, Wi-Fi commands, a hub/AI laptop and a separate presentation laptop, with optional public website access. This changes the deployment topology from the two sketches below. The existing source cannot yet be signed off for this physical setup.

### Source map and review scope

All240 tracked paths were inventoried. Active entrypoints and the device/voice execution paths were traced; this is not a claim of a new line-by-line review of all historical reports, dependencies or every test. Inventory with per-file hashes is retained outside source at `D:/homeauto-audit-tools/iot-ai-20261114/tracked-inventory.csv`.

| Area | Files and responsibility |
|---|---|
| Active browser | `public/index.html` loads `theme-bootstrap.js`, `main.js`, modular CSS. `views/components/navigation/preferences/i18n` own presentation; `api/state/cloud-state` own transport and reports; `demo/gateway-ui` own simulated home and enrollment. `voice-controller/capture-processor` own microphone capture. |
| Local entry and API | `server/server.js` → `lifecycle.js` → `app.js`, `auth/sessions.js`, `realtime.js`; local accounts/CSRF/Origin, SQLite repository, WebSocket snapshots and local voice. |
| Physical authority | `services/home.js`, `lib/registry.js`, `mqtt/broker.js`: seven logical devices, availability, durable admission, RFID authorization, MQTT publication and temporal report reconciliation. |
| Persistence | `db/repository.js`, `db/maintenance.js`: local single writer, transactions, commands, cards, metadata, recovery. Never substitute stored desired state for measured physical state. |
| Speech | `services/assistant.js`, `voice/intent.js`, `speech-service.js`, native workers, assets/manifest: bounded transcript interpretation, reviewed commands, owned replies, local verified model assets. |
| Public/cloud | `api/index.js` and `server/online/{app,auth,db,store,protocol,gateway,gateway-setup,migrate}.js`, migrations001–004: account/home isolation, outbound exchange, enrollment and expiring remote commands. Cloud speech endpoints explicitly return LOCAL_VOICE_ONLY. |
| Optional catalog mirror | `server/cloud/*`: a separate older catalog/sync mode; do not enable alongside the online gateway. |
| Legacy/unwired implementations | `public/js/app.js`, old device/log/voice/websocket helpers, `server/config/config.js`, old routes/MQTT/voice/database helpers are not the active entrypoint chain. Avoid changing these and assuming the active app is repaired. `voice/whisper.js` is benchmark-only. |
| Hardware/deployment | Two `.ino` sketches; `deploy/*` broker/ACL/environment templates; lifecycle config and operator/TLS/recovery scripts. Templates require actual installation values. |
| Verification/docs | `server/tests`, browser/native speech scripts, publication/build checks; current audit2, remediation tracker, UI rebuild report and historical architecture/operations documents. Older audit findings must be checked against subsequent fixes. |

### Confirmed physical integration gaps

1. **One board is not implemented.** Light relays useGPIO4/5/18/19; the other sketch uses door relay4 and RFID SS5/SCK18/MISO19/MOSI23/RST21. These collide if sketches are combined. Implement a new all-in-one profile after confirming the board pinout and loads; retain the two original profiles for rollback/reference. A compile target cannot prove an actual wiring match.
2. **Broker and firmware do not authenticate compatibly.** Sketches use plain WiFiClient/1883 and null username/password, while the active broker client requires credentials and TLS for non-loopback. The broker template listens on loopback8883 and cannot be reached by ESP32 Wi-Fi unchanged. Provision a private LAN TLS listener, CA validation and distinct hub/combined-board principals; do not enable anonymous access. Wi-Fi SSID/password and broker address in sketches are placeholders/stale installation assumptions.
3. **Door timer is blocked by networking.** `door_security.ino` retries MQTT in a while loop with5-second sleeps and invokes Wi-Fi reconnect before relocking; denied feedback also blocks. A lost broker after unlock can defer the five-second deadline indefinitely. New firmware must service relay deadlines independently, use bounded network operations/nonblocking indicators, explicitly handle repeated unlock and millis rollover, and boot to the verified safe relay level. Keep physical door disabled until supervised acceptance.
4. **Sensor acquisition blocks during reconnect.** The light sketch has the same blocking reconnect pattern. Motion is emitted only on change: boot with no motion emits no clear snapshot, and an unchanged observation ages stale after65s in the backend. Publish actual current motion on boot/reconnect and periodically, preserving transition semantics and never deriving a clear reading merely from board heartbeat.
5. **Reported state is not sensed load/lock position.** Firmware reports its relay variable; no contact/position feedback exists in these sketches. MQTT status is temporally correlated, without command IDs in firmware. Preserve `physical_verified=false`; bench observation must validate the actual load. The linear gas ADC-to-PPM mapping is not calibrated concentration measurement.
6. **Frontend race findings remain open.** SM2-01 through04 still require remediation before expanding physical/voice use. Current passing tests do not cover or close the counterexamples already recorded in `STATE_MACHINE_AUDIT_2.md`.

### Combined-board implementation contract

Keep existing seven device IDs and command/status payloads. Decide explicitly how a single physical board maps to the two existing logical board groups: a compatibility profile can publish both existing online topics while the broker publishes two disconnect reports on connection loss through a trusted bridge, or introduce a versioned single-board health mapping end-to-end. One MQTT connection has only one LWT; claiming both logical groups have independent LWTs would be incorrect. Any bridge or mapping change needs tests for stale health and failure propagation. Do not simply share two board passwords or declare both groups online from cached data.

For a classic ESP32-WROOM dev board, the engineering team can evaluate reserving SPI18/19/23, separate RFID SS/RST, unique relay outputs, ADC1 for gas and an input for PIR; this report intentionally does not prescribe unverified wiring. Confirm board-specific flash/PSRAM/input-only/strapping constraints, voltage levels and relay polarity before assigning pins. Use a low-voltage indicator load for first tests. Keep firmware credentials in excluded local provisioning files and pin ESP32 core, PubSubClient, ArduinoJson and MFRC522 versions.

### Verification executed this pass

- Full local suite: **172 tests passed,0 failed**, Node22, approximately31.4seconds. MQTT, door, gateway and cloud sync disabled; test fixtures use disposable storage/mocks. Log: `D:/homeauto-audit-tools/iot-ai-20261114/software-tests.log`.
- Native Vosk/Kokoro workers: hash verification and English/Hindi synthesis/decoding completed using an in-memory repository, synthetic speech and no broker. English matched; Hindi lost room number. A successful worker probe is **not** an accuracy pass. Separate artifacts preserve previous measurements.
- Development host inspected: i5-12450H,15.7GiB RAM. No serial ports enumerated at inspection; this does not rule out a Wi-Fi-only board. No network device discovery/physical actions were attempted. Arduino CLI was not available on PATH; no firmware compile or flash was claimed.
- Source audit confirms query/negation and historical/partial-response repairs from the earlier audit already exist; do not resurrect those closed findings just because the historical AI audit lists them.

### Required physical acceptance sequence

1. Record one-board BOM, wiring, safe relay levels, firmware/core/library versions and certificate fingerprints. Verify low-voltage indicator bench before connecting real loads/lock; verify independent mechanical egress for any door demonstration.
2. Verify broker auth/ACL/CA failures with disposable principals; one board may access only its declared topics and the hub retains authorization. Test retained snapshots separately from fresh reports.
3. Test each light individually and all-off; verify no unintended channel changes, startup/power-cycle levels and no replay after hub/broker/Wi-Fi restart. Observe actual outputs independently of the dashboard.
4. Test authorized, revoked, unknown and repeated RFID scans. Validate automatic relock with broker/Wi-Fi unavailable, sustained denied scans, network stalls and rollover clock fixtures. Do not use model speech as an unlocking credential.
5. Test PIR initial clear/detected/held/recovered reports; gas raw ranges and stale/unplugged behavior. Sensor-disconnect detection may require hardware diagnostics beyond current payloads. Do not stage gas leaks for a software demo.
6. Run laptop B over trusted local HTTPS with internet disconnected, keep laptop A awake, exercise typed/voice/manual paths, verify cancel/no-speech and model crash leave controls usable. Then separately test website telemetry and permitted commands with internet restored and all explicit gates satisfied.

Physical acceptance and real human accent validation remain outstanding. The detailed offline-AI delivery plan is maintained in `HomeAuto_UIUX_Docs/OFFLINE_AI.md`; the approved UI is preserved.

## Historical verification — 2026-11-07

2026-11-07. Firmware and broker templates are unchanged. No sketch compiled/flashed, board connected, real MQTT/RFID operated or GPIO sampled. Tests use fake publishers/disposable memory SQLite/PG and simulated nonretained reports.

| Contract | Preserved software evidence |
|---|---|
| Registry | light-1..4,door-1,sensor-gas,sensor-motion; unsupported IDs/provisioning/actions rejected |
| Lights | ESP32-A relay GPIO4/5/18/19; home/light/1..4/command on/off/toggle vocabulary unchanged; gateway resolves cloud toggle once to absolute on/off |
| Door/RFID | ESP32-B relayGPIO4, RC522 SS5/RST21, original SPI assignments; home/door/1 command/status/rfid and board online topic unchanged |
| Sensors | Original gas/motion pins and home/sensor/gas/data,home/sensor/motion/data payloads unchanged; read-only controls |
| Local delivery | Auth/role/CSRF/Origin → durable command → final local admission → QoS0/nonretained MQTT → temporal controller-report reconciliation |
| Cloud delivery | Session/membership → durable expiring queue → authenticated outbound gateway ticket/exchange → one lease/redeem → durable local consumption → same local service; no database write equals hardware confirmation |
| Reports | Gateway/broker/board/report/epoch/retained/freshness are distinct; stale/current/future/invalid inputs fail safely; observed always physical_verified=false |
| Recovery | Loss/reorder/duplicates/expiry/logout/restart/transaction faults do not trigger blind physical replay; restored journal/cursor policies retained |
| Offline voice | Vosk/Kokoro remain CPU/local, explicit capture, reviewed requests, no default recordings/cloud STT/TTS; typed fallback and negation/question/scheduling/voice-unlock rejection preserved |

Fresh native probes used synthetic speech and fake MediaStream, not real microphones or residents. English synthesis/recognition matched the test phrase; Hindi recognition omitted the room number. Four native browser groups passed capture/worklet/VAD/authenticated WSS, review/Cancel (no publication), accepted review with fake reports and authenticated WAV/playback/Stop. Initial TTS readiness timed out while other QA ran; isolated retry and worker probe succeeded. Do not infer human accuracy, latency guarantees or safety from those fixtures.

AUD-001 relock hazard, AUD-002 authenticated MQTT/firmware rollout, AUD-003 household TLS/key replacement, NEW-006 blocked sensor sampling and NEW-009 human Hindi accuracy remain open. Keep physical door and remote unlock OFF; remote lighting is software-tested only and defaults OFF. Gas is uncalibrated and is not a certified alarm. Mechanical egress, real relay position, calibrated gas, trusted phones, holdout human speech and supervised outage/indicator-load tests remain external gates. Firmware fingerprints and publication exclusions are recorded in the publication report.
