# HomeAuto 2.0

This repository contains two supported runtimes: the offline household hub and
an optional authenticated Vercel/Neon cloud API. Start with
[deployment readiness](docs/cloud/DEPLOYMENT_READINESS.md) and
[full verification](docs/verification/FULL_SYSTEM_VERIFICATION.md).
Git-triggered Vercel deployment is deliberately disabled until a separate
staging/deployment review. Publishing source does not activate hardware.

A local Node/Express smart-home hub with four themes, Hindi/English interface,
authenticated controls and CPU speech workers. The active app uses vanilla ES
modules; no build step, CDN, cloud identity or cloud speech service is required.

The software is implemented and tested in isolation. Household release remains
blocked on supervised firmware/broker/door safety checks and human speech and
accessibility trials. See [implementation journal](HomeAuto_UIUX_Docs/IMPLEMENTATION_JOURNAL.md).

## Run the isolated preview

```powershell
Set-Location Hosmeauto
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix server
Set-Location server
npm run preview:isolated
```

Open http://localhost:3001. The preview opens directly without login, account or
sign-out options. The visible Simulation banner identifies the in-memory fixture.
This process never opens a real MQTT connection or production database. Ctrl+C
stops it. Native voice is available when the local assets and Python environment
exist. Authentication remains enabled for the separate physical-device runtime.

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
Set-Location Hosmeauto
npm run test:publication
npm run build
npm test
npm --prefix server run test:ux
npm --prefix server run test:remediation
node server/scripts/online-browser-check.js
```

Browser tests need `npm exec --prefix server -- playwright install chromium`.
Native speech tests (`test:speech`, `test:voice-browser` in server) separately
need FFmpeg, installed local models and the pinned Python environment. Fixtures
are synthetic and hardware responses are simulated. Tests do not prove physical
relay position, gas calibration or human speech accuracy. Test output and images
are written only under ignored `.local/qa`.

## Source map

| Area | Active entry points |
|---|---|
| Lifecycle and configuration | `server/server.js`, `server/lifecycle.js` |
| HTTP and realtime | `server/app.js`, `server/realtime.js` |
| Storage/authentication | `server/db/repository.js`, `server/db/maintenance.js`, `server/auth/sessions.js` |
| Command/observation policy | `server/services/home.js`, `server/mqtt/broker.js` |
| Assistant and speech | `server/services/assistant.js`, `server/voice/intent.js`, `speech-service.js`, isolated workers |
| Interface | `public/index.html`, `public/js/main.js`, `views.js`, `components.js`, `public/css/` |
| Operations/tests | `server/scripts/`, `server/tests/`, `deploy/` |

Old route modules, `database.js`, `mqttClient.js`, `commandParser.js`, voice handlers
and old frontend scripts/styles are retained as historical source, unmounted and
unloaded. They are not alternative entry points. Use `npm start` only. Baseline
source, database, certificate files and reference images were backed up with a
SHA256 manifest in `.local/backups/baseline-20261105` before implementation.

## Cloud deployment selection

Import AmoghRaghuwanshi/Hosmeauto, main branch. Select **Other** as Framework
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

Speech is optional during source checkout verification. Provision the exact
files/hashes in server/voice/asset-manifest.json using the upstream Vosk and
Kokoro distributions described in
[offline speech](HomeAuto_UIUX_Docs/OFFLINE_AI.md) and
[operations](HomeAuto_UIUX_Docs/OPERATIONS.md). Verify HTTPS source, version,
SHA256, archive paths and model/voice license notices before extraction into
the ignored private asset directories. No runtime endpoint downloads models.
Native dependencies require the appropriate local build tools; install/enable
them only in that private setup. Typed controls stay available without models.

No project-wide open-source license has been selected for original source;
this public source publication does not add a permissive license. Dependency
and asset licenses remain upstream; see [notices](public/assets/NOTICE.txt).
No large model, native binary or redistribution-ready speech bundle is shipped.
