# HomeAuto — Project Context & Source-of-Truth

> **Active revision 3 — local verification, 2026-11-05.** Read the corrections below before the retained earlier analysis. Local workspace `D:\homeauto-main` is authoritative and has **no .git metadata**; the old pinned remote SHA is historical only. No application implementation was changed in this planning session. [Coding handoff](HANDOFF_TO_GPT6.md) · [Architecture](ARCHITECTURE.md) · [Wire contracts](API_CONTRACTS.md) · [Current tasks](TASKS.md) · [Verification](TEST_PLAN.md).

## Active local verification and corrections

All frontend HTML/CSS/JS, backend routes/DB/MQTT/voice/config/scripts, firmware, manifest/dependencies and the three original docs were inspected. Every original reference image was visually opened:01 warm cream/green,03 larger readable family layout/blue mic,04 blue+mint/peach/lavender,05 white+emerald default. They are posters of five concept phones, not working application screenshots. Current frontend remains one dark technical dashboard with device grid, RFID/activity panels, floating mic, not the planned five-screen consumer application.

**Evidence today:**19 application JavaScript files pass `node --check`; installed top-level packages resolve with `npm ls --depth=0 --ignore-scripts`. Pure parser calls and a minimal isolated ws handshake were run. Existing DB bytes were loaded into a separate sql.js instance and SELECTed without exporting/writing:7 devices,0 cards,44 activity rows. DB is28672 bytes. Four lights stored off, door stored locked, gas normal, motion clear; five actuator rows have persisted online1, two sensors online0. These historical bits/states prove neither live connectivity nor physical operation.

**Installed vs declared:**Node20.19.0/npm10.8.2/Python3.14.3; installed express4.22.2, ws8.20.1, mqtt5.15.1, sql.js1.14.1, cors2.8.6, selfsigned5.5.0, vosk0.3.39, nodemon3.1.14. Version ranges remain in package.json; lockfile is the install baseline. Git, rg, ffmpeg available; mosquitto, arduino-cli, cmake not found on PATH (not proof absent elsewhere). node_modules exists. No application tests/test script, AGENTS.md,.gitignore, broker service config or firmware dependency lock was found. No install/update was performed.

**Speech assets exist, load unverified:**local en model14files70,898,967 bytes, hi14files82,084,166 bytes; total152,983,133 bytes≈145.9MiB extracted. English README identifies US English; not an Indian English model. Host CPU observed Intel i5-12450H8 cores/12 logical; no inference benchmark or RAM budget measurement performed. No TTS engine/voices/worker/LLM exists in application.

**Newly verified bugs/limits beyond older notes:**

- `parseCommand('room 1 light band karo')` returns lock for light1/2;`do not unlock door` returns unlock;`light 99 on` yields nonexistent ID; bare `turn on light` selects all lights;`what is the gas status` returns null. Parser probes performed no execution or publication.
- Installed ws8.20.1 with the existing two-automatic-server attachment pattern reproduced `/voice`400 on a separate loopback-only test server. Replace with one upgrade dispatcher and `noServer` instances; actual application startup remains untested.
- `/ws` frontend emits `msg.data`, but voice_result broadcasts have top-level fields; Notifications handler may receive undefined. Global transcript broadcasts also violate planned session privacy.
- `denied` is published on retained door/status for access denial without changing `doorLocked`; do not map it to lock position. Browser notification code currently treats every non-unlocked door update as locked.
- Doorstatus reports software/relay mode only. There is no contact/bolt feedback. **Controller-reported state is not physical confirmation.** All older references below to hardware-confirmed/physically reported must be read with this limitation; API_CONTRACTS explicitly sets physical_verified=false.
- Door reconnect loops/delays run before relock check; network/broker loss while unlocked can stall relocking. Five-second auto-relock is conditional on loop progress, not a guarantee. This is a household-release blocker requiring supervised firmware/hardware work.
- PIR publishes only changes, no initial clear or periodic sample. Board heartbeat cannot prove no movement. Initial/current PIR state must remain unknown absent a fresh report; show last event time.
- Gaswarn200constant unused; alert400 derives from linear rawADC mapping, no calibration. UI missing readings currently default0. Gasbuzzer/independentalarm not implemented.
- Board true/status retained messages can be stale; last_seen can be updated without a fresh observation; broker disconnect doesn't invalidate persisted device flags. Epoch/freshness contract replaces those assumptions.
- sql.js synchronously rewrites whole file on each mutation plus10s timer;2s gas logging implies≈43,200samples/day. Atomic persistence, transition logging, retention and backup are pending.
- Baseline device DELETE can be undone by next seed and telemetry may refer to deleted rows. Planned fixed registry disallows deleting the7 hardware records while permitting rename/reassign/favorites.
- Unknown API GET may hang because fallback ignores `/api` without response. Planned final JSON404 fixes this. Current loglimit is unbounded; RFID duplicate overwrites via INSERT OR REPLACE.
- Existing key file is present and treated as compromised/shared. Older docs' claim about public Git tracking cannot be reverified from this metadata-free local copy; rotation remains mandatory before use, not done today. No key/certificate content copied into docs.

