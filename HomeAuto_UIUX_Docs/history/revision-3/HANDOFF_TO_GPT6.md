# HomeAuto — handoff to GPT-6 Soul High

Revision 3 · 2026-11-05 · workspace `D:\homeauto-main`.

**Planning is complete; production coding has not started. First pending implementation task: HA-002 in [TASKS.md](TASKS.md).** Read this file and the linked contracts before editing. Do not treat the older three-document pack's ticket meanings or remote commit as the current local baseline.

## 1. Product and repository summary

HomeAuto is an offline-first household control application. Keep Node/Express, vanilla HTML/CSS/JavaScript, ws, MQTT, sql.js and the existing ESP32 protocol. Two ESP32 boards control four binary light relays, one timed door relay/RFID reader, one uncalibrated gas sensor and one PIR motion sensor. Shrimaan is the local Hindi/English assistant; current speech prototype uses Vosk, not Whisper/TTS/LLM. CPU-only STT/TTS improvements require measured selection. All everyday functions must operate without public internet after setup, over a reachable local network.

The local folder has **no `.git` metadata**. Older docs mention remote `main` commit `08e1b2013375fa794175dd7a6d462fdd0c536c89`; that is historical, not a verified local HEAD. Preserve local files. Establish a backup or reconcile an actual checkout before source changes; never overwrite this tree with a fresh clone to make Git commands convenient. No push/commit/deployment was requested in the planning session.

Current exact application layout:

```text
D:\homeauto-main\
  firmware\
    light_controller\light_controller.ino
    door_security\door_security.ino
  public\
    index.html
    manifest.json
    css\style.css
    js\app.js
    js\devices.js
    js\logs.js
    js\notifications.js
    js\websocket.js
    js\voice.js
    js\audio-processor.js
  server\
    server.js
    package.json
    package-lock.json
    node_modules\                 installed, not application source
    config\config.js
    db\database.js
    db\home_auto.db               existing local data; do not mutate in tests
    routes\devices.js
    routes\commands.js
    routes\logs.js
    mqtt\mqttClient.js
    voice\commandParser.js
    voice\voiceEngine.js
    voice\voiceHandler.js
    voice\download-models.js
    voice\models\en\{README,am,conf,graph,ivector}
    voice\models\hi\{README,am,conf,graph,ivector}
    certs\generate-cert.js
    certs\server.cert
    certs\server.key               sensitive existing file; do not print/copy
  HomeAuto_UIUX_Docs\
    context.md, design.md, plan.md
    ARCHITECTURE.md, COMPONENT_SPEC.md, SCREENS.md, THEMES.md
    OFFLINE_AI.md, API_CONTRACTS.md, SECURITY.md, TEST_PLAN.md
    DECISIONS.md, HANDOFF_TO_GPT6.md, TASKS.md, PLANNING_AUDIT.md
    reference-images\
      theme-01-warm-organic.png
      theme-03-accessible-family.png
      theme-04-pastel-blue.png
      theme-05-serene-emerald-default.png
```

No AGENTS.md, application tests, application test script, broker config or firmware lockfile found in planning. Reinspect for changes. No new production files listed in architecture proposals exist merely because this handoff names them.

## 2. Read in this order

1. [context.md](context.md), active local correction block first: current facts, inventory and evidence limits.
2. [DECISIONS.md](DECISIONS.md) and [SECURITY.md](SECURITY.md): selected boundaries and physical-use blockers.
3. [ARCHITECTURE.md](ARCHITECTURE.md) and [API_CONTRACTS.md](API_CONTRACTS.md): modules, every public method, migrations, exact existing/planned REST/WS/MQTT contracts.
4. [design.md](design.md), [THEMES.md](THEMES.md), [COMPONENT_SPEC.md](COMPONENT_SPEC.md), [SCREENS.md](SCREENS.md); visually inspect all four original reference PNGs. Written revision3 contracts resolve older illustrative alternatives.
5. [OFFLINE_AI.md](OFFLINE_AI.md): primary-source candidate comparison, CPU/storage/RAM distinction, safety parser and benchmark gates.
6. [plan.md](plan.md), [TASKS.md](TASKS.md), [TEST_PLAN.md](TEST_PLAN.md), [PLANNING_AUDIT.md](PLANNING_AUDIT.md): execution, dependencies, actual vs planned validation.

Actual current source controls baseline claims; the latest user request controls scope. If source drift exists, record it and adjust contracts explicitly. Do not silently change the design or enable invented features.

## 3. Confirmed environment and what must survive

Node20.19.0, npm10.8.2, Python3.14.3; installed express4.22.2, mqtt5.15.1, sql.js1.14.1, ws8.20.1, vosk0.3.39, cors2.8.6, selfsigned5.5.0, nodemon3.1.14. Package ranges differ from installed exact versions; inspect lockfile. rg/Git/ffmpeg available; mosquitto/arduino-cli/cmake not on PATH. Do not assume native Vosk works because package exists. CPU observed i5-12450H,8 cores/12 logical, not a performance benchmark.

