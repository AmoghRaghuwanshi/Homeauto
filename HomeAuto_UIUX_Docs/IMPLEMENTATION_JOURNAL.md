# HomeAuto — implementation journal

Revision 4 • 2026-11-05 • local development release 2.0.0

The user authorized direct implementation, dependency/model provisioning and
local testing. There is no model handoff. Work proceeded through the software
dependencies in the approved tracker. Production hardware, database, certificate
files and reference images were preserved. No live broker connection, real door
command, firmware flash, commit push, trust installation or deployment occurred.

## What is implemented

- New responsive Home, Rooms/detail, Devices/detail, Security/door/cards/alerts/
  activity, Assistant and all Settings subpages. Four semantic token themes:
  05 default, 01 warm, 03 comfort/blue microphone and 04 pastel rooms. Browser-local
  theme/accessibility/interface language; shared home/rooms and user favorites in
  the database. Local SVG illustration/icons, no external fonts or assets.
- Safe shared DOM components, keyboard-native controls/dialogs, 48px targets,
  Hindi/English labels and critical safety text, large text/controls, reduced
  motion, stronger outlines, history routing and microphone/audio cleanup.
- Injectable Express runtime, one authorized WebSocket upgrade dispatcher, bounded
  schemas, Host/Origin/CSRF checks, local console users, async scrypt, hashed
  sessions, roles, owner-only RFID administration and reauthentication.
- Durable command service shared by manual/text/voice/RFID paths. Idempotent
  requests, single-device pending locks, honest pending/uncertain states,
  nonretained fresh-report completion, no optimistic relay state or action replay.
  Session-bound unlock challenges; explicit door safety gate off by default.
- Additive schema-v5 migration, fixed registry, metadata versions, audit/latest
  sensors, alert episodes/receipts, atomic export/rollback, single-writer PID lock,
  daily backups, bounded retention and validated recovery CLI. Original 44 audit
  rows are preserved by migration and excluded from automatic retention.
- Session-bound deterministic Hindi/English/Hinglish typed intents and queries;
  explicit negative/ambiguous/conflicting/unsupported rejection. Gesture-only
  capture, streaming 16k PCM resampler/VAD, 20s bound, single-use voice tickets,
  isolated CPU Vosk and Kokoro workers, trusted response templates and local WAV
  playback. Recognized control requests require review because measured number
  recognition is unreliable. Voice/text cannot directly unlock.
- SHA256 model verification/native readiness, fixed installed-profile diagnostics,
  broker ACL/TLS environment templates, safe fresh-certificate tooling, runtime
  manifest, offline help and operator/run/recovery instructions.

## Change map

| Purpose | Exact project paths (root `D:\homeauto-main`) |
|---|---|
| Entries and dependencies | `.gitignore`, `README.md`, `server/package.json`, `server/package-lock.json`, `server/server.js`, `server/lifecycle.js`, `server/app.js`, `server/realtime.js` |
| Domain and storage | `server/lib/errors.js`, `server/lib/registry.js`, `server/auth/sessions.js`, `server/db/repository.js`, `server/db/maintenance.js`, `server/services/home.js`, `server/services/assistant.js`, `server/mqtt/broker.js` |
| Speech | `server/voice/intent.js`, `speech-service.js`, `stt-worker.js`, `tts-worker.py`, `assets.js`, `asset-manifest.json`, `requirements-lock.txt`, `whisper.js` (the latter is benchmark-only) |
| Browser | `public/index.html`, `public/manifest.json`, `public/css/tokens.css`, `public/css/app.css`, `public/js/main.js`, `views.js`, `components.js`, `api.js`, `state.js`, `preferences.js`, `theme-bootstrap.js`, `i18n.js`, `voice-controller.js`, `capture-processor.js`, `public/assets/home-scene.svg`, `icon.svg`, `NOTICE.txt` |
| Local tools | `server/scripts/operator.js`, `preview.js`, `tls-setup.js`, `recovery.js`, `speech-check.js`, `benchmark-speech.js`, `browser-check.js`, `native-browser-check.js` |
| Automated regression | `server/tests/core.test.js`, `http.test.js`, `tls.test.js` |
| Deployment examples | `deploy/homeauto.env.example`, `deploy/mosquitto.conf.example`, `deploy/homeauto.acl` |
| Documentation | Active files in `HomeAuto_UIUX_Docs`; revision-3 originals preserved in `history/revision-3`. This journal, `OPERATIONS.md` and `RUNTIME_CONTRACTS.md` record current behavior and exceptions. |

Baseline: `.local/backups/baseline-20261105/manifest.json`, SHA256 inventory of 48
original files. `.local` also contains installed speech environments/assets and
QA evidence; it is ignored and never statically served. Old unsecured route,
voice, DB and frontend modules remain unmounted/unloaded as historical source.

## Verification obtained