**What works vs exists:**syntax, dependency inventory, read-only DB loading, pure parser normal example and bug reproductions are verified in isolation. Light/door/RFID/sensor/notification/voice source paths exist but live functionality is **UNTESTED this session**. New UI/themes/auth/rooms/command tracking/worker/TTS/PWA are **PLANNED**. Cameras, AC, fans, curtains, extra locks, temperature, media, home arming/scenes, smoke/water/window sensors appear only in concepts or future scope. No physical device was controlled.

**Active decisions superseding earlier open alternatives:**local owner/resident/viewer auth with can_unlock, secure cookies/CSRF/reauth; console identity provisioning; shared persisted rooms/home and per-user favorites; browser-scoped theme05/01/03/04; History router; one command service; Hindi AND English interface required for release; voice-only unlock prohibited. Detailed methods/migrations live in ARCHITECTURE, exact routes/messages in API_CONTRACTS, canonical tokens in THEMES, screen contracts in SCREENS. Older suggested preference keys/home-name localStorage, English-only release, phase numbering and unresolved auth options are superseded. Model winner remains benchmark-dependent per OFFLINE_AI.

## Documentation map and authority

Latest user direction governs scope; actual source governs what exists; revision3 contracts govern planned implementation. If new source disagrees, reinspect and record drift before coding. The retained sections below preserve useful history but cannot override this active correction block or linked canonical contracts.

| Document | Authority |
|---|---|
| [design.md](design.md) / [THEMES.md](THEMES.md) | visual direction / exact complete tokens and preference scopes |
| [COMPONENT_SPEC.md](COMPONENT_SPEC.md) / [SCREENS.md](SCREENS.md) | reusable DOM contracts / all routes and controls |
| [ARCHITECTURE.md](ARCHITECTURE.md) / [API_CONTRACTS.md](API_CONTRACTS.md) | modules, migrations, methods / exact REST, WS, MQTT |
| [OFFLINE_AI.md](OFFLINE_AI.md) / [SECURITY.md](SECURITY.md) | researched speech choices and gates / threat model and controls |
| [plan.md](plan.md) / [TASKS.md](TASKS.md) | active11phases / canonical dependency checklist |
| [TEST_PLAN.md](TEST_PLAN.md) / [DECISIONS.md](DECISIONS.md) | actual vs future evidence / rationale and uncertainties |
| [HANDOFF_TO_GPT6.md](HANDOFF_TO_GPT6.md) / [PLANNING_AUDIT.md](PLANNING_AUDIT.md) | exact coding start / planning consistency and boundary verification |

## Retained earlier context (read with revision3 corrections)

> **Document status:** Implementation handoff, 2026-10-31  
> **Repository:** https://github.com/Mishrajishri/homeauto  
> **Inspected baseline:** `main` at `08e1b2013375fa794175dd7a6d462fdd0c536c89`  
> **Read with:** `plan.md`, `design.md`, and `reference-images/`  
> **Highest-priority rule:** A beautiful mockup is not evidence that its hardware feature exists.
> **Handoff release:** 2.0 — comprehensive GPT-6.1 High (Sol) context pack; repo facts rechecked at the pinned commit.
> **Use:** copy the complete `HomeAuto_UIUX_Docs/` directory into the repo (or give all three documents and the four images to the implementing agent).
> **Evidence levels:** `OBSERVED` = read in source; `DESIGNED` = approved UI behavior; `PLANNED` = not yet implemented; `REQUIRES TEST` = not confirmed in operation.
> **Do not pretend** that we have run the device firmware, listened to the microphones, or viewed real app screenshots.

## 1. Purpose

HomeAuto is a **local-first smart-home control and safety application** intended for everyday residents—children, adults, older people, and nontechnical family members. The interface should feel like a simple household utility, not a system administration console.

The long-term vision is a household app that handles connected lights, a door lock, RFID entry, gas and motion alerts, and a conversational assistant called **Shrimaan**. The user wants **all core operations to work without internet**, including Hindi, Indian-accent English, and common Hinglish requests, on a computer **without a discrete GPU**. The app must not rely on browser cloud speech recognition or externally hosted text-to-speech.

**Product promise:** “Understand your home at a glance. Control it in one tap or one sentence. Keep household data inside your home.”

## 2. Design decisions already agreed

- Preserve four chosen concepts from the previous generated five-image series: **Theme 01**, **Theme 03**, **Theme 04**, **Theme 05**.
- **Theme 05 — Serene Emerald** is the default for first-time visitors.
- **Theme 01 — Warm Organic**, **Theme 03 — Universal Comfort**, and **Theme 04 — Friendly Pastel** are user-selectable alternatives.
- Theme 02 (dark teal/cyber treatment from the five-image series) is **not** part of this implementation selection.
- Use the accessibility and clarity inspiration of Google Home and Mi Home, but **do not copy their logos, screen layouts, branding, or artwork**.
- Keep the base UI genuinely achievable using **HTML/CSS/JavaScript**, with CSS layout, locally stored images, and SVG icons. No expensive 3D or complicated render effects are required.
- Home navigation has **five primary destinations**: Home, Rooms, Security, Assistant, Settings. Put Activity under Security (or a secondary full-screen route); it is not a sixth primary nav icon.
- Mobile-first visual hierarchy; desktop remains fully functional with a responsive sidebar/two-column layout.
- Prioritize **readability, touch size, clarity, honest status, and predictable interactions** over decorative effects.
- Status labels must describe human outcomes (“Door locked”) rather than implementation details (“ESP32-B online”). Keep diagnostics in Settings > Advanced.

