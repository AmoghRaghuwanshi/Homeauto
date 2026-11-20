# Laptop integration verification — 20 November 2026

Scope: lights 1–3, fan and gas on ESP32-A. The user deferred the door module and confirmed the PIR is absent; PIR reports are disabled. Door firmware and application behavior are unchanged.

## Verified software and system setup

| Check | Result |
|---|---|
| Complete application suite | 288 passed, 0 failed/skipped |
| Website source synchronization | 71 source files match |
| JavaScript syntax | 197 tracked files passed before the new provisioning helpers; helpers separately parsed |
| Cloud build | Passed; 459 traced files, no native hub files |
| Simulation browser | 4 groups, 12 captures, no page errors/external requests |
| Modules browser | 3 groups, 8 captures, no page errors or commands |
| Domain health and local runtimes | HTTP 200; cloud, hardware and simulation modes correctly separated |
| Cloud pairing after launcher restart | Fresh gateway heartbeat accepted by production |
| Hardware source version | Upstream remains `480b51b1d73cbc86ae65b044bc64562ca23386c4` |
| USB driver | Microsoft-signed Silicon Labs driver installed; CP2102 error 28 resolved |
| Actual USB chip probe | esptool communicated with ESP32-D0WD-V3 revision 3.1 on COM5 |
| Hotspot provisioning | Private light firmware header uses laptop `172.20.10.5`, TLS port 8883 |
| MQTT broker | Mosquitto 2.1.4 installed on D:, private authenticated TLS listener running |
| Broker permissions | CA validation, board login and command subscription passed; anonymous login and unrelated publish rejected; no device commands sent by this check |
| Laptop hub MQTT connection | Production gateway reports `mqtt_connected: true` |
| Windows Firewall | Named HomeAuto rule restricts inbound MQTT TLS to hotspot subnet `172.20.10.0/28` and the broker executable |
| Default broker service | Stopped and disabled; the hardware launcher manages the private TLS broker |

Private Wi-Fi/MQTT credentials, CA keys, firmware headers and binaries are excluded from Git. Tool downloads, build caches and temporary build files use D:. The initial latest-toolchain attempt failed because of disk capacity and a server download interruption; the classic-board package is pinned to ESP32 2.0.17.

## Physical verification

- ESP32 2.0.17 compilation passed: 896,049 bytes program storage (68%) and 46,296 bytes RAM (14%).
- Firmware uploaded on COM5 at 115200 baud; esptool verified flash hashes.
- Production received fresh, nonretained reports from all four relay channels and the gas sensor through ESP32 → TLS broker → laptop hub → domain.
- All four relay channels reported ON then OFF in eight total commands. Response times were 17–284 ms. All initial OFF states were restored. The user confirmed the physical outputs responded.
- Live data revealed the upstream gas heartbeat (30 seconds) exceeded the application's ten-second freshness limit. The adapted firmware now reports at least every four seconds.
- The user confirmed no PIR is connected. Firmware stops publishing a false "clear" observation for the unused GPIO. Motion detection is not claimed tested.
- Full flash backup reads did not complete reliably and were abandoned; no successful pre-flash full backup is claimed. The firmware uploads do not erase the NVS partition.
- One later upload was interrupted by a Windows serial error. A complete recovery upload succeeded and verified all flash hashes before returning the board to use.
- Physical gas calibration/alert thresholds and power-cycle recovery were not verified by the ON/OFF test.

See [commissioning](HARDWARE_COMMISSIONING.md) and [phone-to-hub architecture](../cloud/REMOTE_HUB_ARCHITECTURE.md).