| Level | Command/evidence | Result / limits |
|---|---|---|
| Node/HTTP/WS/TLS | `cd server; npm test` | 63 passing tests. Legacy-copy migration 7 devices/44 rows, repeatability, disk-full rename rollback, writer lock, restart/no replay, command deadlines/retained reports/idempotency/offline, door policy, UID/roles/sessions, parser, HTTP schemas, CSRF/Host/Origin, private WS, alerts, pagination/redaction, retention, checksummed restore and fresh trusted TLS. All isolated. |
| Dependency security | `npm audit`; `npm audit --omit=dev` | Zero advisories at the recorded check. Removed nodemon and use Node watch. Lockfile synchronized to 2.0.0. Advisory state can change later. |
| Rendered browser | `npm run test:browser` → `.local/qa/browser/results.json` | Four themes × five widths (320/390/768/1024/1440) × five primary pages; Hindi mobile and accessibility preferences; secondary-route checks recorded by the script. No physical responses. Final counts are in the generated JSON. |
| Interaction | Browser flow checks | Login, default theme and persistence, favorite, light pending→simulated report, typed assistant, negative rejection, unlock reauth/Cancel and RFID injection rendered as literal text. |
| Native CPU speech | `npm run test:speech` → `.local/qa/speech/results.json` | Both English/Hindi Kokoro syntheses and Vosk native decodes succeeded. Initial cold readiness ~4.05s; English TTS ~1.62s, Hindi ~2.22s; Vosk RSS ~306MB. Hindi lost the room number and is rejected as ambiguous. Synthetic input only. |
| STT comparison | `npm run benchmark:speech` and `-- --small` | Nine synthetic English/Hindi/Hinglish samples per provider. Vosk, Whisper Base q5_1 and Small q5_1 each 5/9 exact outcomes, including two correct negative rejections; no wrong accepted actions in this tiny corpus. Vosk accepted 3/7 positive controls, Base 3/7, Small 3/7. No human accuracy claim. |
| Browser speech | `npm run test:voice-browser` → `.local/qa/native-browser-results.json` | Four assertions pass: no automatic capture, capture→worklet/VAD→WSS→native STT→review/Cancel with zero commands, reviewed execution with simulated reports, native TTS/audio playback/Stop. Zero page errors/external requests. Input is an injected synthetic MediaStream. Original Chromium fake-file microphone failed NotSupportedError on Windows; real microphone permission/hardware remains unverified. |

Base-run STT p50/p95: Vosk 1.40/1.86s; Whisper Base 2.75/3.30s. Small-run
Whisper p50/p95 11.81/13.16s. Vosk in that run slowed to 3.10/4.18s, so host load
confounds cross-run latency comparisons. RSS is measured only for Vosk; do not
invent Whisper/TTS peak memory. Active assets 506,702,900 bytes ≈483MiB; benchmark
models add 249,793,112 bytes ≈238MiB. CPU-only flags/providers were used. The
tiny synthetic corpus is neither consented human holdout data nor Indian-accent
coverage. No production speech-quality/latency gate is marked passed.

## Findings corrected during implementation

sql.js `run(sql, [])` only executed the first statement in a multi-statement schema
string; migration now runs unbound multi-statements correctly. Failed durable
exports restore the in-memory DB. Stale/replayed reports cannot complete commands.
MQTT QoS 1 could retry old lights after reconnect, so commands now use nonqueued
QoS 0. Invalid Unicode CSRF strings no longer throw buffer-length errors. Malformed
legacy JSON details cannot crash redacted activity. Expired login throttles prune
before map caps. Old sockets and late REST fetches cannot overwrite newer state.
Activity pages keep pagination on live updates. Voice/TTS results are cancelled
on navigation/clear/logout, and delayed playback honors Stop. Full-snapshot updates
refresh the global connection banner even when Assistant DOM remains stable.
Kokoro ONNX speed input types are cast from actual model metadata in an adapter
wrapper. Windows Whisper stdin produced no text; benchmark uses cleaned-up
temporary synthetic WAVs. A decorative room-number contrast failure was fixed.
Select controls received explicit accessible names after browser speech testing.

## Unresolved gates and exact continuation

1. Firmware and broker: no Mosquitto/Arduino toolchain or credentialed fixture
   exists here. Preserve IDs/pins; implement CA/auth firmware configuration and
   relock priority with build checks, then supervised outage/power/egress tests.
   Keep door disabled. Do not flash or attach a physical lock without approval.
2. Speech: obtain consented human Hindi/English/Hinglish/Indian-accent recordings,
   separate tuning/holdout sets and measure false actions, rejection, p50/p95,
   CPU and peak RSS on an idle target hub. Review Hindi translation and both voices
   with speakers. Current profile remains Vosk/Kokoro with review and typed/manual
   fallback; no model winner or human quality pass is asserted.
3. Deployment/accessibility: establish household HTTPS trust and test phones,
   real microphone denial/revocation, NVDA, keyboard, 200% zoom/forced colors,
   persistence-denied settings and older/nontechnical task trials. Package license
   texts and eSpeak source obligations before redistribution. No service worker,
   always-listening wake word or closed-browser alarm reliability is promised.
4. Resilience/release: supervised Windows process-kill/power interruption and
   service-user recovery; real broker ACL allow/deny fixtures; final release review
   only after the gates above. Daily backups are local, not disaster recovery.

The next independent step is reviewing the isolated UI via `npm run
preview:isolated`. The next release-critical engineering step is preparing the
authenticated TLS firmware and a supervised safe fixture for HA-009/010, without
enabling physical door control. All ordinary source/test work described above has
already been performed; no background future-work promise is made.


### 2026-11-05 — preview login deferred at user request

The loopback-only in-memory preview on port3001 opens directly without credentials. Account/sign-out controls and reauthentication prompts are hidden in this mode. Its guest session adapter is confined to server/scripts/preview.js; production runtime authentication remains intact. No persistent database change was made. Authenticated browser fixtures explicitly use loginRequired:true. Targeted fresh-browser checks pass for direct Home, hidden login/logout, unlock confirmation without password, typed simulated controls and retained CSRF checks; zero page errors. Evidence: .local/qa/no-login-results.json and no-login-preview.png.