## 3. Reference-image inventory

All references are in `reference-images/`, alongside these Markdown files in the deliverable package. These are AI-generated **concept boards**, each showing five mobile screens in a promotional composition, **not screenshots of working software or detailed pixel-perfect specifications**.

| Theme ID | File | Role | Major characteristics |
|---|---|---|---|
| `01` | `reference-images/theme-01-warm-organic.png` | Optional | Cream backdrop, pine-green accents, warm photography, soft white cards, friendly illustrated Shrimaan avatar, rounded and approachable. |
| `03` | `reference-images/theme-03-accessible-family.png` | Optional | Clear larger wording, strong safety summary, senior-friendly security actions, blue prominent microphone, four large home-status tiles, accessibility entry. |
| `04` | `reference-images/theme-04-pastel-blue.png` | Optional | Soft powder-blue structure, multicolor pastel room blocks, blue assistant controls, friendly character illustration, colorful but restrained categories. |
| `05` | `reference-images/theme-05-serene-emerald-default.png` | **Default** | Near-white canvas, dark charcoal typography, serene emerald controls, spacious white cards, room photos, clear protected-home status, green Shrimaan microphone. |

**Important image caveat:** Reference boards include imagined home cameras, fan controls, air-conditioning, curtains, music, water heaters, climate readings, multiple locks, home members, and scenes. They are **illustrative proposals**, not devices or features currently integrated in this repository. The design must degrade gracefully to the seven real seeded devices.

## 4. Existing repository structure (observed)

```text
homeauto/
├── firmware/
│   ├── light_controller/light_controller.ino
│   └── door_security/door_security.ino
├── public/
│   ├── index.html
│   ├── css/style.css
│   ├── js/app.js
│   ├── js/devices.js
│   ├── js/logs.js
│   ├── js/notifications.js
│   ├── js/voice.js
│   ├── js/audio-processor.js
│   ├── js/websocket.js
│   └── manifest.json
└── server/
    ├── server.js
    ├── package.json
    ├── config/config.js
    ├── db/database.js
    ├── db/home_auto.db
    ├── routes/devices.js
    ├── routes/commands.js
    ├── routes/logs.js
    ├── mqtt/mqttClient.js
    ├── voice/voiceEngine.js
    ├── voice/voiceHandler.js
    ├── voice/commandParser.js
    ├── voice/download-models.js
    └── certs/{generate-cert.js,server.cert,server.key}
```

Important dependency versions and roles, from `server/package.json`:

- Express 4: HTTP API and static frontend serving.
- WebSocket (`ws`): live device and voice sessions.
- `mqtt`: publish/subscribe to the local broker.
- `sql.js`: embedded SQLite database kept in a file.
- `vosk`: existing offline speech recognition; migration candidate.
- `cors`, `selfsigned`: present in backend.
- Browser frontend uses vanilla HTML/CSS/JS, no React frontend or frontend build system in the inspected baseline.

## 5. What actually exists today

### Hardware and seeded devices

| Existing ID | Seed label | Type | Default room | Boot/default status | Firmware board |
|---|---|---|---|---|---|
| `light-1` | Light 1 | light | Room 1 | `off` | ESP32-A, relay GPIO 4 |
| `light-2` | Light 2 | light | Room 1 | `off` | ESP32-A, relay GPIO 5 |
| `light-3` | Light 3 | light | Room 2 | `off` | ESP32-A, relay GPIO 18 |
| `light-4` | Light 4 | light | Room 2 | `off` | ESP32-A, relay GPIO 19 |
| `door-1` | Front Door | door | Entrance | `locked` | ESP32-B, door relay GPIO 4 |
| `sensor-gas` | Gas Sensor | sensor | Kitchen | `normal` | ESP32-A, analog GPIO 34 |
| `sensor-motion` | Motion Sensor | sensor | Hallway | `clear` | ESP32-A, digital GPIO 27 |

**Room-name migration:** Existing `Room 1` and `Room 2` are real seeded names. “Living Room” and “Bedroom” in references are proposed **editable display labels**; never silently assume the mapping matches a real building. Preserve device IDs while adding a `room_display_name` presentation mapping or user-editable room settings. A single “home” may have a custom display name; do not hardcode a person's family name from mockups.

**RFID:** RC522 reader connects to ESP32-B. The server matches scanned card UID against `rfid_cards` table, then sends `unlock` or `deny`. Door firmware auto-locks approximately five seconds after successful unlock. UID-only RFID credentials have cloning risks; do not present this as production-grade authentication.

