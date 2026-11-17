# HomeAuto local AI installation and launch — implementation handoff

> Listening model revision, 2026-11-14: the current replacement is multilingual Whisper medium through CPU INT8 faster-whisper, with Kokoro retained for spoken replies. See [installation and acceptance](verification/WHISPER_UPGRADE.md). Vosk-specific profile/native-binding instructions below describe the earlier baseline; use the replacement's pinned model manifest, STT environment and worker contract for new implementation. Human accent acceptance and the all-in-one installer remain required; do not infer them from synthetic tests.

Date: 2026-11-14 (Asia/Calcutta). Status: approved direction from the user; implementation specification, not an implemented installer. Intended implementer: SOL 6.1. Source baseline: `f9c2b36ac9206571a3275c1cea93c9b1338d358d`, plus the uncommitted planning updates in OFFLINE_AI.md, DEVELOPMENT_STATE.md and IOT_SOFTWARE_CONTRACT_VERIFICATION.md. Preserve those files and the UI rebuild.

## 1. Outcome and scope

A person clones or extracts HomeAuto on a supported Windows laptop, double-clicks `Run HomeAuto.bat`, follows first-run preparation, creates a local owner account if needed, and gets the real local HomeAuto interface in their browser. Local English/Hindi recognition and speech synthesis run on CPU. Subsequent launches work without internet once dependencies and models are installed. Models are installed on the home hub once. The public website will relay remote clients to that running hub for conversation and voice, as specified in docs/cloud/HUB_AI_EXECUTION_PLAN.md; remote clients need no model installation. Until that relay is implemented, the website explains the hub requirement and current local-interface limitation.

This work packages the existing Vosk/Kokoro pipeline. It does not claim general-purpose LLM conversation, perfect Indian-accent recognition, working physical hardware without commissioning, or immediate support for every OS/CPU. It must remain usable for typed/manual interaction if speech fails. Preserve Theme05 default, all four themes, mobile layouts, navigation, real authentication and IoT policy.

User-confirmed physical topology: all lights, gas/motion sensors and RFID-door features on one ESP32; commands over Wi-Fi; one laptop runs the hub and AI, another presents the UI. Public website access remains optional. This installer must not imply that USB is the command transport, that laptop B's localhost reaches laptop A, or that the current telemetry gateway already transports audio. The revised target adds a separately versioned conversation relay to the hub. Combined-board firmware remains a separate prerequisite for physical acceptance, documented in the existing IoT report.

### Deliverables

1. One obvious root launcher: `Run HomeAuto.bat`.
2. A first-run setup engine with verified runtimes, dependencies and speech assets; resumable stages; offline-bundle import; no global dependency requirement.
3. Repeatable startup, duplicate-launch handling, graceful shutdown and actionable diagnostics.
4. Real local account creation, persistent data and safe upgrades that retain existing installations.
5. Explicit local/cloud speech capabilities and website instructions with English/Hindi copy; install AI on the hub, not every remote client.
6. Native CPU speech smoke tests and clean-machine/offline installation evidence.
7. Updated operations/README documentation and a release manifest with actual versions, hashes, licenses and supported platforms.

Do not publish placeholder download links or label an unbuilt release “Download app”. GitHub publication/Vercel deployment are separate release actions after verification; this planning turn authorizes neither.

## 2. What is already implemented, and what is missing

| Existing path | Actual behavior | Required work |
|---|---|---|
| `server/server.js`, `server/lifecycle.js` | Real local server, runtime config, storage, sessions, speech workers, optional broker/gateway | Wrap startup; resolve managed config/paths; readiness and lifecycle integration |
| `server/scripts/operator.js` | Interactive hidden-password local account setup; local minimum12 | Reuse core user creation with password confirmation; no default credentials or cloud account substitution |
| `server/voice/speech-service.js` | Hash-check assets, spawn Vosk and Kokoro workers, bounded tickets/audio/jobs | Structured states, truthful probes, worker-generation ownership, bounded recovery |
| `stt-worker.js`, `tts-worker.py` | Native CPU English/Hindi recognition/output | Preserve baseline; verify clean install and dependency ABI |
| `asset-manifest.json` |30 installed asset hashes, but no complete installation catalog | Versioned provisionable profiles with archive provenance, hashes and extraction inventory |
| `download-models.js` | Only Vosk; no checksum verification; skips any nonempty model folder; shell-built extraction; final success despite failures | Replace with safe provisioner; compatibility shim must invoke the new implementation, not keep two installers |
| `requirements-lock.txt` |35 pinned Python package versions, no distribution hashes | Validate supported Python/architecture; lock wheel hashes and transitive dependencies |
| `server/package-lock.json` | Reproducible JS dependency graph including Vosk native dependencies | Native module proof on clean Windows; no assumptions based on the developer machine |
| `/api/runtime` | Local minimal descriptor; cloud capability map | Add backward-compatible capability/readiness contract |
| `public/js/voice-controller.js` | Tap-to-talk, worklet PCM, session ticket and WSS | Fix audit2 start/cancel and handshake settlement races first |
| `public/js/main.js` | Reviewed voice actions, owned playback; typed assistant | Fix audit2 ownership failures; update readiness rendering consistently |
| `server/online/app.js` | Cloud voice/speech/audio routes return LOCAL_VOICE_ONLY; typed grammar works | Preserve backend boundary, add clear local setup journey |
| `.gitignore`, `.vercelignore`, cloud trace verifier | Exclude native models/private data from publication/cloud | Extend exclusions and tests for new artifacts |

