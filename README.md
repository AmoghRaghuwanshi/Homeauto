# HomeAuto 2.0

Moving to another laptop? Follow [setup.md](setup.md) for the complete Windows installation, first launch, ESP32/MQTT commissioning, optional local speech/face model trials, backup and troubleshooting guide.

Current voice architecture (2026-11-15): the browser uses Web Speech recognition and synthesis. The local hub validates recognized text over an authenticated WebSocket and owns device execution. No HomeAuto speech model or Python environment is required. The hub must remain running for controls. Browser recognition may require internet; this voice mode is not guaranteed offline. The earlier [hub AI execution plan](docs/cloud/HUB_AI_EXECUTION_PLAN.md) is retained as historical planning, not the active speech implementation.

This repository contains two supported runtimes: the offline household hub and
an optional authenticated Vercel/Neon cloud API. Start with
[deployment readiness](docs/cloud/DEPLOYMENT_READINESS.md) and
[full verification](docs/verification/FULL_SYSTEM_VERIFICATION.md).
The cloud site is live at [HomeAuto](https://homeauto.amoghbuilds.tech).
[Create an account](https://homeauto.amoghbuilds.tech/signup) or
[sign in](https://homeauto.amoghbuilds.tech/login). Each new account gets a private
home; devices require gateway enrollment. Git-triggered deployment stays disabled;
tested releases are deployed explicitly. Publishing source does not activate hardware.

Cloud signup accepts passwords of10–256 characters. Existing account passwords do
not change when the minimum length changes. Use the same registered username to
sign in; a duplicate signup never replaces an existing account's credentials.

A local Node/Express smart-home hub with four themes, Hindi/English interface,
authenticated controls and browser-managed speech. The active app uses vanilla ES
modules; no build step, CDN or cloud identity is required for local controls.
Browser recognition may use the browser vendor's speech service.

The software has isolated tests and real cloud signup/auth checks. Physical household release remains
blocked on supervised firmware/broker/door safety checks and human speech and
accessibility trials. See [implementation journal](HomeAuto_UIUX_Docs/IMPLEMENTATION_JOURNAL.md).

## Start HomeAuto and connect hardware

Install Node.js 22 and the dependencies with `npm ci --ignore-scripts` and `npm ci --ignore-scripts --prefix server`. On Windows, double-click **Start-HomeAuto.bat**. It starts the authenticated hardware hub on port 3001 and opens `http://127.0.0.1:3001/modules`. Closing the launcher window leaves the hub running. If Node.js 22 is outside PATH, set `HOMEAUTO_NODE` to its `node.exe` path. Startup logs are in `.local/launcher`.

On a new laptop, choose a local owner username and password in the one-time setup form. Then use **Modules** to configure the hub's MQTT broker connection, reconnect it, configure the camera's LAN address and inspect controller/sensor status. Configure controller Wi-Fi and its MQTT credentials in the ESP32 firmware. The broker must already be running and support the required authentication and TLS settings.

A successful broker connection alone does not enable the assistant or home controls. A supported ESP32 controller must supply fresh, non-retained reports. On disconnect, assistant requests are rejected and the UI returns to controller setup. Modules and owner authentication remain available during an outage. The camera and individual sensors are optional and show their own warnings. Camera network reachability is displayed separately from verified video. Actual CP-E31A capture and face/vehicle recognition remain pending camera compatibility verification.

Normal startup and online onboarding use real hardware. Development fixtures are retained only for automated tests. Runtime module configuration is encrypted under the current Windows user using DPAPI, or with a user-private AES key on other supported Node systems. Passwords are never returned by the Modules API. The hardware database is durable and existing door permissions and physical commissioning gates still apply.

Open Assistant and select **Start conversation** for repeated turns, or tap the microphone for one request. Browser speech output finishes before listening resumes, with a 350ms quiet buffer. **End conversation**, navigation, hiding the tab, typing or microphone/network errors stop the automatic session.

Choose English or Hindi for recognition. Automatic listening follows the app language because standard browser recognition accepts one language; automatic replies follow the recognized words even when the decoder hint differs. Keep Reply language on Automatic to match each request. Hindi output needs an available Hindi voice. Speech support and latency depend on the browser and its provider; zero latency and offline recognition are not promised.

The [browser conversation report](docs/verification/BROWSER_VOICE_ASSISTANT.md) describes the current architecture and acceptance evidence. Greetings, home controls, current status and capability guidance use the existing bounded English/Hindi parser. Try “What can you do?” or “कृपया लाइट दो चालू करो.” General knowledge questions remain outside scope; no LLM or cloud Live API is used.

Manual mic clicks never require a wake word. For hands-free activation, enable **Settings → Voice & assistant → Enable wake-word listening**. Say Shrimaan, Shreeman or Shiman while the page is visible. Idle listening pauses for speech output and resumes after a quiet buffer. **Stop wake listening** stops it. The option persists, but refresh/backgrounding never silently reopens the microphone. Browser recognition may send ambient audio to its provider.

Assistant also keeps a live, multi-turn chat log in memory (up to 40 turns), cleared by refresh, Clear conversation or changing the current home/account.

## Run the real hub

1. Stop every hub process; preserve a private copy of `server/db/home_auto.db`.
   A first migration also creates a permanent `.pre-v5.bak`. No production database
   was migrated during development tests.
2. From `server`, run `npm run setup -- add-user YOUR_NAME owner`. Enter a unique
   password of at least 12 characters at the hidden prompt. There is no default
   account. Use `resident` or `viewer` for more limited users. Owner creation grants
   unlock permission, but the independent door safety gate stays disabled.
3. Run `npm start`. Default binding is **127.0.0.1:3000**, MQTT disabled, door
   disabled. Without fresh TLS files the loopback development URL is HTTP. Local
   manual controls need an authenticated MQTT connection and live boards.
4. Configure the environment using [operator guide](HomeAuto_UIUX_Docs/OPERATIONS.md)
   before LAN use. `.env` files are not automatically loaded. Do not copy example
   passwords or enable the door while its safety checks are outstanding.

The original firmware topics, IDs and pins are preserved. Legacy sketches use
anonymous TCP MQTT and blocking reconnect loops; they **cannot** be deployed
unchanged with the secure broker template. No firmware was flashed. The old
bundled certificate/key is never read by the new runtime.

## Verify

```powershell
Set-Location Homeauto
npm run test:publication
npm run build
npm test
npm --prefix server run test:ux
npm --prefix server run test:remediation
npm --prefix server run test:browser-voice
npm --prefix server run test:browser-conversation
node server/scripts/online-browser-check.js
```

Browser tests need `npm exec --prefix server -- playwright install chromium`.
The mobile suite also covers WebKit: install with
`npm exec --prefix server -- playwright install chromium webkit`, then run
`npm --prefix server run test:mobile` and
`npm --prefix server run test:mobile -- --browser=webkit`.
Use `npm --prefix server run test:signup -- --browser=chromium` and
`npm --prefix server run test:signup -- --browser=webkit` for the isolated account,
auth-screen, theme, accessibility and history-write regressions.
Browser-conversation acceptance uses substituted recognition/synthesis APIs with the real local WebSocket/API and a simulated publisher. It does not certify the browser vendor's recognition, actual microphone quality or natural spoken voice quality. Legacy native speech scripts are historical utilities and are not part of the active browser setup. Tests do not prove physical relay position or gas calibration. Test output and images are written only under ignored `.local/qa` by default.

## Source map

| Area | Active entry points |
|---|---|
| Lifecycle and configuration | `server/server.js`, `server/lifecycle.js` |
| HTTP and realtime | `server/app.js`, `server/realtime.js` |
| Storage/authentication | `server/db/repository.js`, `server/db/maintenance.js`, `server/auth/sessions.js` |
| Command/observation policy | `server/services/home.js`, `server/mqtt/broker.js` |
| Assistant and speech | `server/services/assistant.js`, `server/voice/intent.js`, `server/voice/browser-speech-service.js`, `public/js/browser-voice.js`, `public/js/live-conversation.js` |
| Interface | `public/index.html`, `public/js/main.js`, `views.js`, `components.js`, `public/css/` |
| Operations/tests | `server/scripts/`, `server/tests/`, `deploy/` |

Old route modules, `database.js`, `mqttClient.js`, `commandParser.js`, voice handlers
and old frontend scripts/styles are retained as historical source, unmounted and
unloaded. They are not alternative entry points. Use `npm start` only. Baseline
source, database, certificate files and reference images were backed up with a
SHA256 manifest in `.local/backups/baseline-20261105` before implementation.

## Cloud deployment selection

Import AmoghRaghuwanshi/Homeauto, main branch. Select **Other** as Framework
Preset, repository root (`./`), Node22.x, build `npm run build`, output `public`,
install `npm ci --ignore-scripts`. Keep cloud/gateway remote-light gates OFF.
Use an approved isolated Neon branch and restricted pooled DATABASE_URL for the
API; reviewed migrations/grants use the private direct operator URL. Do not
deploy the server folder or native speech workers to Vercel. Complete
[migration](docs/cloud/DATABASE_MIGRATION.md) and
[Vercel/domain](docs/cloud/VERCEL_DEPLOYMENT.md) gates first.

The supported cloud target is server/online. server/cloud is retained as a
legacy metadata-only compatibility mode and shared pure validation/pg helpers;
it must not run concurrently with the online gateway. It is not a second
production deployment required by this architecture.

## Private files and speech assets

The repository excludes household databases/backups, certificates/private keys,
credentials, recordings/transcripts/logs, .local, dependency directories, native
environments and model weights. Create new private state during setup. Never
copy historical data/key material into Git or use the old key. No household
database is needed for tests or preview.

No speech asset provisioning is required. The previous Whisper/Kokoro weights, native environments, tools and generated fixed-audio cache were moved outside this checkout into a recoverable local archive. Native worker source/tests and dated results remain historical references; the active lifecycle does not import those workers. No runtime endpoint downloads models. Typed controls remain available when browser speech is unsupported.

No project-wide open-source license has been selected for original source;
this public source publication does not add a permissive license. Dependency
and asset licenses remain upstream; see [notices](public/assets/NOTICE.txt).
No large model, native binary or redistribution-ready speech bundle is shipped.