**Gas:** Firmware maps ADC readings to an *approximate* value labelled PPM. It lacks proper calibration; never market it as certified gas measurement or a replacement for dedicated alarm hardware.

**Voice today:** Vosk English/Hindi recognizers, local wake phrase variants of “Shrimaan,” rule-based `commandParser.js`, binary microphone streaming over `/voice`, and frontend mic interface. This is an existing local speech prototype; it is **not yet Whisper-based** and has no fully integrated dedicated neural TTS response pipeline.

### HTTP endpoints that currently exist

| Method | Path | Observed role |
|---|---|---|
| GET | `/api/health` | Server uptime and timestamp |
| GET | `/api/devices` | List devices |
| GET | `/api/devices/:id` | Device detail |
| POST | `/api/devices` | Register a device |
| PUT | `/api/devices/:id` | Rename/type/location metadata |
| DELETE | `/api/devices/:id` | Delete device |
| POST | `/api/devices/:id/command` | Send `on`, `off`, `toggle`, `lock`, `unlock` to MQTT |
| GET | `/api/logs?limit=30` | Activity history |
| GET | `/api/logs?type=...` | Filter events |
| GET | `/api/logs/rfid-cards` | List RFID cards |
| POST | `/api/logs/rfid-cards` | Register RFID card |
| DELETE | `/api/logs/rfid-cards/:uid` | Remove RFID card |

Do not build against imaginary endpoints. The new room/theme/preferences/security APIs are either client-side only or explicitly **planned**, and should be implemented intentionally.

### WebSocket paths/events that currently exist

- `/ws` sends `{type:'init', data:{devices,espBoards}}` and broadcasts `device_update`, `esp_status`, `rfid_event`, `log`, `mqtt_status`, `sensor_data`, `alert`, and `voice_result`.
- `/voice` is a separate audio/WebSocket channel and sends `voice_ready`, `partial`, `transcript`, `wake_word`, `voice_result`, and `voice_error` events.
- Frontend currently reconnects automatically to `/ws` and `/voice`.

### MQTT topics, per server configuration

```text
home/light/{id}/command
home/light/{id}/status
home/door/{id}/command
home/door/{id}/status
home/door/{id}/rfid
home/sensor/{id}/data
home/esp32/{boardId}/online
```

The system publishes to a local broker at `mqtt://localhost:1883` in the current config, with firmware connecting to a configured LAN host/IP. HTTP is configured for 3000 and HTTPS for 3443 in source. The local router/hotspot and MQTT broker can operate without internet; client devices still require LAN connectivity.

### Database structure

- `devices`: ID, name, type, location, status, `is_online`, `last_seen`, `created_at`.
- `rfid_cards`: UID, owner_name, is_authorized, created_at.
- `activity_log`: ID, timestamp, device_id, event_type, details.

No persisted family/member/scene/camera/theme/home-mode tables are present in the inspected code. Theme choice can initially use `localStorage` with system fallback, while multi-user settings would need a proper backend data model.

## 6. Current vs proposed feature contract

| Feature | Current repository | Planned design / status |
|---|---|---|
| Four light controls | **Implemented in source** | Re-present in room-based, larger touch-first cards |
| One door lock | **Implemented in source** | Add prominent status and protected unlock flow |
| Gas and motion events | **Implemented in source** | Simplify alerts, preserve technical readings in detail |
| RFID add/remove | **Implemented in source** | Move to Security > Access cards, improve warnings and validation |
| Event history | **Implemented in source** | Security > Activity, filters, grouped dates |
| Browser notifications | **Implemented in source** | Plain-language opt-in; local only when conditions permit |
| Vosk voice recognition | **Implemented in source** | Replace or benchmark against Whisper.cpp CPU STT |
| Spoken Hindi/English replies | **Not fully implemented** | Add local, verified TTS engine/voices (Kokoro/Piper candidate) |
| Local LLM reasoning | **Not implemented** | Optional future enhancement only; do not block MVP |
| Additional cameras | **Not implemented** | Hide camera section until actual camera feed/provider exists |
| Fans, AC, curtains, climate, TV, music | **Not implemented** | Future device types; no functional dummy buttons in MVP |
| Scenes/Home-Away-Night | **Not implemented as scene engine** | Can become functional after scene actions/status model is built |
| Family accounts / authentication | **Not implemented** | Security prerequisite for multi-user and remote/unlock scenarios |
| Multiple selectable themes | **Not implemented** | Implement Theme 05 default + 01/03/04 in Appearance settings |
| Accessible/large-text mode | **Not implemented** | Include in v1 design and test with keyboard and touch |
| PWA fully offline | **Not implemented** | Manifest exists but has no icons; service-worker strategy needed |

## 7. Security, truthfulness and offline boundaries (non-negotiable)