Fresh prior evidence on this host:172 isolated tests passed; CPU Vosk/Kokoro ran; English synthetic phrase matched; Hindi omitted a room number. No clean-machine installer or human accent acceptance exists. Installed developer runtimes, cached wheels, native DLLs and models must never be mistaken for first-run evidence.

## 3. Supported platforms and dependency policy

### Initial release target

- Windows11 x64, non-administrator user, supported Chrome/Edge, CPU-only. Test a Windows10 machine only if explicitly included in the published compatibility matrix; do not promise it from this plan.
- Aim to support8GiB RAM; measure total peak consumption including browser/hub/speech.16GiB is the current development baseline. Publish tested requirements, not model-file size as a RAM requirement.
- Windows ARM64/macOS/Linux/Pi are unsupported by the initial BAT release. Detect architecture before downloads and offer accurate instructions. Keep the underlying Node orchestration portable, with separate runtime manifests/launchers later.
- Raspberry Pi follow-up:64-bit OS and ARM64-native runtimes, wheels and Vosk support; no Windows DLL reuse. Pi5/8GiB is a proposed validation target, not a current supported platform.

### Runtime selection

Use app-managed, versioned runtimes so users do not need global Node, Python, pip, Git or FFmpeg after obtaining the source. Git is only needed for git-based retrieval/updates; ZIP extraction must also work.

1. Pin an exact Node22 release and official Windows-x64 ZIP digest in the installation manifest.22.23.4 is the locally tested candidate, not permission to invent its download hash. Verify official availability/checksums and the dependency ABI before promoting it.
2. Prefer a pinned relocatable CPython distribution from the official `astral-sh/python-build-standalone` release channel, installed per user, with documented redistribution notices. Choose the exact CPython/build tuple only after resolving all required wheels in a clean environment. Current project's Python3.14.3 is historical evidence; do not require the latest Python simply because it exists.
3. Build an isolated speech environment and a complete hash-locked wheel inventory. Use only binary wheels on end-user setup; if a required package needs compilation, produce/review the supported release artifact or fail with a clear unsupported-platform error. Do not quietly install compilers.
4. Resolve Vosk's Node native bindings and external DLL dependencies in an actual clean image. Prefer the known lockfile path if it works. If it cannot be reproduced without build tools, evaluate a Python Vosk adapter behind the same worker contract, then rerun all native tests. That fallback is a controlled implementation decision, not an automatic runtime switch.
5. FFmpeg is used by the existing synthetic test harness, not the browser PCM/runtime TTS path. Keep it a QA prerequisite or use a test-only WAV resampler; do not add it to every installation unnecessarily.

Use official immutable release assets, HTTPS and pinned SHA256 values. No runtime `latest` URLs, remote script piping, global npm/pip installs, broad PATH editing or machine execution-policy changes. Do not assume Python's minimal embeddable ZIP is an ordinary pip-managed installation; its supported usage differs from a regular Python environment.

