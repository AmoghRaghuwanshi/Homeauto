# HomeAuto — local operator guide

Active implementation revision 4, 2026-11-05. No cloud account is needed. Run
commands from `D:\homeauto-main\server` unless stated otherwise. Stop the hub
before identity, database or restore operations. The single-writer lock prevents
an operator process and hub from writing the same database concurrently.

## Identity and runtime

`npm run setup -- add-user YOUR_NAME owner` prompts for a hidden password. Use
`resident` or `viewer` for other roles. Owners may manage cards; residents control
lights and request locks; viewers read. Door unlocking additionally requires the
account's `can_unlock` grant, password reauthentication and a single-use challenge.
The initial owner has that grant; residents do not. There is no self-registration
or default password. `npm run setup -- reset-password YOUR_NAME` resets locally
and invalidates all sessions. Hub restart always invalidates sessions/challenges.
Passwords are hashed with scrypt; do not pass them in process arguments.

`npm start` binds only `127.0.0.1:3000`. MQTT and door control default off. Read
`deploy/homeauto.env.example`; set actual environment variables in the process
or service manager. The server does not read an `.env` file. A private local
password file or service secret store belongs outside the checkout. Restrict
filesystem access using Windows account ACLs or an encrypted volume; the SQL
database and RFID audit are not encrypted by sql.js.

## HTTPS and LAN clients

The original `server/certs/server.key` is considered exposed. The active runtime
never reads it. Preserve it only as a private historical file until the operator
has removed it from any repository history/deployment and revoked its trust.

`npm run tls:setup -- localhost 127.0.0.1 YOUR_HUB_DNS_NAME YOUR_PRIVATE_LAN_IP`
creates a new RSA-3072 leaf key/certificate under ignored `.local/tls`, valid for
90 days, with only the explicitly supplied SANs. Existing files are never
overwritten. To rotate, stop the hub and move both files into a private backup,
then generate replacements. Test certificates are created only in OS temporary
directories; no trust store was changed during development.

For household use, prefer a certificate issued by a household CA, placing the
leaf/key in `.local/tls` or configuring `HOMEAUTO_CERT_PATH`/`HOMEAUTO_KEY_PATH`.
Establish trust on each phone/browser, verify the fingerprint locally and renew
before expiry. A browser warning bypass does not establish trusted microphone
operation. Do not disable TLS validation or use the bundled old key. Restrict the
Windows firewall to the private home subnet; do not forward ports from a router.

Only then set `HOMEAUTO_HOST` to the hub's specific LAN interface and
`HOMEAUTO_ALLOWED_HOSTS` to the explicit DNS/IP list (without ports). LAN binding
without TLS fails at startup. Requests also validate Host, Origin, JSON Content
Type, session and CSRF. The loopback HTTP development cookie is intentionally
different from the Secure `__Host-homeauto` production cookie.

## MQTT and firmware gate

`deploy/mosquitto.conf.example` and `deploy/homeauto.acl` define an authenticated
TLS listener and three separate principals. Provision unique secrets using the
broker's password tool; do not reuse the hub password on either board. Adapt
private certificate/password paths and LAN interface. The default example listens
only on loopback. It is a template; Mosquitto was not installed or started here,
and its ACL enforcement has not been verified against a running broker.

Set `HOMEAUTO_MQTT_ENABLED=1`, broker URL, username, password and optional CA path
only when that deployment is ready. Remote URLs require `mqtts:`. Loopback-only
test brokers may use `mqtt:` with credentials. Commands use QoS 0, retain false,
clean sessions and no offline queue. A local publish callback is not an actuator
acknowledgment. Fresh, nonretained reports provide temporal correlation only.

The preserved legacy firmware still uses anonymous TCP and blocking reconnects.
It needs CA-validated TLS, per-board credentials outside source, and a compiled
and supervised relock-priority change before household use. Do not simply enable
anonymous access to make it connect. Remove any retained command messages before
attaching a fixture. Do not connect a real lock for unattended tests.

Keep `HOMEAUTO_DOOR_ENABLED=0` until supervised power, Wi-Fi, broker outage,
relock timing, relay polarity, physical fail mode and egress results pass. Its
current five-second relock can be delayed by network code. There is no bolt or
contact sensor. RFID UID cards are cloneable. The software cannot verify a
physical locked door. No code was flashed or real actuator operated in this work.

## Local speech installation

On this machine, `.local/speech-venv` uses Python 3.14.3 and the pinned packages in
`server/voice/requirements-lock.txt`. Recreate with a compatible local Python:

```powershell
Set-Location D:\homeauto-main
python -m venv .local/speech-venv
& .local/speech-venv/Scripts/python.exe -m pip install -r server/voice/requirements-lock.txt
```

Provision the files named in `server/voice/asset-manifest.json`: existing Vosk
English/Hindi models under `server/voice/models/en` and `hi`, Kokoro weights and
voices under `.local/speech-assets`. The two Kokoro files came from the official
kokoro-onnx `model-files-v1.1` release. Exact SHA256s and bytes are in that manifest.
The Vosk hashes inventory the existing local baseline; they are not publisher
signatures. Custom files must match the pinned profile. Startup streams SHA256
checks before native model loading. A mismatch leaves voice unavailable; typed
and manual controls remain usable. No endpoint downloads or uploads executable
models, accepts arbitrary filesystem paths, or speaks arbitrary client text.

The active CPU profile is Vosk + Kokoro ONNX. The native worker processes receive
only filtered environment variables, not MQTT credentials. Kokoro uses `af_heart`
for English and `hf_alpha` for Hindi. Model storage is about 483 MiB for the active
profile; benchmark-only Whisper Base/Small add about 238 MiB. Model bytes are not
RAM. No cloud/Web Speech fallback exists. Vosk Hindi numbers were unreliable in
the synthetic corpus; voice control always requires review. Wake-phrase checking
is optional within a tapped utterance; there is no always-listening microphone.
Human Hindi/English/Hinglish and Indian-accent quality gates remain open.

`npm run test:speech` generates explicitly synthetic fixture WAVs under ignored
`.local/qa/speech`. `npm run benchmark:speech` additionally needs the local
Whisper CLI; `-- --small` selects the benchmark-only Small file. Whisper temporary
synthetic WAVs are deleted after each process. Runtime capture stays in RAM, is
bounded to 20 seconds and is not written to disk. Cancel disconnects and drops
results; inference already started may finish within its 30-second bound.

## Backup, retention and recovery

Every durable mutation exports to a same-directory temporary file, fsyncs it,
backs up the old file and renames the new one. A storage failure restores the
in-memory database and blocks further writes. Windows interruption/disk faults
are partly simulated in tests; real power-loss guarantees have not been proven.

A daily maintenance transaction follows a successful local backup. Seven dated
snapshots plus SHA256 sidecars rotate in `server/db/backups`. Activity/audit newer
than the original migration baseline is kept 90 days; the original 44 rows remain
preserved. Terminal commands/idempotency records expire after 24 hours. Resolved
alerts expire after 90 days; active alerts remain. Expired sessions/challenges are
removed. The permanent `.pre-v5.bak` and `.before-restore-*` safety copies are not
automatically rotated. Restrict and periodically move backups to a private second
disk; a same-disk backup does not protect against disk loss.

With the hub stopped:

```powershell
npm run recovery -- backup
npm run recovery -- inspect "FULL_PATH_TO_BACKUP.db"
npm run recovery -- restore "FULL_PATH_TO_BACKUP.db"
```

Restore validates SQLite integrity, fixed hardware IDs and any checksum sidecar,
saves the replaced file, invalidates restored sessions/challenges, marks pending
commands uncertain and records a restore audit entry. It never replays actions.
Do not remove a live `.lock` file; first identify and stop the writer. A stale
PID lock is recovered by normal startup only when that PID is gone.

## Release checks still requiring an operator

Actual broker ACL/credential tests; ESP32 TLS/reconnect firmware build; supervised
relay/RFID/sensor/door fixtures and outage/egress tests; trusted HTTPS on household
phones; real microphone permission/denial/browser behavior; NVDA and keyboard/
200% zoom/forced-colors review; native Hindi translation/voice auditions; consented
human accent/holdout corpus; older/nontechnical household trials; Windows service
account and startup/recovery configuration; redistribution license/source bundle.
No port was exposed, trust installed, service registered, commit pushed or board
flashed by the implementation work.


### 2026-11-05 — preview login deferred at user request

The loopback-only in-memory preview on port3001 opens directly without credentials. Account/sign-out controls and reauthentication prompts are hidden in this mode. Its guest session adapter is confined to server/scripts/preview.js; production runtime authentication remains intact. No persistent database change was made. Authenticated browser fixtures explicitly use loginRequired:true. Targeted fresh-browser checks pass for direct Home, hidden login/logout, unlock confirmation without password, typed simulated controls and retained CSRF checks; zero page errors. Evidence: .local/qa/no-login-results.json and no-login-preview.png.