1. **Protect physical actions.** Existing routes are unauthenticated and must be secured. Unlocking doors requires local authentication, explicit confirmation, authorization checks, and reliable status feedback.
2. **Do not trust a published command as a completed action.** The current backend optimistically updates status after MQTT publish. UI should say “Sending…” / “Awaiting confirmation…” until a physical status message confirms it; time out visibly.
3. **Never show `secure`, `protected`, or `everything is fine` when status is unknown/offline.** Use “Some devices are unavailable” and show what is known.
4. **Never hardcode secrets.** Repository includes `server/certs/server.key`; rotate/revoke as appropriate and remove from tracked source. Keep WLAN/MQTT credentials in secure local config, not UI or Git.
5. **Escape device names, card names, logs, transcripts, and other user/server data** before rendering. Existing HTML interpolation includes XSS risks.
6. **Network offline != home server offline.** The product can have no internet and still work via LAN. Distinguish “Internet not needed,” “Home server unavailable,” and “Device disconnected.”
7. **No remote cloud fallbacks** for STT/TTS, web fonts, icons, imagery, analytics, auth, or home state. Bundle local assets. Existing Google Fonts CDN must be removed/replaced for strict offline usage.
8. **No life-safety guarantees.** Gas readings are experimental/uncalibrated and UI must state this until certified sensors and procedures are integrated.
9. **Do not log raw microphone audio by default.** Make consent, microphone visibility, disabling, and retention policy clear.
10. **No unauthorized access by voice alone.** “Open door” must not silently bypass authentication or confirmation.

## 8. Offline AI constraints and architecture intentions

- **CPU-only**, preferably models within an approximately **1 GB total model-storage goal**, to be measured on the actual deployment computer. Runtime memory/latency can exceed disk size.
- **STT candidate:** `whisper.cpp`, multilingual quantized Whisper base or small. Benchmark Indian English, Hindi, Hinglish/code switching, noise, elderly voices, and pronunciation of room names. Do not assume a single benchmark establishes production accuracy.
- **TTS candidates:** local Kokoro-82M ONNX / Piper / other validated Hindi+English voices. Select based on *actual bilingual pronunciation, runtime, RAM and licensing*, not illustrative model names in a design image.
- **Intent engine MVP:** deterministic allow-listed device commands plus room-name aliases. A local LLM is *not required* for core controls. An optional small CPU LLM can be evaluated separately for noncritical conversation.
- **Pipeline target:** mic button or opt-in wake word -> audio VAD/endpointing -> local STT -> command parser/authorization -> MQTT -> device status acknowledgement -> local TTS -> audio playback. Provide text feedback as fallback.
- **Operational environment:** local browser and home server communicate over LAN/Wi-Fi/hotspot; no external internet. Voice features gracefully fall back to tap controls if models are missing/unavailable.
- **Speech privacy:** mic state visibly disclosed; allow stop/pause and delete local transcript history. No silent mic capture as default.

## 9. Guidance for the implementing model (Codex / GPT-6.1 High (Sol))

- Read all three docs first. Treat `context.md` as **truth about current implementation**, `design.md` as **UI contract**, and `plan.md` as **implementation order/acceptance criteria**.
- Preserve hardware protocol and server behavior unless intentionally refactoring and testing both firmware and backend.
- Do not infer hardware from reference images.
- Keep code semantic and maintainable; prefer a small vanilla-JS component structure compatible with the existing repo unless a framework migration is explicitly approved.
- Replace current pages incrementally and test each screen at mobile and desktop widths.
- Every button must have a real action, disabled state or clear “not available” explanation; never present demo toggles as working hardware.
- Make Theme 05 default and offer Theme 01/03/04 from **Settings > Appearance**, stored locally even with zero internet.
- Describe any model, build dependency, file, or new device that has not yet been installed as **planned**, not completed.

## 10. Glossary

- **Offline-first:** All critical functions work without external internet; local Wi-Fi/LAN may still be required.
- **Shrimaan:** Friendly local Hindi/English voice assistant, not a cloud service.
- **Room:** Household user-facing grouping of device IDs; independent of hardware ID.
- **Scene:** A defined group of home actions (e.g. “Good night”); currently a planned feature.
- **Confirmed state:** Device status received from ESP32, unlike a pending or optimistic command.
- **Easy Mode:** Larger targets/text and fewer simultaneous options; selection should be reversible and accessible.
- **Reference image:** AI-generated visual direction, not a screenshot or functional proof.


---

## 11. Stable facts, open decisions and future claims — enforce evidence labels

When implementing, label requirements in comments/PR notes as follows:

| Label | Meaning | Examples | What implementer may do |
|---|---|---|---|
| `OBSERVED` | Confirmed by reading code in the pinned commit | Express app, `/ws`, `/voice`, 7 seeded devices, MQTT topics | Preserve and test before change |
| `APPROVED DESIGN` | The user deliberately selected it | Four themes, 05 default, approachable consumer UI, Hindi/English offline voice goal | Implement if needed dependencies exist or clearly scoped |
| `PLANNED` | Not present in inspected code | Scenes, multi-user accounts, camera feed, local TTS engine, role-based auth | Build deliberately with backend/tests or leave undisplayed |
| `UNVERIFIED` | Product quality or physical behavior requires test | Real ESP32 relay toggles, Indian accent accuracy, latency on CPU, gas calibration | Avoid promises, instrument and measure |