Preserve stable IDs and mapping:

| IDs | Hardware / initial room | Exact command topics |
|---|---|---|
| light-1, light-2 | active-HIGH GPIO4,5, Room1 | home/light/1/command, home/light/2/command |
| light-3, light-4 | GPIO18,19, Room2 | home/light/3/command, home/light/4/command |
| door-1 | door relay GPIO4, Entrance; RC522 SPI | home/door/1/command:lock/unlock/deny; firmware also toggle_lock, not a planned UI command |
| sensor-gas | analogGPIO34, Kitchen | read-only home/sensor/gas/data |
| sensor-motion | digitalGPIO27, Hallway | read-only home/sensor/motion/data |

Board IDs `lights` and `door`; status topics retained, ordinary sensor/RFID messages non-retained; heartbeat30s. Full schemas/pin assignments in context/API/firmware. Do not swap source bedroom→Room1/living room→Room2 aliases to match a guessed floor plan. Owner confirms room aliases; displayed room names remain existing until edited.

Current functionality that must survive incremental changes: manual binary lights, door lock/unlock with timed relay behavior, RFID authorized/denied scan handling, card register/revoke, gas/PIR events, activity, notifications, browser synchronization and offline Vosk fallback. These paths exist in source; live operation was not verified this session. Safety fixes intentionally change insecure behavior (auth, action validation,202pending, duplicate-card409, fixed-device deletion restriction), so update frontend/backend/tests as coherent groups.

## 4. Product and coding rules

- Theme05 Serene Emerald first installation default. Settings offers exactly05,01,03,04; theme preference `homeauto.theme.v1`, root data-theme,05 invalid/missing fallback. Every route uses the same components/tokens. Large text/controls independent from theme03. No automatic dark/theme02.
- Five primary destinations, Activity secondary. Responsive mobile bottom nav, tablet rail, desktop sidebar. Minimum48px targets, clear keyboard focus, Hindi and English UI,200%/400% reflow, reduced motion, readable error/unknown states.
- No cameras, AC, fans, curtains, dimming, climate, extra doors, security arming, media/scenes merely from posters. Don't use poster images as app background or working UI. Optional room photos local/licensed, icons original/staticSVG.
- Preserve CommonJS backend and namespaced vanilla frontend pattern. Two-space indentation, semicolons, camelCase methods, wire/DB snake_case. Extract testable modules and safe DOM incrementally; no framework/TypeScript migration required.
- Server policy is authoritative. No secrets in docs/logs/public assets. Don't put session token in localStorage. No cloud assets/inference, Web Speech recognition or guaranteed-offline browser speechSynthesis.
- Treat reported relay mode separately from pending actions and physical position. No physical lock contact exists; no physical confirmation claim. Don't turn `denied` into locked. Retained state and DBonline bits aren't current evidence; PIR changes-only needs last-event/unknown behavior.
- Door reconnect currently can stall auto-relock. Never promise a reliable5s countdown or unattended safety until HA-010/042 pass. No live unlock/test/flash as incidental refactoring. Independent gas alarm/egress required for everyday deployment; gas raw map is not calibratedPPM.

## 5. Exact first implementation task: HA-002

1. Reread current server/server.js, DB init/config, package scripts and relevant modules before editing. Check actual `.git`/working tree; preserve user work and current local DB/keys/model files. Establish a local backup/checkpoint without exposing secrets. If using a separate checkout, compare source rather than replace it.
2. Extract injectable app construction and lifecycle. `createApp(deps)` returns configured Express app without listeners, DB initialization/seed, MQTT/native models or timers. Keep direct `node server.js` startup behavior behind explicit composition/lifecycle entry; imports safe for tests.
3. Add meaningful Node built-in tests with fake repository, publisher, auth/speech and temporary DB paths. Reject tests configured for productionDB/broker. First smoke asserts import/createApp has zero live effects; health/error path test; pure parser fixtures capture unsafe examples as known failing behavior to fix in HA-029. Do not enshrine unsafe behavior as a required permanent regression. Baseline route fixtures may document current schemas without executing physical commands.
4. Verify existing JS syntax and new test scripts. Do not start production server merely to prove app importability. Do not install/update packages unless the coherent task requires it; Node test runner already available.
5. Update HA-002 only after actual file edits and passing checks. Record exact paths, commands/results, remaining baseline failures and next dependency-ready task (HA-003 persistence/M01/M02 or HA-006 safe DOM/privacy where independent).

Do not implement all44 tasks in one unreviewable batch. All subsequent exact dependencies/deliverables/acceptance conditions are in TASKS. Phases0–10 in plan:baseline→security/durability/commands→design system→shell/bilingual state→Home/Rooms→Security/RFID→Activity/Settings→offline speech→resilience/accessibility→hardware validation→release. Firmware safety may remain blocked on operator setup while isolated UI/service work proceeds.

## 6. Verification commands and limits

Existing development scripts, from `D:\homeauto-main\server`:

```powershell
npm start        # node server.js; CURRENTLY writes/seedsDB and connectsMQTT
npm run dev      # nodemon server.js; same sideeffects,not an isolated test
npm ls --depth=0 --ignore-scripts
```

There is **no npm test yet**. Add/document test scripts in HA-002; don't report a nonexistent command passed. Safe syntax command from workspace root:

```powershell
$ErrorActionPreference = 'Stop'
$files = Get-ChildItem -LiteralPath '.\public\js','.\server' -Recurse -File -Filter '*.js' |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\models\\' }
foreach ($file in $files) {
  node --check $file.FullName
  if ($LASTEXITCODE -ne 0) { throw "Syntax failure: $($file.FullName)" }
}
```

Planning verified19 syntax passes, dependency inventory, read-only DB7/0/44counts, pure parser bugs, isolated `/voice`400. No UI app rendering, human usability, real broker, firmware, mic/STT/TTS/model native load or physical tests passed. Relevant cases and future scripts in TEST_PLAN; verify each change at the right level. Native benchmarks must report CPU/threads/RAM/modelhash/corpus/latency and exact results, not upstream WER as local accuracy.

## 7. Security restrictions and known uncertainties

Before unrestricted live use:auth/RFID permissions, XSS, CSRF/origin/Host, WS guards, TLS rotation/trust, MQTT credentials/ACL, validated actions, command observation, DBdurability and hardware failsafe must pass. Existing private key treated compromised/shared; rotate outside tracked source in coding/deployment task, never print it. No auto-retryunlock/offline action queue/retained commands. Voice/textunlock routes user to protectedSecurityUI. No arbitrary modelURL/upload/path/shell endpoint. Worker bounded and local; mic off by default; raw audio/transcripts not retained or broadcast by default.

Uncertainties:actual local Git provenance; broker service/version/network/trustedhost; physical door fail mode/position; Windows Vosk/native audio; CPU/RAM/latency/Hinglish quality; Hindi TTS provenance/pronunciation; room aliases; phone certificates/notification behavior; Windows atomicwrite/restore. Each has task+verification in DECISIONS; these are no reason to fake values or redesign defaulttheme. Do useful independent simulator work while waiting for physical/operator prerequisites. Ask for missing secrets/setup only when needed, never copy them into docs.

## 8. Progress and context preservation

After each coherent task:inspect diff, run relevant tests, record exact outcomes and scope in TASKS ledger, update affected contracts if intentionally changed, report risks/nexttask. A tick requires evidence; keep blocked hardware/inference checks pending. On resumption reread handoff+TASKS, current source/diff, then relevant contracts; prior chat claims alone aren't proof. Preserve task IDs in notes. Record source checkout/hash, changed paths, last tested route/theme/language, unresolved failures, next action. No silent theme/hardware/language/security scope changes. Model selection remains evidence-driven; changing speech adapter doesn't permit changing safety policy.

## 9. Ready-to-copy coding master prompt

> Act as the implementing engineer for HomeAuto in D:\homeauto-main. Read HomeAuto_UIUX_Docs/HANDOFF_TO_GPT6.md and its documentation reading order before editing. Verify actual source and local version-control state; the current folder may have no .git. Preserve local work, hardware IDs, MQTT topics, RFID, sensors, notifications and synchronization. Use existing Node/Express/CommonJS, vanilla JS, ws, MQTT, sql.js and Vosk baseline, incrementally. Implement the first pending dependency-ready task in TASKS.md—initially HA-002—in real files, one coherent task or dependency group at a time. Make app construction importable and inject test dependencies before any live startup; tests must not touch productionDB/broker/door. Add meaningful tests, run available checks, inspect actual changes and update tracker only after verified completion. Use Theme05 Serene Emerald by default with selectable01/03/04, shared semantic tokens, accessible responsive five-screen architecture, Hindi and English UI, no fictional hardware/cloud dependencies. Follow exact methods/REST/WS/MQTT/migrations in ARCHITECTURE and API_CONTRACTS. Enforce local auth/permissions/CSRF/session guards and sharedcommand orchestration. Separate accepted/published/controller-reported/uncertain; there is no physical bolt sensor. Voice/text must not directly unlock. No background mic on startup, no raw audio/transcript retention by default, no automatic unlock retries or offline action queue. Treat firmware reconnect/relock and broker/TLS provisioning as real-use gates requiring supervised validation. Benchmark CPU-only localSTT/TTS before claiming latency/accuracy; manual/text controls must work with models absent. Reuse selected reference images only as visual guidance; do not turn concept cameras/AC/fans/scenes into devices. After each task report changed absolute paths, tests and exact results, security/privacy impact, unverified limits, and nexttask. Never report untested features as tested, never silently change product requirements, and don't push/deploy/flash or actuate physical locks without explicit scope and safe operator setup.

Planning and architecture are ready for GPT-6 Soul High. Open HANDOFF_TO_GPT6.md and begin with the first pending implementation task.
