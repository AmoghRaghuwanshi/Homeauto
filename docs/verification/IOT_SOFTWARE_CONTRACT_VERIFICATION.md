# IoT and offline software contracts

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