**Source precedence if the agent detects contradictions:** latest user instruction > actual repository code for current capabilities > `context.md` factual baseline > `design.md` desired interface > `plan.md` suggested sequence > generated images. The implementation must remain safe and technically truthful; a later instruction to use a mockup layout is not consent to enable physically unsafe actions.

**Agent must recheck the working tree.** This pack is grounded at commit `08e1b2013375fa794175dd7a6d462fdd0c536c89`; if the repository HEAD changed, make a short change-impact note before coding rather than overwriting newer work.

## 12. Current end-to-end paths — trace these before editing

### 12.1 Initial dashboard load

1. Express serves `public/index.html`, CSS and JavaScript assets.
2. `DOMContentLoaded` calls `App.init()` in `public/js/app.js`.
3. UI connects `/ws` via `public/js/websocket.js`, invokes `GET /api/devices`, `GET /api/logs`, and `GET /api/logs/rfid-cards`.
4. Server's `/ws` initializes with `devices` and `espBoards`; later events update the view.
5. `Notifications.init()` may offer a permission banner; `Voice.init()` creates voice UI and requests/uses microphone permissions in its current flow.

**UI redesign compatibility target:** preserve server communications and all existing outcomes, but make microphone *off by default*, and distinguish network layers. Browsers may block audio and notification permissions on untrusted/nonsecure origins.

### 12.2 Light command path

`Device card -> Devices.sendCommand(light-1, 'toggle') -> POST /api/devices/light-1/command -> server/routes/commands.js -> mqttClient.publishCommand('home/light/1/command', action) -> ESP32-A relay -> home/light/1/status -> mqttClient.handleStatusUpdate -> DB + /ws device_update -> UI.`

**Known gap:** route writes an optimistic database status on MQTT publish, before hearing from ESP32. An MQTT publication alone is not proof the light changed. Refactor command acknowledgement intentionally; keep actual `device.status` and pending action distinct.

### 12.3 RFID door path

`RC522 -> ESP32-B publishes home/door/1/rfid -> mqttClient.handleRfidEvent -> DB checks UID in rfid_cards -> publish unlock/deny -> door firmware -> home/door/1/status -> DB + broadcast.`

A submitted UID is currently the basis of authorization and can be cloned. This does **not** establish a secure identity system. API/WebSocket actions enabling unlock or card mutation need real authorization and origin controls before operating physical locks. In the accessible UI, confirmations are additional safeguards, not substitutes for authentication.

### 12.4 Gas and motion path

`ESP32-A -> sensor/gas or sensor/motion MQTT JSON -> server handles data -> status/event log + WS device_update + sensor_data + alert -> frontend sensor cards and notifications.`

Gas numbers are currently approximated with `map(rawValue,0,4095,0,1000)`, **not** real calibrated PPM. Use “Gas sensor reading (experimental)” or safer “Gas sensor: alert/normal (prototype)” and place raw readout in advanced details, not a confidently precise air-quality gauge. Motion detection is a simple PIR event, not person identification.

### 12.5 Voice path (existing)

`Browser getUserMedia -> AudioWorklet/ScriptProcessor -> 16 kHz PCM chunks -> WS /voice -> Vosk English/Hindi recognizers -> wake word in transcript -> commandParser -> MQTT/DB -> results sent on voice WS and /ws -> browser feedback/notification.`

This is a locally hosted prototype. It does **not** yet include Whisper.cpp or Kokoro/Piper, and user-visible spoken TTS responses are not implemented in the inspected voice stack. Do not include a local LLM by assumption. Wake-word speech recognition accuracy is unverified.

## 13. Specific source-observed implementation risks and how to avoid regressions