Source references checked for this plan: [Python Windows distribution guidance](https://docs.python.org/3/using/windows.html), [Python standalone distributions](https://github.com/astral-sh/python-build-standalone), [npm ci behavior](https://docs.npmjs.com/cli/v11/commands/npm-ci/). These establish available mechanisms, not certification of a particular HomeAuto binary bundle.

## 4. Installation layout and persistence

Keep source code in the clone. Keep durable personal data outside Git and independently of `git pull`:

```text
<clone>/Run HomeAuto.bat
<clone>/scripts/local/bootstrap.ps1
<clone>/scripts/local/launcher.cjs
<clone>/scripts/local/lib/*.cjs
<clone>/server/node_modules/                  # ignored, clone-specific
<clone>/.local/installation.json              # ignored: schema + installation UUID only

%LOCALAPPDATA%/HomeAuto/
  runtimes/<platform>/<version>/             # immutable verified runtime installations
  assets/<profile-id>/<content-digest>/      # immutable verified model assets
  downloads/<digest>.partial                 # incomplete downloads, bounded staging
  locks/                                    # shared cache installation locks
  installs/<installation-uuid>/
    config.json                             # validated nonsecret local settings
    state.json                              # setup revision and stages, not hardware state
    data/home_auto.db                        # existing repository implementation
    tls/                                    # private certificate/key, only if LAN enabled
    private/                                # broker/gateway secrets; never exported by doctor
    speech-env/<dependency-digest>/
    logs/                                   # redacted and size/retention bounded
    run/                                    # owned process metadata, local control IPC
    backups/                                # bounded pre-upgrade recovery points
```

All paths are resolved with platform APIs, not string-built shell commands. Set restrictive user ACLs for private/data folders. Keep installation identity distinct from cloud household identity. Do not embed username, password, tokens or private paths into the public runtime descriptor.

Moving a clone with its ignored installation pointer can reattach to the same installation on the same machine after validation. A fresh clone starts a distinct installation by default; offer an explicit “Use existing local home” choice when suitable local installations exist. Do not silently open the same DB from two clones. Shared runtime/model caches require their own process-safe locks and cannot be edited while in use.

### Existing developer installation migration

Before creating a new empty home, detect legacy `server/db/home_auto.db`, `.local/speech-venv`, `.local/speech-assets`, `server/voice/models` and TLS paths without printing secrets. If an existing DB/hub is present, require a stopped writer before migration. Offer reuse-in-place first or an explicit verified import; do not silently move/delete/reset existing data. Copy DB only when stopped, validate integrity/schema, preserve source and rollback backup. Do not copy active sessions/reauth challenges as durable identity. External model assets may be reused only after verification; existing Python environments may remain a developer override but do not qualify the new installer.

Config precedence: explicit CLI selection → documented HOMEAUTO environment overrides → validated installation config → safe defaults. Resolve into a typed object; do not `eval`, dot-source or execute config. Parent shell cloud variables must not unexpectedly connect a local launcher to Neon or a real gateway. Construct child environments from an allowlist, including required OS variables; import only deliberately selected HomeAuto settings. Set disabled hardware/cloud flags explicitly when the profile is unconfigured. Real configured installs retain their approved settings on restart; do not reset them blindly.

## 5. Launcher and first-run journey

`Run HomeAuto.bat` should be tiny: disable delayed expansion, anchor to `%~dp0`, invoke the local PowerShell bootstrap with correctly quoted arguments, retain the exit code and keep failures visible. Handle spaces, apostrophes, Unicode, `&`, parentheses, `%` and `!` in paths. Reject unsupported UNC/network filesystem installation with a helpful copy-to-local instruction unless actually tested. Do not assemble user paths into executable command text.

The PowerShell bootstrap performs only pre-Node checks, installation lock acquisition, verified Node provisioning and Node handoff. Prefer normal local-script execution; a process-scoped execution-policy option may be documented for this local script, but never modify machine/user policy or bypass organization policy. If policy/SmartScreen blocks execution, provide accurate recovery instructions; do not silently disable protections. Run helpers hidden; the user-facing launcher console remains visible with progress and Stop instructions.

### First run

1. Identify OS/CPU, writable folders and available disk; establish installation ID and acquire setup lock.
2. Explain download size from the actual manifest: “Set up local voice. Download once; use offline afterwards.” Show platform/profile and privacy summary. Choices: **Set up voice** (recommended), **Import offline bundle**, **Continue without voice**. The launcher intent authorizes setup, but significant downloads must be visible and cancellable.
3. Provision verified Node, production server dependencies, Python environment, STT/TTS assets and phonemizer assets. Report stage/progress; a missing Content-Length displays bytes, not invented percentages.
4. Run dependency imports, hash verification, native worker warm-up and output validation. A downloaded file is not a ready model. Installation may succeed partially with precise STT/TTS states.
5. With runtime stopped, inspect the local DB once. If there are no users, prompt for username, display name if supported, hidden password and confirmation using the existing session password-hashing rules. No password in argv/env/logs. Preserve local12-character minimum; cloud signup's10-character policy is separate. If users exist, go straight to login. Cancellation must not create a partial owner or overwrite an existing one.
6. Start the actual runtime in loopback mode, with no broker/cloud enabled merely because setup succeeded. Existing model/hardware readiness remains independent.
7. Wait for a private launch-readiness proof and correct app identity, then open one browser tab at the actual URL. Show speech warming/loading/degraded status in the app if warm-up is still pending. Never wait indefinitely for voice to open an otherwise healthy app.
8. Keep the supervising launcher alive. Display URL, local voice states and how to stop. Setup interrupted at any point must be rerunnable.

The new owner setup helper must not instantiate a second live Repository merely to check users: opening the current repository performs migrations and clears sessions/challenges. Check/create before starting the server, under its writer ownership, then close it. For an already-running owned instance, reuse that instance instead.

### Later runs

Validate installation manifest/source compatibility, runtime/dependency fingerprints and assets without fetching anything. Use cached verified artifacts, start app, warm workers and open browser. No `npm ci`, `pip install`, model download or auto-update on every launch. A plain git pull changing lockfiles/profile requirements can mark setup stale; explain the required update and apply it explicitly before startup. Offline with missing new requirements must preserve the old complete installation and offer instructions rather than pretending it is current.

`--no-browser`, `--offline`, `--doctor`, `--repair`, `--import-bundle PATH`, `--without-voice` and `--stop` belong to the Node/PowerShell CLI; BAT remains the simple entrypoint. `--repair` repairs dependencies/assets only, never resets accounts/DB/TLS. A separate destructive reset is out of scope.

## 6. Explicit state machines and recovery contracts

### Installer

```text
uninitialized → checking → awaiting_setup_choice
checking → ready                         (compatible complete installation)
awaiting_setup_choice → downloading/importing → verifying → installing → probing → ready
any active setup stage → cancelled | failed
cancelled/failed → checking               (explicit retry; inspect evidence afresh)
probing → degraded                       (app usable; one/both speech services unavailable)
```

Persist stage receipts atomically with schema version, platform, manifest/dependency hashes and verified asset IDs. Receipts contain no credentials and never override a failed hash/probe. Keep last-known-good artifacts until the replacement is verified. Every setup operation has an owner token/generation; stale process completions cannot mark a newer operation ready. Staging directories are uniquely owned and cleanup checks resolved paths remain under the intended staging root. Never recursively delete a computed user-supplied path.

### Runtime

```text
stopped → starting → app_ready → voice_warming → ready | degraded
starting → failed
app_ready/voice_warming/ready/degraded → stopping → stopped
```

App readiness, speech readiness and hardware readiness are independent. A home with no hardware can have fully functional speech recognition/synthesis but must answer device actions with unavailable state. Do not seed real hardware reports for a welcome experience. Demo must remain explicitly simulated.

### Speech worker (per kind)

```text
missing | invalid → unavailable
verified → loading → ready → busy → ready
loading/busy/ready → failed → restarting → loading
repeated failure → unavailable
any active state → stopping → stopped
```

Retain `stt_ready` and `tts_ready` booleans for compatibility, derived from explicit state. Use worker generation and request IDs so a late reply/exit from the retired worker cannot fail or unlock a new worker's job. Bound start and inference timeouts; restart at most twice within a documented window, then require explicit Retry after cooldown. A retry restarts pure speech inference only when explicitly requested; it never repeats a device command. Complete/reject all pending promises exactly once on cancel, close, error, timeout and shutdown. Release busy ownership independently from whether a result is eligible to render.

Do not combine installation progress and runtime worker state in one boolean. Disabling TTS should leave STT available, and vice versa; a TTS failure must not restart the whole hub or drop MQTT.

### Process ownership and ports

- Prefer port3000; if occupied by the same owned installation, verify instance ID plus a private control handshake and open it. `/api/health` returning200 alone is insufficient.
- If occupied by another service, choose a documented bounded fallback range or ask for a port; bind atomically and handle EADDRINUSE races. Never kill an unrelated process or reuse its cookies.
- Process registry contains PID, executable identity/start time, instance ID, endpoint and dependency version. A PID alone is not proof of ownership. Launcher instance proof belongs in private IPC/state, not a public unauthenticated endpoint.
- Store launcher lock outside DB lock; retain the repository's single-writer protection. Never unlink its lock simply because a port is closed.
- Graceful stop uses the runtime's stop contract through private IPC: close voice/capture, abort workers, stop gateway/timers/broker and flush/release DB. Escalate only for verified owned children after a deadline. Test Ctrl+C, explicit Stop, launcher crash and console window close on Windows; document observed limitations instead of promising signal semantics Windows does not provide.
- Keep secrets out of process arguments and error dumps. Use worker filtered environments; no cloud DB or MQTT secrets in STT/TTS processes.

## 7. Verified dependency/model provisioning

Create a strict, versioned `server/voice/profiles.json` and installation runtime manifest. They are reviewed source-controlled metadata, not downloaded executable configuration. Fields must include:

```text
schema_version; profile_id; platform; cpu_arch; runtime_versions;
asset_id; role; language; source_https_url; permitted_redirect_hosts;
sha256; archive_bytes; extracted_bytes_bound; archive_type;
expected_files[{path, bytes, sha256}]; license_id; license_source;
dependency_lock_digest; probe_spec_version; compatible_app_schema
```

Set a global download size ceiling and extraction expansion/file-count limits. Validate redirect scheme/host and count; reject HTTPS downgrade. Download to an owned `.partial` path with timeout and cancellation; verify final bytes/hash before extraction. Range resume is permitted only with matching identity/ETag and Content-Range; otherwise restart the partial artifact. Check free disk for compressed + extracted + old version + staging; report the actual calculation.

Reject absolute paths, traversal, symlinks/reparse points, case-colliding entries and unexpected files. Extract via a vetted API or local PowerShell script with literal/structured arguments, not interpolated `execSync`. Verify every expected extracted artifact, then atomically publish its immutable directory. File locks/antivirus denial must produce a retryable message and preserve the good profile.

Use `npm ci` with the committed server lockfile; do not install root cloud dependencies unnecessarily for a local-only run. Inspect necessary native install scripts: use `--ignore-scripts` where valid, followed by explicitly reviewed required native setup, or document why a specific script must execute. Native smoke imports prove success. Never run broad `npm audit fix` or regenerate locks to make setup appear successful.

Python installation uses a complete wheelhouse with hashes, `--require-hashes`, bounded versions and offline installation from that cache after acquisition. Include eSpeak/phonemizer and DLL requirements. Download licensing/notice assets as pinned artifacts too. Model license coverage, phonemizer license/source obligations and runtime notices must be satisfied before redistributing a bundle; an inventory alone is insufficient.

### Baseline speech profiles

- `vosk-en-us-hi-baseline-v1`: existing verified EN-US/Hindi models, clearly labeled baseline. It is the reproducible initial default until another profile passes comparison; do not relabel it “Indian accent model”.
- `kokoro-en-hi-baseline-v1`: current ONNX + voices, CPU provider, English `af_heart`, Hindi `hf_alpha`. List actual supported voices; do not advertise voice switching when the worker ignores `voice_id`. Either validate the configured fixed voice explicitly or implement selection with compatible profiles and tests.
- Optional `vosk-en-in-hi-candidate-v1`: Indian-English challenger selectable only after provisioning, with its own hashes/probes; not an automatic accuracy upgrade.
- Whisper, IndicConformer, IndicF5 and general LLMs remain evaluation/future work. Do not make all experimental models a multi-gigabyte mandatory download.

Initial measured active assets are506,702,900 bytes, excluding runtimes/dependencies/caches. Display final download/storage from the resolved release manifest, not this historical count. The account/profile installation workflow should work for both English and Hindi, including Unicode Windows usernames and paths.

### Air-gapped installation

An ordinary Git clone does not contain models, runtimes or node_modules. Support an operator-prepared offline bundle containing exact approved runtime archives, dependency packages/wheels, models, notices and a manifest compatible with the source revision. Import must perform the same digest/extraction checks; never trust a hash supplied only by an arbitrary untrusted bundle. Expected hashes come from the trusted source release, or a release signature anchored to a shipped verification key.

No dependency resolver may contact the network during `--offline` import/launch. Bundle is platform-specific; reject mismatch. Exclude accounts, databases, gateway tokens, certificates, real audio/transcripts and private QA files. The source repository can remain private: a public website cannot promise anonymous GitHub clone/download access to `Mishrajishri/home-sec-auto`. Use an actually accessible distributable when available; otherwise explain required repository access. Never embed a GitHub access token in the website or launcher.

## 8. APIs and UI behavior

### Runtime capabilities

Extend `/api/runtime` additively, keeping existing `mode`, `transport` and cloud fields. Suggested new fields (final contract must be tested in both runtimes):

```json
{
  "mode": "local",
  "transport": "websocket",
  "capabilities": {
    "local_voice": true,
    "speech_input": true,
    "speech_output": true,
    "speech_execution": "local",
    "general_conversation": false
  },
  "local_setup_url": "/local-setup"
}
```

Capability means supported by the runtime, not that installed models are ready. Authenticated snapshot speech data supplies individual `state`, `ready`, `reason_code`, languages and allowed retry action. Preserve current booleans. Before remote relay delivery, cloud has false speech capabilities and `speech_execution: "unavailable"`. After delivery, describe execution as hub-owned, and derive remote readiness from the assigned live hub and worker states; never return a guessed localhost URL as a discovered hub. Missing old descriptor fields fall back conservatively without disabling the existing typed path. Runtime descriptor reveals no local paths, users, secrets or private IPC credentials.

Add an owner-authorized, CSRF-protected, rate-limited local worker retry endpoint only if needed (`POST /api/assistant/voice-retry`, fixed enum `stt|tts`). It may restart verified workers, not install arbitrary models, execute commands, accept paths/URLs or alter dependencies. Existing `/api/ai/models/:id/activate` currently checks readiness only; do not quietly turn it into an unrestricted downloader. Install/repair happens through the launcher with hub coordination.

### Website guidance

On cloud Assistant, show a clear inline callout:

> Use Shrimaan through your home hub
>
> Voice recognition and spoken replies run on your home hub, the computer connected to your ESP32. Keep HomeAuto running there. Remote voice is being added; for now use the hub interface for English and Hindi speech.
>
> Set up local HomeAuto

Provide a secondary “Already running locally?” explanation: on this same computer, open the URL shown by the launcher; on another computer, use the hub's shared local HTTPS address. Do not probe/scans localhost/private IPs, use cross-origin fetch to a LAN hub, install a custom URL handler or weaken CSP/CORS. Browser links cannot start a BAT file or prove an installed hub is running.

Keep existing cloud typed commands as **typed home commands**, explicitly distinguished from local speech AI; they already use the deterministic supported grammar. Do not advertise general AI chat. In cloud demo, keep simulated typed behavior labeled Demo. If the product later decides to disable typed commands online, treat that as a separate explicit change, not an accidental consequence of hiding the microphone.

Until the new relay is fully implemented, cloud mic/Test voice controls must lead to guidance or show a clear disabled explanation; never request microphone permission. Once implemented, request capture only on explicit tap after validating current hub/STT readiness, and relay all inference to that hub. No repeated modal on every navigation. Use the same guidance in Voice settings and missing-model entrypoints. On mobile cloud, explain that models belong on the hub, remote voice requires that hub online, and the current local-interface fallback requires the same local network; do not offer a Windows BAT as something the phone can run.

Implement `/local-setup` as a supported informational SPA route accessible before and after login. Integrate explicitly with routeInfo/navigation and bootstrap's unauthenticated public-route handling; do not create a broad authentication bypass. Only this exact informational route renders without a session; APIs keep their auth. Direct refresh, Back, My Home, unknown routes and logged-out fallback must work. It inherits all themes, system fonts, touch targets, focus and reduced motion. The guide explains Windows support, first-run internet/offline bundle, exact launcher filename, local sign-in, both-laptop setup and existing hardware commissioning boundaries. Use a verified release/repository link; until a distributable exists, show source instructions rather than a broken Download button.

### Local Assistant readiness

| State | User-facing message/action |
|---|---|
| Preparing | “Preparing local voice…”; keep typed controls usable |
| STT missing | “Voice recognition is not installed. Open Run HomeAuto.bat and choose Set up voice.” |
| TTS missing | “You can speak requests. Spoken replies are unavailable.” |
| STT unavailable, TTS ready | Allow typed supported queries and Test voice; microphone explains unavailable recognition |
| Both ready | Tap to speak; optional spoken replies, English/Hindi settings |
| Permission denied | Explain microphone permission and keep text input focused/usable |
| Worker crash | “Local voice stopped. Try restarting voice.”; bounded Retry when allowed |
| Hardware absent | Speech works, device request reports unavailable; no simulated confirmation |
| Cloud | Local setup callout; no recording |

Provide Hindi translations reviewed manually; do not blindly run English copy scanners on Hindi. Readiness updates must update text, controls and accessible labels together. Respect live-region verbosity, keyboard focus, microphone cancel, audio Stop and modal focus return. Preserve existing four-theme visual components; this is not another redesign.

## 9. Speech semantics and transition prerequisites

Resolve all four audit2 findings before claiming launch-ready voice:

- SM2-01: batch actions capture home/realm ownership and stop dispatching after home changes; failed hydration does not leave actionable old UI.
- SM2-02: device busy cleanup belongs to operation owner; session/CSRF rotation cannot leave permanent busy state or let old cleanup clear a new action.
- SM2-03: generation check after every capture await including AudioContext.resume; handshake close/error/cancel settles readiness exactly once; canceled start cannot return to Listening.
- SM2-04: assistant success/error/finally are scoped to the same conversation and realm; old errors cannot replace new replies.

Keep microphone explicitly initiated, bounded PCM, ticket/session/Origin checks, review before voice actuation, sensitive-action denial and result ownership. Suppress speaker feedback into capture by stopping playback before listening; test echo and background TV. Cancellation prevents new execution but cannot undo an already dispatched physical command. Communicate that distinction in outcomes.

Default model quality remains limited. Preserve transcript text and resolved targets, reject unclear rooms/numbers/negation, and ask clarification rather than widening a request to all lights. Hindi TTS working does not mean Hindi recognition passed. No correction dictionary may be tuned to the nine historical synthetic clips and presented as accent coverage. Use the human holdout plan in OFFLINE_AI.md for promotion.

No local LLM is required for the first packaged release. General conversational AI can be added later behind a separate provider and strict structured-intent admission; it is not delivered by merely installing STT/TTS. Website wording and README must reflect this.

## 10. Diagnostics, update and error behavior

Provide a redacted doctor report with OS/architecture, installation schema, app revision, dependency/profile IDs/digests, readiness states, failed stage/code and localhost connectivity. Do not include passwords, session cookies, full environment dumps, home names/device names unless explicitly chosen, RFID UIDs, audio/transcripts, gateway tokens or private certificate bytes. Path display may be local-only; exported report redacts username/home directory. Logs rotate (proposed5 files ×2MiB); setup state holds the last failure code, not raw exception payloads containing secrets.

Suggested launcher exit codes:

| Code | Meaning |
|---|---|
|0|Normal stop or successfully attached to an owned running instance|
|2|Unsupported platform/architecture|
|3|Configuration/path/permission error|
|4|Required artifact unavailable offline/download failed|
|5|Integrity/extraction failure|
|6|Dependency/native import failure|
|7|Local account setup canceled/failed|
|8|Runtime start/port/ownership failure|
|9|Explicit strict speech probe failed|
|10|User canceled setup|

Degraded normal startup is not a fatal exit: show app-ready/voice-unavailable accurately. `--strict-voice` for CI/doctor can fail nonzero. Distinguish cancellation, unsupported platform and corrupt data from retryable network errors. Never print “all ready” after catch-and-continue.

Update dependencies in a staged version; stop owned runtime before replacing modules. Keep old installed artifacts until new probes pass. DB schema changes require backed-up forward migrations and explicit compatible-version checks; never roll an older app onto a newly migrated DB silently. Data restore is operator-driven, not an automatic dependency rollback side effect. No self-updating code from the public website. Failed update leaves a documented route to the last compatible release and preserved data.

## 11. File-level work packages

Names below are proposed additions; adapt only where an existing equivalent genuinely fits. Keep one implementation per responsibility.

| Work package | Paths | Completion evidence |
|---|---|---|
| W0: baseline | Existing audit2, OFFLINE_AI, IoT report, current git diff | Record versions, pending files and screenshots; preserve UI and legacy data |
| W1: transition fixes | `public/js/{main,api,voice-controller}.js`, coordinator/browser tests | All four counterexamples become failing-before/passing-after regression tests |
| W2: manifests/config | New `scripts/local/runtime-manifest.json`, `server/voice/profiles.json`, `server/local/config.js`; lifecycle config integration | Strict schema, real digests/provenance; no cloud secret inheritance; existing direct npm start still works |
| W3: bootstrap | Root BAT, `scripts/local/bootstrap.ps1`, `launcher.cjs`, small `lib/{paths,ownership,download,install,diagnostics}.cjs` modules | Clean non-admin Windows with no Node/Python can reach verified setup |
| W4: assets/dependencies | Existing assets/download-models/requirements lock, new platform hash locks | Corrupt/partial/hostile archive tests; clean native imports; offline bundle import |
| W5: account/data/start | Operator shared helper, launcher/lifecycle, private process IPC | Existing owner preserved; first owner created once; duplicate launch; stop/restart; DB lock tests |
| W6: speech lifecycle | SpeechService and workers, explicit readiness/retry contracts | Crash/timeout/stale-message/cancel tests; native CPU probes; STT/TTS independent degradation |
| W7: local/cloud UX | Runtime endpoints, API client, views/main/i18n/navigation, existing semantic CSS only as necessary | Local guide, no cloud mic prompts, all themes/mobile/history/focus |
| W8: verification | New installer tests/native harness, existing suites, Windows CI job | Full matrix below, clean-machine artifacts and external-network denial proof |
| W9: docs/release | README, OPERATIONS, OFFLINE_AI, developer checkpoint, ignore/build/publication checks | Supported platform/download facts, truthful test report, no private/native assets in Vercel trace |

Dependencies: W0→W1 and W2; W2→W3/W4; W3/W4→W5/W6; capability contract→W7; W1/W5/W6/W7→W8→W9. Commit in reviewable slices without declaring the feature complete until W8 gates pass. Physical firmware can proceed as a separate workstream later, but software packaging must explicitly report uncommissioned hardware.

## 12. Required verification matrix

All automated device actions use mocks/disposable brokers, never live household hardware. Preserve failures and exact versions in reports.

### Installer and clean Windows

- Fresh supported VM/user: no global Node/Python/Git/FFmpeg, empty caches, non-admin, internet enabled. Double-click BAT from a path containing spaces and Hindi characters; setup→owner→login→English/Hindi worker probes→graceful stop.
- Repeat in path edge cases (apostrophe, ampersand, parentheses, percent/exclamation), different current directory and read-only source location. Either work safely or fail specifically before mutation.
- First launch offline with empty cache: truthful missing-artifact message, no partially usable “ready” install. Then import a complete signed/pinned bundle while all external traffic is denied.
- Interrupt each setup stage, rerun, verify no corrupt-ready state or duplicate owner. Disk full, permission denial, antivirus file lock, timeout, redirect loop/downgrade, altered checksum, traversal/zip bomb, stale partial range, invalid TLS, wrong platform bundle.
- Double-click twice, two clones, occupied port by unrelated HTTP200 service, PID reuse/stale lock, crash between receipt and rename, concurrent shared-cache install. No unrelated process termination or second DB writer.
- Git pull with unchanged dependencies requires no network/install. Changed locks trigger setup-required. Failed update preserves data and old verified artifacts. Legacy DB/model import preserves accounts/settings/cards and never opens another writer.

### Runtime/native speech

- Use the actual installed environment and pinned real Vosk/Kokoro assets; record no GPU provider. English/Hindi synthesis must produce bounded valid nonempty finite WAV; STT returns well-formed transcript. Semantic expectations and known Hindi misses are reported separately from model-load success.
- Test missing/tampered model, missing DLL/phonemizer, worker crash/timeout, pipe failure, invalid PCM, denied/revoked mic, pre-ready socket close, AudioContext cancel race, late result after logout/home switch, TTS cancellation and expired audio ownership.
- Keep app usable with STT-only, TTS-only and neither; Retry is bounded and never publishes commands. Two clients compete fairly and receive specific busy feedback. No raw audio persists in normal operation.
- Offline cold boot under externally enforced network denial: local page, assets, auth, STT, TTS and queries function. Prove no attempted CDN/model/telemetry/cloud-STT calls; merely setting offline environment flags is insufficient. Local loopback and LAN communication stay allowed.
- Resource measurement: cold/warm load, p50/p95 speech latency, peak total RAM/CPU, simultaneous UI/backend responsiveness and shutdown cleanup. Avoid performance assertions from one synthetic phrase.

### Browser/local/cloud

- Cloud Assistant and Voice settings explain local-only speech, setup link works logged out/in, no getUserMedia request or local-network probing; existing typed cloud controls retain their supported semantics.
- Local setup page direct URL/refresh/Back/Forward/My Home and auth boundary; screen-reader/keyboard focus; no effect on unrelated protected APIs.
- Local model states update mic, text and labels together; review/cancel never publishes, confirmed requests use fake controller reports. All four audit2 regression scenarios.
- Four themes × mobile/tablet/desktop (minimum320/390/768/1440 widths), large text/controls, reduced motion, no horizontal overflow, readable Hindi and focus return. Preserve current UI reference captures.
- Two physical laptops on same LAN: laptop B opens laptop A's trusted HTTPS address, authenticates locally, captures microphone and receives local speech with WAN disconnected. Verify trust/allowed-host configuration, avoid HTTPS-warning workarounds. This is a manual environment gate distinct from headless browser mocks.

### Repository/cloud containment

- Run complete existing npm tests (baseline172, new tests increase count), syntax/build/publication and applicable UX/mobile/onboarding suites after changes. No existing successful assertion weakened to accommodate failures.
- CI Windows installer smoke with controlled local test assets plus a separately identifiable real native-model job. Cache keys include OS/CPU/Node/Python/lock/profile hashes; at least one evidence run bypasses all caches.
- Ensure Vercel trace contains no Vosk binding, Python environment, model, launcher dependency or installer secret. Extend `.vercelignore` for local tooling; keep serverless imports of shared parser pure.
- Secret scan staged content and complete publication history. Offline bundle contents independently audited; test audio must be synthetic or explicitly consented and must not enter the public source release.

## 13. Acceptance and truthful completion report

Do not mark complete because a BAT starts the developer's already-configured server. Required proof is a supported clean machine reaching native speech through that BAT, then restarting with internet blocked, preserving the local account/settings, and passing failure/recovery tests. At least one end-to-end browser→actual STT→review→mock device service→actual TTS flow must pass from the installed artifacts.

Report separately: source implementation, clean install, offline operation, native model readiness, accent/semantic quality, cross-laptop access, physical IoT acceptance, Pi support, GitHub publication and Vercel deployment. “Native workers ran” cannot stand for accent acceptance or physical control. Raspberry Pi and general conversation remain future unless independently implemented/tested.

## 14. Revised remote voice requirement and subsequent delivery

The user has replaced the long-term local-interface-only voice restriction. Read [HUB_AI_EXECUTION_PLAN.md](cloud/HUB_AI_EXECUTION_PLAN.md), which is authoritative for inference ownership, remote conversation, live-hub gating, relay boundaries and acceptance. W0–W9 package the hub and establish local reliability; W10 implements the scoped remote conversation relay, hub-side interpretation, review and returned TTS audio. Every new remote control/voice request requires the hub to be running and currently connected; no action waits for a sleeping hub to wake. Local operation remains possible without WAN. A remote client needs no model installation. Do not mark the overall revised feature complete after W9 alone. The relay transport must be selected/validated before code; the existing telemetry API is not an audio channel.

## 15. SOL 6.1 starting instruction

Read this plan, current DEVELOPMENT_STATE.md, OFFLINE_AI.md and STATE_MACHINE_AUDIT_2.md before editing. Inspect the actual working tree and preserve all existing changes. Implement W0–W9 for Windows-x64 hub CPU speech, then W10 according to the revised remote conversation contract, starting with the audit2 regressions and runtime/native dependency proof. Keep the current UI, backend admission rules and firmware topics intact. Do not start a second design rebuild or replace authentication. Use simulated devices and isolated data for automation. Do not install every research model, claim general conversation, publish unverified download links, or rely on private developer paths. Continue until clean installation and offline relaunch are verified, or report the exact external blocker and retained evidence. Deployment/physical commissioning remain separate operations.
