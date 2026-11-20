# VidyutRakshak two-board integration

**2026-11-20 update:** The light sketch in `firmware` now adapts upstream with TLS, private credentials and motion heartbeats. The user deferred door hardware, so the door sketch and application behavior remain unchanged. Follow [current commissioning instructions](HARDWARE_COMMISSIONING.md). Physical verification is still pending.

Reviewed against [`Mishrajishri/home-security-simple` at `480b51b1d73cbc86ae65b044bc64562ca23386c4`](https://github.com/Mishrajishri/home-security-simple/commit/480b51b1d73cbc86ae65b044bc64562ca23386c4), 2026-11-19. The update since the prior review at `a7863e9` changes only the light-controller broker IP from `10.166.88.31` to `10.90.241.31`. The board topics, payloads, pins, and behavior did not change. The upstream server and dashboard are a separate legacy application; importing them would replace this project's authentication, command tracking, cloud gateway and UI.

## Physical map and messages

| Board | Hardware in linked sketch | Hub mapping |
|---|---|---|
| ESP32-A | Relays GPIO 23, 22, 19, 18; gas ADC GPIO 34; PIR GPIO 27; LED GPIO 2 | `light-1`, `light-2`, `light-3`, `light-4` (fan), `sensor-gas`, `sensor-motion`; `home/esp32/lights/online` |
| ESP32-B | Door relay GPIO 4; deny LED 12; grant LED 14; buzzer 13; RC522 SS 25, RST 26, SCK 33, MOSI 32, MISO 35; keypad rows 23/19/18/5, columns 17/16/2/15; LCD I²C SDA 21/SCL 22 | `door-1`; `home/esp32/door/online` |

ESP32-A uses `home/light/1..4/command` (`on`/`off`/`toggle`) and `/status` (`on`/`off`), `home/sensor/gas/data` (`raw`, `gas_ppm`, `alert`) and `home/sensor/motion/data` (`motion`). ESP32-B uses `home/door/1/command` (`lock`/`unlock`/`toggle_lock`/`deny`), `/status` (`locked`/`unlocked`/`denied`), `/rfid` (`uid`, `authorized`, `timestamp`), `/keypad` (`pin`, `authorized`, `timestamp`), and `/config/{pin,cards}`. The hub sends only absolute, nonretained actuator commands; configuration snapshots are retained. Controller status is still a relay variable, not a sensed load or lock position.

## Application changes

- The hub now syncs the authorized UID list and an encrypted, owner-managed 4–8 digit PIN to the door controller on broker connection and after dashboard edits. It never returns the PIN to browsers. The list has a 200-byte cap to fit the supplied sketch's MQTT receive buffer.
- RFID scans are logged as the board's local decision. The hub no longer sends a second unlock or deny command after a scan. Keypad events are logged without retaining the submitted PIN.
- Relay 4 is named Fan in newly seeded homes and existing default `Light 4` records. The all-lights action excludes it; explicit fan commands target the same `home/light/4` topic. The transport schema still calls it a light, including in cloud metadata, until a versioned device-type migration is designed.
- Broker ACL grants the hub door configuration writes and keypad reads, and the door board the inverse permissions.
- Denied RFID/keypad reports now create a door-access alert without storing the entered PIN; the dashboard and enabled browser notifications show it. A later live lock/unlock report resolves the alert.

## Full upstream feature reconciliation

The initial upstream commit contains the two sketches, a separate Node dashboard, and KiCad manufacturing files. Its second and latest commit changes only the broker IP in the light sketch. This table checks the **behaviors** in the initial commit as well as that later edit; it does not imply that source files from two separate applications can be copied interchangeably.

| Upstream feature or change | HomeAuto coverage | Limit or action |
|---|---|---|
| Light relays 1–3 and fourth fan relay; `on`/`off`/`toggle` commands and status | Four fixed devices, direct controls, command tracking, room views and voice; relay 4 is shown as Fan and excluded from all-lights actions | HomeAuto sends absolute `on`/`off` after resolving a fresh toggle; physical output is unverified. Fan still uses the `light-4` transport type. |
| Relay state restored from ESP32-A NVS after power loss | Firmware-owned; hub accepts fresh board status on reconnect without overwriting NVS with saved server state | Must flash and power-cycle test the linked sketch. Upstream's server-side `restoreLightStates` is intentionally not used because it can replay stale actuator commands. |
| Gas ADC report (`raw`, estimated `gas_ppm`, `alert`) | Ingested, shown as a sensor, logged and alerted; browser notification preference exists | The linear ADC value is uncalibrated. Upstream README mentions an automatic gas buzzer, but the light sketch has no gas-buzzer output. |
| PIR report and hold interval | Ingested, shown, logged and alerted | The sketch sends transitions only. After 65 seconds without a motion report, HomeAuto marks the observation stale. README's automated energy-saving sequence is not implemented in that sketch. |
| Board online/LWT and status heartbeats | Both boards have separate online and last-report indicators; reports and timeouts control freshness | Requires actual board connection to test. Retained status does not count as a fresh live observation. |
| Door relay lock/unlock and 5-second local auto-lock | Door status and manual lock/unlock are mapped; unlock requires local owner authorization, reauthentication, confirmation and safety setup | The board controls the relay itself. The hub cannot enforce the 5-second timer or prove a physical lock position. |
| RFID local allow/deny, NVS UID list, dashboard add/revoke/remove | Owner card manager, canonical UIDs, retained card-list sync, RFID activity and denial alert | Offline revocations wait for reconnect. There is no board acknowledgment of NVS write. The hub treats the board's decision as a report and sends no second unlock. |
| Keypad local PIN check, NVS PIN, MQTT PIN update, masked LCD entry | Owner Set/Change keypad PIN, encrypted hub storage, retained PIN sync, keypad activity and denial alert | Hub never displays or logs PIN; the upstream sketch still sends it in MQTT telemetry and serial output. Offline PIN changes wait for reconnect. |
| LCD prompts, LEDs, buzzer, RC522, keypad matrix, GPIO and custom PCBs | Firmware/PCB-owned; physical pin map is recorded above | No UI or server code can verify wiring or timing. The PCB design, etch masks, KiCad sources and Python layout generators stay in the hardware repository. |
| Live device, sensor, board and activity updates | Authenticated WebSocket snapshots and activity API/pages | Access reports in activity are refreshed on demand; browser alerts cover denied access, gas and motion. The upstream's granted-access and every-door-transition browser popups are not reproduced. |
| Device metadata and dashboard controls | Device/room editing, theme, status, quick all-lights-off, per-device refresh and alerts | HomeAuto uses a fixed seven-device hardware registry. Upstream's free-form device registration/deletion is not suitable for these two fixed boards. |
| Hindi/English voice and wake phrase | Hindi/English intents, fan/light/door/sensor queries, optional wake listening, typed commands | Active browser recognition may use an online speech provider. Upstream's offline Vosk runtime and automatic microphone start are not ported. |
| Energy banner, CO₂/rupee savings, energy tips | No equivalent measurement or savings claim | Upstream uses a constant 10 W for all four `light` devices, including the fan, and treats time OFF as savings against an all-on baseline. Hardware supplies no energy meter or appliance ratings. |
| Local HTTP/HTTPS, MQTT broker, SQLite, startup | Local hub, encrypted application HTTPS for LAN, authenticated TLS MQTT client, durable local database, Windows launch scripts | Upstream's embedded anonymous TCP broker and Unix `start.sh` are not ported. Broker provisioning and board TLS firmware remain required. |
| Latest commit: ESP32-A broker IP `10.166.88.31` → `10.90.241.31` | Not a hub protocol or UI change; verified both linked sketches now target `.31` | The laptop's Wi-Fi address changed during review and did not match `.31`. Set the actual stable laptop address in **both** board configurations. |

Source inventory for this reconciliation: upstream `README.md`, both `firmware/*/*.ino` sketches, `server/{server.js,config,mqtt,routes,voice,db}`, `public/{index.html,js,css}`, `start.sh`, and `hardware/{door_security_pcb,light_fan_pcb}` plus root board artifacts. The software tests cover the message contract and alert behavior; they cannot certify a PCB, mains wiring, lock, sensor calibration or microphone.

## Still required on the hardware laptop

1. Both linked sketches now use the hardcoded broker address `10.90.241.31` and Wi-Fi SSID `Shri IOT`. The laptop was on a different Wi-Fi network with a different IP at the final check. The boards and laptop must be on a reachable network, and both sketches must point to the laptop's stable hub address. Provision Wi-Fi credentials privately; do not commit them.
2. Both sketches use anonymous plain MQTT on TCP 1883. This application's secure broker requires board-specific credentials and CA-verified TLS on the private LAN. Until both sketches are changed and reflashed, the boards cannot connect to it. Do not weaken the broker or disable certificate verification to make them connect.
3. ESP32-B makes access decisions offline from NVS. A dashboard revocation or PIN change cannot affect an offline board until it reconnects and receives the new config. The sketch provides no config acknowledgment; the dashboard therefore cannot prove that a change reached flash.
4. The door's denied-feedback loop blocks about 900 ms, and MQTT connect can block before the auto-relock check. Keep the physical door gate disabled and fix/bench-test timing, power loss, repeated scans, and independent egress before connecting a lock. The hub's `HOMEAUTO_DOOR_ENABLED=0` stops hub commands; it does **not** disable the board's offline RFID/keypad unlocks.
5. ESP32-A publishes motion only on state transitions, so the hub correctly marks a quiet PIR report stale after 65 seconds. The sketch should publish its actual motion state on connect and periodically. Gas `gas_ppm` is a linear ADC estimate, not calibrated concentration or a certified alarm.
6. The upstream offline Vosk voice and energy-savings display are not hardware protocols. This project's active voice uses browser speech services, which may require internet; estimated savings are not measured energy data. Verify them separately before claiming those upstream features.

Software tests exercise parsing, synchronization, encryption and command safety with fake publishers. No Arduino compile, board flash, GPIO measurement, relay load test, RFID/keypad scan, broker TLS/ACL bench, microphone check or physical safety acceptance was performed in this review.

## Repeat verification, 2026-11-19

- Fetched upstream again: `origin/HEAD` remains `480b51b1d73cbc86ae65b044bc64562ca23386c4` (two commits).
- `npm test` in `server`: 286 tests passed, zero failed or skipped. `npm run build` at the project root passed. JavaScript syntax and `git diff --check` passed.
- `npm run test:browser` in `server`: 145 screenshots, 80 accessibility scans, zero violations, page errors or external requests. The browser flow exercised RFID card creation and keypad PIN setup without showing the PIN.
- The local hardware profile on `127.0.0.1:3001` and simulation profile on `127.0.0.1:3002` both responded with their expected runtime modes. No MQTT broker was listening on TCP 1883 or 8883; neither `arduino-cli` nor `mosquitto` was available as a command.
- The laptop's Wi-Fi and IP differed from the sketches' configured network and broker address. These checks do **not** establish board connectivity or physical function.