| ID | Source | Source-observed behavior or risk | Required mitigation/test |
|---|---|---|---|
| C-01 | `server/server.js` | No access-control middleware protects REST routes or `/ws`/`/voice`. `cors()` is permissive and servers listen on `0.0.0.0`. | Local-first authenticated sessions/authorization + WS upgrade check + appropriate origin policy; verify without a login. |
| C-02 | `server/certs/server.key` | TLS private key committed to a public repo. | Replace key/cert, stop tracking, advise Git-history cleanup; never log secrets. |
| C-03 | `public/js/devices.js`, `public/js/logs.js` | Device names, statuses, owner labels, event data interpolated into `innerHTML`. | Safe DOM text insertion, static SVG only, XSS regression tests. |
| C-04 | `server/routes/commands.js` | Accepts any truthy `action`; no strict per-device allowlist. | Validate `on/off` only for lights; `lock/unlock` only for door; never blindly publish arbitrary actions. |
| C-05 | `server/routes/commands.js`, `server/voice/voiceHandler.js` | Treat MQTT publish as success and optimistically change DB. | Pending command IDs or a backend tracker; confirm from authoritative device status, timeout visibly. |
| C-06 | `server/mqtt/mqttClient.js` | Broker messages update status and are processed without authenticated transport in current LAN config. | Secure broker with credentials/ACLs as feasible; restrict local network and topics. |
| C-07 | `firmware/door_security/door_security.ino` | RFID UID is transmitted to server, which decides grant/deny. Relay auto-locks ~5s. | Threat model RFID cloning, avoid representing as high-security access control; show auto-lock only when firmware genuinely reports it. |
| C-08 | `server/voice/commandParser.js` | Substring word matching may match inside other words; mixed action terms (e.g. `open`) can resolve wrong intent. | Token-aware matching, typed intent, ambiguity handling, phrase tests; never unlock from uncertain recognition. |
| C-09 | `server/voice/voiceHandler.js` | Uses `Buffer.isBuffer(data)` for audio; `ws` can surface text messages as Buffers unless `isBinary` flag is checked. | Use `(data, isBinary)` and distinguish control JSON from audio; test reset control. |
| C-10 | `public/js/voice.js` | Existing init may start always-listening when mic permission was previously granted. | Default to deliberate tap-to-speak; visible, reliable stop; any wake-word mode must be user opt-in. |
| C-11 | `public/js/audio-processor.js` | Voice-activity gate sends active chunks and drops silence; may lose context/endpointing. | Preserve short pre-roll, final silence/end-of-utterance signal, voice timeout and backpressure; instrument accuracy. |
| C-12 | `public/index.html` | Remote Google Fonts URLs present. | Bundle properly licensed fonts or system fallback; test no external requests offline. |
| C-13 | `public/manifest.json` | Standalone manifest exists, no complete icon/service-worker offline contract. | Treat installed PWA/offline browser cache as planned until implemented/tested. |
| C-14 | `server/db/database.js` | `sql.js` exports/writes the full DB frequently, including after executed mutations. | Check responsiveness and retention; protect personal RFID/access logs; define backup/restore policy. |
| C-15 | `server/voice/download-models.js` | Internet-requiring download tool ships; a zip extraction script uses Windows PowerShell. | Installation may use internet, **runtime must not**; document Windows-specific provisioning and verify asset readiness before use. |
| C-16 | `public/js/devices.js` | `renderSingleDevice` uses a CSS selector interpolating the device ID. | Constrain ID format or use safer DOM targeting; don't trust arbitrary new device IDs as selectors. |
| C-17 | `server/routes/logs.js` | RFID cards are stored by UID; add uses `INSERT OR REPLACE` in DB, not a uniqueness error on duplicates. | Specify upsert semantics in UI, avoid “already exists” assumptions, show owner/authorization changes accurately. |
| C-18 | device online state | ESP board online indications and per-device DB `is_online` can be stale or diverge. | Choose explicit source-of-truth freshness policy and never equate stale “last state” with a live verified state. |

These are **static review findings**, not evidence of successful exploitation. Do not execute destructive security demonstrations against real hardware without explicit permission and safety controls.

## 14. Domain contracts for implementers (proposed adapters, not existing TS types)

The original frontend is vanilla JavaScript. The following TypeScript-like types are **suggested interfaces** for reasoning and tests, not claim that a TypeScript project or `code.ts` already exists:

```ts
// From existing API, preserve DB field names at the network boundary.
type CurrentDevice = {
  id: string; // e.g. light-1, door-1, sensor-gas
  name: string; type: 'light'|'door'|'sensor'|string;
  location: string; status: string;
  is_online: 0 | 1; last_seen: string | null;
  created_at: string;
};

type DeviceDisplayState = {
  id: string;
  title: string; roomId: string; kind: 'light'|'door'|'gas'|'motion'|'unknown';
  reportedStatus: string | null; // source-observed status, not requested status
  connectivity: 'online'|'offline'|'unknown';
  statusFreshness: 'current'|'stale'|'unknown';
  pendingAction?: { action: string; startedAt: number; requestId?: string };
  lastSeenAt?: string | null;
  warning?: string;
};

type HomeThemeId = '01' | '03' | '04' | '05';
type VoiceUiState =
  'disabled'|'unavailable'|'ready'|'permission_needed'|'listening'|
  'processing'|'awaiting_device'|'speaking'|'completed'|'error';
type UserRole = 'owner'|'resident'|'viewer'; // PLANNED, no auth in source
```

**Normalization rules:** statuses `on/off`, `locked/unlocked`, `normal/alert`, and `clear/detected` retain their device meanings. Do not coerce any status string into a universal truthy `on`. `null`, missing, timed out or stale is **unknown**, not “safe”, “normal” or “off”. Use locally generated timestamps only to label “received at”; do not claim a device sent a timestamp if it did not.

**Room data:** the DB currently stores a plain `location` string; give it a stable canonical key in a UI adapter, but keep existing display and ID mapping until the user edits it. Future room management can add separate persisted room records. Never force `light-1` to a hypothetical Living Room merely to match the images.

**User preferences (proposed):** localStorage keys `homeauto.theme.v1`, `homeauto.largeText.v1`, `homeauto.reducedMotion.v1`, `homeauto.homeName.v1`, `homeauto.voicePrefs.v1`. Theme `05` when absent/invalid. These values should never confer permissions or grant access to protected device actions.

## 15. Operating modes and what “offline” means

| Operating mode | Internet (WAN) | Home LAN/server | MQTT/ESP32 | Required UX |
|---|---:|---:|---:|---|
| Fully working locally | No | Yes | Yes | All supported controls and local voice can work; “Internet not needed.” |
| Browser loads, home hub unavailable | Either | No | Unknown | Retry/reconnect; last known values clearly marked stale; commands disabled. |
| Hub online, device controller offline | Either | Yes | No for that device | Other devices may work; affected controls show unavailable. |
| Local STT/TTS not installed | No | Yes | Yes | All manual controls work; assistant shows “Needs local setup.” |
| Microphone denied | No | Yes | Yes | Type or tap controls; no permission loop. |
| New device first boot | No | Yes | Requires provisioning | Device setup with explicit LAN/MQTT instructions; no fictional one-tap cloud pairing. |

“Everything offline” means **offline from the public internet**, not that devices magically work without a network link. Initial model installs, npm package installation and optional app updates may use internet while provisioning; **runtime** must work without WAN. A smart-home app controlling an ESP32 from another device requires a reachable local network/broker.

## 16. Speech stack decision framework (explicitly pending benchmark)

**Constraints:** CPU-only deployment, no mandatory cloud APIs, preference for ~1 GB of **total STT+TTS model files**; separate memory budget is a performance consideration. Support Hindi, Indian-accent English, common Hindi-English switches, room names, and noisy household speech. 

**Pipeline contract:**

```text
Mic permission after user gesture
   -> tap-to-talk (wake-word is optional/opt-in later)
   -> local audio capture + VAD + utterance segmentation
   -> local multilingual STT (e.g. whisper.cpp quantized)
   -> normalization + constrained intent parsing
   -> role/permission and high-risk action policy
   -> MQTT command dispatch
   -> wait for ESP32 status acknowledgement / timeout
   -> human-readable local response
   -> local Hindi/English TTS when installed and supported
```

**Provider adapter suggestion:** `SpeechRecognizer.transcribe(utterance)`, `IntentResolver.parse(transcript, homeDevices)`, `CommandDispatcher.execute(intent, authContext)`, `SpeechSynthesizer.speak(text, language)`. Prefer process isolation for inference; don't block the Node event loop with CPU-intensive work. The browser may play local server-generated speech; it should not call `window.speechSynthesis` as a guaranteed-offline solution. No Google Web Speech API recognition.

**Benchmark before selecting models:** test model storage and peak working memory separately; measure cold start, warm response, Hindi pronunciation, English Indian accent, Hinglish switches, false activation, failure/retry handling, local text input, and core lights/door safety. Quote measured timings only, not speculative latency numbers. Verify licensing and redistribute model files only where terms allow.

**Why deterministic intent first:** a small, explicit action grammar with clarification is safer than letting an LLM invent devices or send arbitrary MQTT payloads. Use an optional local LLM only for noncritical chat/interpretation with a strict approved-tool boundary. Authentication is required even if the intent was correctly recognized.

## 17. What must survive a later context reset

If a different AI agent, chat, or repository branch continues the work, hand it this minimum immutable state:

```text
PRODUCT: HomeAuto (user-facing) + Shrimaan (offline bilingual assistant)
GOAL: approachable family smart-home UI, mobile-first, CPU-only/no-WAN runtime
REPO: https://github.com/Mishrajishri/homeauto
BASELINE: main @ 08e1b2013375fa794175dd7a6d462fdd0c536c89
FRONTEND TODAY: vanilla HTML/CSS/JS, single-page dashboard, no front-end framework
BACKEND: Node/Express + ws + MQTT + sql.js + Vosk
HARDWARE: 4 lights, 1 door, gas sensor, PIR motion; 2 ESP32s
THEMES: 05 Serene Emerald DEFAULT; selectable 01 Warm Organic, 03 Universal Comfort, 04 Friendly Pastel
NAV: Home, Rooms, Security, Assistant, Settings; Activity secondary
REFERENCES: reference-images/theme-{01,03,04,05}-*.png bundled in the docs
HARD LIMIT: never present mockup cameras/AC/fans/music/scenes as current hardware
P0: unauthenticated device/door control, published TLS private key, unsafe HTML, false hardware success
OFFLINE AI: local STT + intent + TTS later; no cloud or Web Speech API reliance
EXECUTION: read context.md, design.md, plan.md; inspect current tree; build incrementally; test every interaction
```

## 18. Future decisions deliberately not fixed by these documents

- Which individual self-hosted AI model/quantization wins CPU benchmarking; avoid hardcoding an untested choice into the UI.
- Whether the eventual build uses TypeScript; current code is browser JS. Only migrate deliberately, with a working build/tooling path if requested.
- How family member accounts and pairing will be implemented; **do not invent accounts, passwords, or users**.
- Cameras, additional appliance types, scenes, home-arming modes, and remote access; scope separate from this redesign.
- Home floor plan, room names, personal photos, household identities; mockup names and faces are not user data.

**Context completion test:** a fresh implementation agent should be able to explain exactly what exists, which pages/themes to produce, which actions must stay disabled until secure, how to interpret offline, and what not to fake **without consulting prior conversation**.
