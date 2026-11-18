# HomeAuto: setup on another Windows laptop

Updated: 2026-11-18. Source: [Mishrajishri/home-sec-auto](https://github.com/Mishrajishri/home-sec-auto), branch `main`.

This is the installation guide for the current source, including the hardware-first launcher and Modules page. Follow sections 1–8 for the application, then the relevant hardware and optional model sections. Commands use Windows PowerShell, with `npm.cmd` to avoid PowerShell's npm script execution-policy issue. Run normal project commands without administrator privileges. Follow each step in order and stop if it fails.

## 1. Know what this release includes

| Component | What you get after cloning |
|---|---|
| Frontend and backend | Local Node/Express server, static UI, local database, authenticated WebSocket, four themes, English/Hindi UI |
| Launching | `Start-HomeAuto.bat` starts the hardware hub at `http://127.0.0.1:3001/modules` |
| First local account | One-time owner setup in the local browser; separate from an account on the public website |
| Hardware | Modules page for MQTT settings/reconnect, board/sensor status and optional camera LAN reachability |
| Assistant | Bounded English/Hindi home commands and conversation; browser Web Speech input/output |
| Real-device requirement | Controls and assistant wait for a fresh supported ESP32 report; broker connectivity alone is insufficient |
| Local speech models | Not connected to the app. Section 12 provides a separate, optional Piper output trial |
| Face recognition | Not connected to the app or lock. Section 13 provides separate model preparation and a two-photo comparison trial |
| GPU | Not required or used by the current browser speech implementation; section 11 checks the new laptop's GPU |

There is no general-purpose LLM, Live API, automatic face unlock, integrated Piper worker, or guaranteed sub-100 ms voice response in this release. Installing optional models does not change the app's active speech provider. The current assistant only answers supported home questions and commands.

The UI opens for owner/module setup without an ESP32. Home controls and assistant remain unavailable until an actual controller is connected. Missing optional camera/sensors do not disable otherwise valid ESP32 controls. Development fixtures remain in automated tests; the normal launcher does not run a simulated home.

## 2. Prepare the new laptop

Use a Windows 11 x64 laptop with a working microphone/speaker. Plan for at least 8 GB RAM; 16 GB is preferable when using browsers, development tools and optional model trials together. Allow several GB of disk space; browser test engines need additional space. Your RTX 3050 4 GB is optional for the base application.

Internet is needed initially to download source, Node packages, installers and optional model files. Local manual controls do not require cloud services once the hub, LAN, broker and devices are configured. Browser speech recognition may still need internet. WebSocket transport does not make speech recognition itself offline.

Install:

1. **Git for Windows x64:** [official installer](https://git-scm.com/install/windows). Keep Git on PATH. Its default HTTPS credential manager can handle GitHub sign-in if access is requested.
2. **Node.js 22.x x64:** select the Windows x64 installer from the [official Node 22 archive](https://nodejs.org/en/download/archive/v22). Include npm and add Node to PATH. This project requires major version 22; the latest general Node installer may install another major version.
3. **Chrome or Edge:** use a current version for browser speech. Use the same browser profile consistently for preferences.
4. **Optional later:** NVIDIA driver, Python, Mosquitto and Arduino IDE, as described below. They are not all prerequisites for opening the UI.

Close and reopen PowerShell after installing tools. Check:

```powershell
$ErrorActionPreference = 'Stop'
git --version
node --version
npm.cmd --version
```

`node --version` must start with `v22.`. If multiple versions exist, inspect `Get-Command node.exe -All`. Fix PATH rather than installing dependencies under an unintended version. No Visual Studio build tools or Python are required by the base hub's current dependency set.

## 3. Download the correct repository

The following creates a new checkout under your Windows user folder. If that destination already contains work, choose a different folder; do not overwrite it.

```powershell
New-Item -ItemType Directory -Path "$env:USERPROFILE\Projects" -Force | Out-Null
Set-Location "$env:USERPROFILE\Projects"
git clone --branch main https://github.com/Mishrajishri/home-sec-auto.git HomeAuto
if ($LASTEXITCODE -ne 0) { throw 'Git clone failed. Resolve access or network problems first.' }
Set-Location .\HomeAuto
git remote -v
git log -1 --oneline
```

The fresh clone's `origin` should be `Mishrajishri/home-sec-auto`, even though the development laptop also has a different origin remote. Use this repository for this handoff. Reading a public repository needs no account; if GitHub requests access, use an account permitted to access it. Never paste access tokens into source or clone URLs.

If you downloaded a ZIP instead, extract it completely before launching. Git is preferable because updates use `git pull` and the publication check uses Git's tracked-file list. Do not launch inside the ZIP viewer.

## 4. Install the application dependencies

Run from the repository root, the folder containing `Start-HomeAuto.bat`:

```powershell
npm.cmd ci --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'Root dependency installation failed.' }
npm.cmd ci --ignore-scripts --prefix server
if ($LASTEXITCODE -ne 0) { throw 'Server dependency installation failed.' }
```

Both lockfiles are committed. Do not copy `node_modules` from the old laptop, use `npm audit fix --force`, or replace the lockfiles to bypass an installation error. No cloud database, Neon account, ElevenLabs account, Docker, CUDA toolkit or Python model download is needed for these two commands.

During the transfer check, npm's root install reported three high-severity entries from the same development-tool `picomatch` advisory through `@vercel/nft`. The [upstream advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) was marked withdrawn on 2026-11-18, while the npm feed still reported it. `npm.cmd audit --omit=dev` reported zero production dependency vulnerabilities, and the server install reported zero vulnerabilities. Keep reviewing current audit results; do not force the suggested major downgrade or suppress all future advisories because of this dated observation.

Run the packaging checks:

```powershell
npm.cmd run test:publication
if ($LASTEXITCODE -ne 0) { throw 'Publication check failed.' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build verification failed.' }
node scripts/check-syntax.js
if ($LASTEXITCODE -ne 0) { throw 'Source syntax check failed.' }
```

The build command verifies cloud packaging boundaries; it does not start the local hub or download models. The local static UI needs no frontend compilation.

## 5. First launch and local owner account

For a fresh loopback installation, leave `HOMEAUTO_HOST`, TLS paths, gateway/cloud variables and custom database paths unset. Do not copy a populated production `.env` to the new laptop. This server does **not** automatically load `.env` files.

Double-click `Start-HomeAuto.bat` in the repository, or run:

```powershell
.\Start-HomeAuto.bat
```

The launcher starts a hidden Node server and opens:

**http://127.0.0.1:3001/modules**

Closing the launcher's console does not stop the server. A second launch reuses a responding local hardware runtime on port 3001. The launcher does not install packages, start Mosquitto, flash the ESP32 or download models.

On an empty local database:

1. The browser shows **Set up local owner**.
2. Enter your display name, a username and a unique password of at least 10 characters.
3. Submit once; the server creates the local owner and signs you in.
4. Save the credentials privately. They are not your public-site account unless you deliberately chose the same details; there is no account synchronization.
5. Modules remains usable while hardware is disconnected. Other home/assistant views can show **Connect your ESP32** until commissioning is complete.

There is no default username/password. The setup form closes after the first local account is created and is restricted to loopback. Use the local hub laptop for this step, not another laptop or the public website.

Verify in another PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/runtime | Format-List
```

Expected values include `mode: local`, `simulation: False`, `transport: websocket`, `device_transport: mqtt`. This proves the server profile, not device connectivity. Log files are `.local\launcher\homeauto.log` and `.local\launcher\homeauto-error.log`.

If Node 22 is installed outside PATH, set its actual absolute path before launching:

```powershell
$env:HOMEAUTO_NODE = 'C:\Program Files\nodejs\node.exe'
.\Start-HomeAuto.bat
```

Do not copy the old laptop's machine-specific desktop wrapper or `D:\homeauto-audit-tools` paths. The committed BAT locates the project relative to itself.

## 6. Make a desktop shortcut on the new laptop

From the cloned repository root:

```powershell
$projectRoot = (Get-Location).Path
$desktopPath = [Environment]::GetFolderPath('Desktop')
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktopPath 'Start HomeAuto.lnk'))
$shortcut.TargetPath = Join-Path $projectRoot 'Start-HomeAuto.bat'
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = 'Start the local HomeAuto hardware hub'
$shortcut.Save()
```

After first-time dependency installation, this shortcut provides the one-click launch. If you later move the checkout, recreate the shortcut from the new folder.

## 7. Understand what moves through GitHub

GitHub carries program source, UI assets, firmware source, lockfiles, tests, configuration examples and documentation. It deliberately excludes:

- Local accounts, household database, RFID records, logs and database backups.
- MQTT passwords, enrollment tokens, private certificates/keys and module credentials.
- Browser preferences, voice inventory and microphone permissions.
- Python environments, Node dependencies, model weights and generated audio.
- Unrelated presentation/PPT artifacts from the development laptop.

Use a **fresh local owner** for a clean installation. To preserve actual household data, follow section 15 using a private transfer. A Git clone alone is not a household backup.

The Modules settings file `.local\modules.enc.json` is encrypted with Windows current-user DPAPI. It cannot be assumed decryptable under another laptop/user. Re-enter broker credentials and camera details on the new laptop. Do not copy this file as a migration method. Browser theme, language and assistant preferences are per browser/origin and must be selected again.

## 8. Configure the broker in Modules

ESP32 communicates over Wi-Fi/MQTT, not the USB cable. USB is for programming, power and serial diagnostics. Put the hub laptop and ESP32 on a reachable local Wi-Fi/LAN; the ESP32 uses a supported 2.4 GHz network. Guest Wi-Fi/client isolation can prevent communication.

If an authenticated TLS MQTT broker already exists, obtain its URL, CA certificate and a dedicated hub username/password. Otherwise provision one using section 9. Installing HomeAuto alone does not install a broker.

For a private CA, set its actual path in the terminal that will start HomeAuto:

```powershell
$env:HOMEAUTO_MQTT_CA = "$env:USERPROFILE\HomeAutoPrivate\broker\ca.crt"
```

Stop and restart an already running hub before changing its environment. The saved Modules URL/username/password take precedence over those three broker environment values; the CA path is still environment-configured. For desktop launches, save `HOMEAUTO_MQTT_CA` in Windows **Edit environment variables for your account**, then sign out/in so Explorer-launched shortcuts inherit it. Never place the broker's CA private key in this variable.

Open Modules as the owner:

1. Set broker URL, for example `mqtts://localhost:8883` when it runs on this laptop. Its certificate must cover the chosen hostname/IP.
2. Enter the dedicated `homeauto-hub` broker username and its password.
3. Select **Save and connect**, completing password reauthentication if requested.
4. Inspect MQTT and the individual controller statuses. **Reconnect ESP32** reconnects the hub's broker client; it does not remotely provision or reboot the board.
5. After firmware commissioning, wait for fresh device reports. Do not inject fake heartbeats to make controls appear available.

Remote broker URLs require `mqtts://`. Plain `mqtt://` is accepted only for an authenticated loopback test broker; it is not a route around ESP32 TLS commissioning. Do not enable anonymous connections or disable certificate validation.

Changing the broker destination/username needs its password again. Leaving the password empty only retains the saved password for the unchanged endpoint and username. Saving may reauthenticate and briefly disconnect controls. The password is encrypted at rest and is not returned by the Modules status API.

## 9. Optional: provision a broker on this laptop

Skip this section if an operator already supplies a compatible broker. These steps create private operator files; none should enter Git. Use the intended hub laptop and a clean folder. Do not overwrite an existing broker installation or password file.

### 9.1 Install Mosquitto and prepare private files

Install the Windows x64 package from [Eclipse Mosquitto](https://mosquitto.org/download/). Read its `README-windows.md`. The commands below assume the standard `C:\Program Files\mosquitto` folder. Avoid starting a second service/listener if one already runs.

```powershell
$brokerDir = Join-Path $env:USERPROFILE 'HomeAutoPrivate\broker'
if (Test-Path -LiteralPath $brokerDir) { throw 'Broker folder already exists. Review its configuration rather than overwriting it.' }
New-Item -ItemType Directory -Path $brokerDir -Force | Out-Null
Copy-Item -LiteralPath .\deploy\homeauto.acl -Destination (Join-Path $brokerDir 'homeauto.acl')
Copy-Item -LiteralPath .\deploy\mosquitto.conf.example -Destination (Join-Path $brokerDir 'mosquitto.conf')
```

Restrict this folder's Windows Security permissions to the operator and any explicitly selected broker service account. Running Mosquitto in your own foreground terminal is simplest during commissioning. A Windows service needs read access to its config, password file, certificate and key; do not grant broad access to fix a permission error.

Create three distinct broker passwords at the interactive prompts:

```powershell
& 'C:\Program Files\mosquitto\mosquitto_passwd.exe' -c (Join-Path $brokerDir 'mqtt-passwords') homeauto-hub
if ($LASTEXITCODE -ne 0) { throw 'Creating hub broker account failed.' }
& 'C:\Program Files\mosquitto\mosquitto_passwd.exe' (Join-Path $brokerDir 'mqtt-passwords') esp32-lights
if ($LASTEXITCODE -ne 0) { throw 'Creating light-controller broker account failed.' }
& 'C:\Program Files\mosquitto\mosquitto_passwd.exe' (Join-Path $brokerDir 'mqtt-passwords') esp32-door
if ($LASTEXITCODE -ne 0) { throw 'Creating door-controller broker account failed.' }
```

Use `-c` only for the first creation: it replaces the password file. Never put real passwords after `-P`/`-b` in example commands or commit them in firmware.

### 9.2 Provision TLS

An operator may supply existing CA-signed broker certificates instead. For a new private installation, Git for Windows often includes OpenSSL at the path below. Verify it first; if absent, obtain an approved OpenSSL installation or have the broker operator supply certificates. The hub's `npm run tls:setup` creates a **web-server certificate**, not a broker CA.

```powershell
$openssl = 'C:\Program Files\Git\usr\bin\openssl.exe'
if (-not (Test-Path -LiteralPath $openssl)) { throw 'OpenSSL not found. Provision broker TLS before continuing.' }
& $openssl version
ipconfig
$hubLanIp = Read-Host 'Enter this laptop Wi-Fi IPv4 address from ipconfig (for example 192.168.1.50)'
$parsedHubIp = $null
if (-not [System.Net.IPAddress]::TryParse($hubLanIp, [ref]$parsedHubIp) -or $parsedHubIp.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) { throw 'An IPv4 address is required.' }
```

Reserve this private IP in your router if possible. Use an isolated bench LAN, not a public network. Run these commands only in the fresh private broker folder created above:

```powershell
Set-Location $brokerDir
if ((Test-Path .\ca.key) -or (Test-Path .\broker.key)) { throw 'TLS files already exist. Do not overwrite private keys.' }
& $openssl req -x509 -newkey rsa:3072 -sha256 -days 3650 -nodes -keyout ca.key -out ca.crt -subj '/CN=HomeAuto private broker CA' -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign'
if ($LASTEXITCODE -ne 0) { throw 'CA creation failed.' }
& $openssl req -newkey rsa:3072 -nodes -keyout broker.key -out broker.csr -subj '/CN=localhost'
if ($LASTEXITCODE -ne 0) { throw 'Broker CSR creation failed.' }
@"
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$hubLanIp
"@ | Set-Content -LiteralPath .\broker.ext -Encoding ascii
& $openssl x509 -req -in broker.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out broker.crt -days 365 -sha256 -extfile broker.ext
if ($LASTEXITCODE -ne 0) { throw 'Broker certificate signing failed.' }
& $openssl verify -CAfile ca.crt broker.crt
if ($LASTEXITCODE -ne 0) { throw 'Broker certificate verification failed.' }
```

The commands create unencrypted private keys, protected by your folder permissions; keep the CA private key away from the ESP32, browser and Git. Only the public `ca.crt` belongs on clients. Renew the broker certificate before expiry and reissue it if the IP/hostname changes. Firmware TLS also needs a valid device clock and CA verification.

### 9.3 Configure and start the broker

Edit the private `mosquitto.conf` with a text editor:

- Change `listener 8883 127.0.0.1` to `listener 8883 YOUR_ACTUAL_HUB_LAN_IPV4` so the ESP32 can reach it. For this binding, the hub must also use `mqtts://YOUR_ACTUAL_HUB_LAN_IPV4:8883`, not localhost.
- Replace every `C:/private/homeauto/...` file path with the actual private broker folder, using forward slashes and double quotes around paths containing spaces.
- Point `password_file`, `acl_file`, `cafile`, `certfile`, `keyfile` to the files just created.
- Keep `allow_anonymous false`, the supplied ACL policy, TLS validation and `persistence false`.

Allow inbound TCP 8883 only on the Windows Private network profile from the actual ESP32 subnet/IP. Use Windows Defender Firewall Advanced Settings; do not disable the firewall or create router internet forwarding. The web UI can remain loopback-only on port 3001 while MQTT listens on the private LAN.

Run Mosquitto in a separate terminal, keeping it open:

```powershell
& 'C:\Program Files\mosquitto\mosquitto.exe' -c "$env:USERPROFILE\HomeAutoPrivate\broker\mosquitto.conf" -v
```

It must report a listener without certificate/path/ACL errors. Return to the repository terminal with `Set-Location "$env:USERPROFILE\Projects\HomeAuto"`, set `HOMEAUTO_MQTT_CA`, restart the hub if needed, and configure Modules. Confirm authenticated connection and ACL denial tests on a disconnected bench setup before attaching physical actuators. Do not publish sample control payloads to a live household broker.

## 10. ESP32 commissioning: what is still required

The preserved sketches are `firmware/light_controller/light_controller.ino` and `firmware/door_security/door_security.ino`. They use separate logical controllers `lights` and `door`. They are **not** a finished combined single-ESP32 firmware. GPIO 4/5/18/19 conflict between the relay and RFID/door arrangements. Do not paste the sketches together or flash one expecting all modules to work.

Before physical use, the firmware engineer must:

1. Install Arduino IDE and the Espressif ESP32 board support, select the exact board and its serial port, and install the libraries used by the chosen sketch (`PubSubClient`, `ArduinoJson`, plus `MFRC522` for RFID). Library/core versions are not pinned or physically validated in this repository; record the versions that compile and pass the bench tests.
2. Use a verified wiring/power diagram and determine relay polarity. For a single board, implement and review a conflict-free pin map and both logical roles; this integration is pending.
3. Provision actual 2.4 GHz Wi-Fi settings and the new laptop/broker address privately. Old hardcoded addresses are not portable. USB only powers/programs the controller; commands use Wi-Fi.
4. Replace the legacy anonymous/plain-TCP MQTT client with CA-verified TLS and dedicated board credentials. The current sketches cannot connect unchanged to the secure broker template. A single combined firmware needs a reviewed least-privilege principal/ACL covering both roles; do not reuse the owner/hub credentials.
5. Preserve the exact existing MQTT topics and payload schemas. Lights use `home/light/1..4/command` and matching `/status`; door uses `home/door/1/command`, `/status`, `/rfid`; sensors use `home/sensor/gas/data`, `home/sensor/motion/data`; presence uses `home/esp32/lights/online` and `home/esp32/door/online`.
6. Make reconnect nonblocking and prioritize timed relocking, including during Wi-Fi/broker loss. Current legacy blocking reconnect can delay the five-second relock.
7. Compile and run supervised bench tests with low-voltage indicators first. Verify non-retained fresh reports, disconnection, reconnection, commands, permissions and failure handling. Never use retained or fabricated reports as proof of connection.

Keep `HOMEAUTO_DOOR_ENABLED=0`. Do not enable door actuation until supervised power/relay/relock/outage/egress tests pass. The app has no bolt/contact sensor and cannot certify that a physical door is locked. This setup guide does not flash firmware or certify physical operation.

At least one supported fresh board report enables the general UI/assistant, but each device still requires its own controller and current observation. A connected lights role does not make the door available. See `docs/verification/IOT_SOFTWARE_CONTRACT_VERIFICATION.md` for the reviewed contract and remaining physical checks.

## 11. Check the RTX 3050 laptop

Install the appropriate laptop/OEM or [NVIDIA driver](https://www.nvidia.com/Download/index.aspx), reboot if required, then run:

```powershell
nvidia-smi
nvidia-smi --query-gpu=name,memory.total,memory.free,driver_version --format=csv
```

Confirm the expected GPU and approximately 4 GB dedicated VRAM. If the command is missing, inspect the NVIDIA driver installation/PATH and Device Manager. Do not treat missing `nvidia-smi` as proof that no GPU exists. The driver was not verified on the destination laptop during preparation of this guide.

No CUDA toolkit installation is needed for the current Node app or the CPU Piper/OpenCV trials below. A future GPU worker must select compatible CUDA/cuDNN/ONNX Runtime or PyTorch versions, verify the actual execution provider and benchmark concurrent face/voice load. `nvidia-smi` displaying a CUDA version does not prove that a Python framework is installed or using the GPU.

## 12. Voice setup and optional small offline output trial

### 12.1 Use the implemented browser voice feature

After real ESP32 readiness:

1. Open Assistant in Chrome/Edge on `http://127.0.0.1:3001`, allow microphone access and check Windows **Privacy & security → Microphone** permissions.
2. In Settings → Voice & assistant, choose English/Hindi voices from those actually installed. Enable spoken replies and choose Automatic reply language if you want the reply to follow recognized language.
3. Use the voice preview, check system/browser volume and unmute the site. Install missing Windows language/speech voice features if needed; the inventory is browser/OS-dependent.
4. Select English/Hindi recognition explicitly when needed. Standard browser recognition uses one language hint; Automatic listening follows app language and does not guarantee perfect bilingual recognition.
5. Start with an unambiguous supported phrase, such as “Turn on light two” or “लाइट दो चालू करो”, only on a supervised connected fixture. Manual microphone clicks do not need a wake word.
6. **Start conversation** enables repeated turns. **End conversation** stops it. Wake listening is optional in Settings and requires deliberate start; refresh does not silently reopen the mic.

Browser recognition may send audio to its provider and require internet. Installed local TTS alone does not make input fully offline. No arbitrary-question chatbot is included.

### 12.2 Optional: test Piper separately, without changing HomeAuto

This section generates local WAV files for listening. It does **not** replace the app's Web Speech output or start a new HomeAuto API. Skip it if you only need the currently implemented application. Use a separate Python environment, not the historical native voice requirements under `server/voice`.

Install Python 3.11 x64 with its launcher from [python.org](https://www.python.org/downloads/windows/). Then, from the project root:

```powershell
py -3.11 --version
py -3.11 -m venv .local\piper-venv
if ($LASTEXITCODE -ne 0) { throw 'Piper virtual environment creation failed.' }
& .\.local\piper-venv\Scripts\python.exe -m pip install --upgrade pip
& .\.local\piper-venv\Scripts\python.exe -m pip install 'piper-tts==1.8.0'
if ($LASTEXITCODE -ne 0) { throw 'Piper installation failed.' }
```

Download one Hindi and one English voice plus their configs and model cards. These are approximately 63 MB per voice, not multi-GB language models. The English candidate is US English; this does not promise a natural Indian English accent. Downloads are pinned to the previously evaluated publisher revision. Read each model card before use/distribution; the runtime is GPL-3.0 and individual voice/data terms differ.

```powershell
$modelDir = Join-Path (Get-Location).Path '.local\piper-models'
New-Item -ItemType Directory -Path $modelDir -Force | Out-Null
$piperRevision = 'e9ab671f2a0e50a701b34361136ba3e6a3a9eb0c'
$piperBase = "https://huggingface.co/rhasspy/piper-voices/resolve/$piperRevision"
$voicePaths = @('hi/hi_IN/pratham/medium/hi_IN-pratham-medium', 'en/en_US/lessac/medium/en_US-lessac-medium')
foreach ($voicePath in $voicePaths) {
    $voiceName = ($voicePath -split '/')[-1]
    Invoke-WebRequest "$piperBase/$voicePath.onnx" -OutFile (Join-Path $modelDir "$voiceName.onnx") -UseBasicParsing
    Invoke-WebRequest "$piperBase/$voicePath.onnx.json" -OutFile (Join-Path $modelDir "$voiceName.onnx.json") -UseBasicParsing
    $voiceFolder = $voicePath.Substring(0, $voicePath.LastIndexOf('/'))
    Invoke-WebRequest "$piperBase/$voiceFolder/MODEL_CARD" -OutFile (Join-Path $modelDir "$voiceName.MODEL_CARD.md") -UseBasicParsing
}
Get-Content (Join-Path $modelDir 'hi_IN-pratham-medium.MODEL_CARD.md')
Get-Content (Join-Path $modelDir 'en_US-lessac-medium.MODEL_CARD.md')
if ((Get-FileHash (Join-Path $modelDir 'hi_IN-pratham-medium.onnx') -Algorithm SHA256).Hash.ToLowerInvariant() -ne '169964b0871667f6793416d4b35e97357a68ba1ad01df8580c28048989ee7693') { throw 'Hindi model checksum mismatch.' }
if ((Get-FileHash (Join-Path $modelDir 'hi_IN-pratham-medium.onnx.json') -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'b68edd2cd7950dd436314013b7cd12e9699e5a3f6fe5af5af94294cf6aa7b9fd') { throw 'Hindi config checksum mismatch.' }
if ((Get-FileHash (Join-Path $modelDir 'en_US-lessac-medium.onnx') -Algorithm SHA256).Hash.ToLowerInvariant() -ne '5efe09e69902187827af646e1a6e9d269dee769f9877d17b16b1b46eeaaf019f') { throw 'English model checksum mismatch.' }
if ((Get-FileHash (Join-Path $modelDir 'en_US-lessac-medium.onnx.json') -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'efe19c417bed055f2d69908248c6ba650fa135bc868b0e6abb3da181dab690a0') { throw 'English config checksum mismatch.' }
```

Generate two samples using the [official Piper Python API](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/API_PYTHON.md). The helper is created only under ignored `.local`; loading is CPU-only by default:

```powershell
@'
from pathlib import Path
import time
import wave
from piper import PiperVoice

root = Path(__file__).resolve().parent
for name, text, output in [
    ("hi_IN-pratham-medium", "नमस्ते। मैं आपकी लाइट और घर के उपकरणों में मदद कर सकता हूँ।", "hindi-preview.wav"),
    ("en_US-lessac-medium", "Hello. I can help you control your lights and check your home.", "english-preview.wav"),
]:
    voice = PiperVoice.load(str(root / "piper-models" / (name + ".onnx")))
    for attempt in range(2):
        started = time.perf_counter()
        with wave.open(str(root / output), "wb") as destination:
            voice.synthesize_wav(text, destination)
        print(name, "first" if attempt == 0 else "warm", round((time.perf_counter() - started) * 1000), "ms for complete WAV generation")
    print("Saved", root / output)
'@ | Set-Content -LiteralPath .\.local\piper-preview.py -Encoding utf8
& .\.local\piper-venv\Scripts\python.exe .\.local\piper-preview.py
if ($LASTEXITCODE -ne 0) { throw 'Piper sample generation failed.' }
Start-Process (Resolve-Path .\.local\hindi-preview.wav).Path
Start-Process (Resolve-Path .\.local\english-preview.wav).Path
```

After downloading/installing, you can disconnect the internet and rerun this helper to check local synthesis. It reads only local model paths. The reported time excludes model loading, recognition, home command execution, browser transport and speaker playback. Listening quality still needs your judgment.

Previous CPU evaluation on the old laptop measured Hindi Pratham median complete generation **231 ms**, Chrome playback start **248 ms**; Hindi Rohan measured **162 ms / 313 ms** respectively. These are prior measured trials, not a guarantee on this GPU laptop. Neither establishes a complete conversational answer below 100 ms. See `docs/verification/CPU_TTS_EVALUATION.md`. The old audition tools/page on port 3010 are outside the repo and are not launched by this setup.

To integrate Piper later, implement a persistent protected output worker, preserve cancellation, Hindi/English selection and anti-echo behavior, and benchmark first audio and full generation separately. Do not start Python and load the model for every utterance. Keep security/action confirmations tied to real backend outcomes. Cached fixed replies may reduce response delay but must never fabricate device success.

## 13. Optional offline face-model trial

### 13.1 Camera configuration in the actual app

In Modules, save the camera's private LAN hostname/IPv4 and documented port, then select **Check connection**. A successful result means TCP reachability only. The CP Plus CP-E31A's supported local RTSP/ONVIF stream, credentials, decoding, WAN independence and video freshness still need verification on the actual unit. Do not assume a generic RTSP URL or port 554 works for this camera.

No face enrollment or unlock endpoint exists in the active app. Optional camera failure leaves valid ESP32 operations available. Model downloads alone cannot enable video or face unlocking.

### 13.2 Prepare small models for a standalone comparison

YuNet detects faces; SFace compares face embeddings. This is separate from HomeAuto and uses CPU OpenCV, reserving the GPU for later measured work. It cannot command the ESP32 or unlock the door.

From the project root, create a separate environment:

```powershell
py -3.11 -m venv .local\face-venv
if ($LASTEXITCODE -ne 0) { throw 'Face virtual environment creation failed.' }
& .\.local\face-venv\Scripts\python.exe -m pip install --upgrade pip
& .\.local\face-venv\Scripts\python.exe -m pip install 'opencv-python==4.13.0.92'
if ($LASTEXITCODE -ne 0) { throw 'OpenCV installation failed. Do not mix this environment with Piper.' }
```

Download from the [official OpenCV Zoo](https://github.com/opencv/opencv_zoo). The revision below is fixed for reproducibility. Keep model licenses next to the files:

```powershell
$faceDir = Join-Path (Get-Location).Path '.local\face-models'
New-Item -ItemType Directory -Path $faceDir -Force | Out-Null
$zooRevision = '48b10fa505aeb51fbd127fc60a5c660040e823b7'
$zooMedia = "https://media.githubusercontent.com/media/opencv/opencv_zoo/$zooRevision/models"
$zooText = "https://raw.githubusercontent.com/opencv/opencv_zoo/$zooRevision/models"
Invoke-WebRequest "$zooMedia/face_detection_yunet/face_detection_yunet_2023mar.onnx" -OutFile (Join-Path $faceDir 'yunet.onnx') -UseBasicParsing
Invoke-WebRequest "$zooMedia/face_recognition_sface/face_recognition_sface_2021dec.onnx" -OutFile (Join-Path $faceDir 'sface.onnx') -UseBasicParsing
Invoke-WebRequest "$zooText/face_detection_yunet/LICENSE" -OutFile (Join-Path $faceDir 'YUNET_LICENSE.txt') -UseBasicParsing
Invoke-WebRequest "$zooText/face_recognition_sface/LICENSE" -OutFile (Join-Path $faceDir 'SFACE_LICENSE.txt') -UseBasicParsing
Get-FileHash (Join-Path $faceDir '*.onnx') -Algorithm SHA256
if ((Get-FileHash (Join-Path $faceDir 'yunet.onnx') -Algorithm SHA256).Hash.ToLowerInvariant() -ne '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4') { throw 'YuNet model checksum mismatch.' }
if ((Get-FileHash (Join-Path $faceDir 'sface.onnx') -Algorithm SHA256).Hash.ToLowerInvariant() -ne '0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79') { throw 'SFace model checksum mismatch.' }
```

Use clear photos only of yourself or a person who consented, taken in separate sessions. Save them privately as `.local\face-a.jpg` and `.local\face-b.jpg`. Do not upload biometric images/embeddings to GitHub. Create this comparison helper:

```powershell
@'
from pathlib import Path
import time
import cv2 as cv

root = Path(__file__).resolve().parent
detector = cv.FaceDetectorYN.create(str(root / "face-models/yunet.onnx"), "", (320, 320))
recognizer = cv.FaceRecognizerSF.create(str(root / "face-models/sface.onnx"), "")

def embedding(filename):
    image = cv.imread(str(root / filename))
    if image is None:
        raise SystemExit("Missing or unreadable private photo: " + filename)
    detector.setInputSize((image.shape[1], image.shape[0]))
    started = time.perf_counter()
    _, faces = detector.detect(image)
    if faces is None or len(faces) != 1:
        raise SystemExit("Use a photo containing exactly one clear face: " + filename)
    aligned = recognizer.alignCrop(image, faces[0])
    feature = recognizer.feature(aligned).copy()
    print(filename, round((time.perf_counter() - started) * 1000), "ms detection/alignment/embedding; excludes image loading")
    return feature

a, b = embedding("face-a.jpg"), embedding("face-b.jpg")
score = recognizer.match(a, b, cv.FaceRecognizerSF_FR_COSINE)
print("Cosine similarity:", score)
print("Comparison only. No identity acceptance, liveness, door access or MQTT action.")
'@ | Set-Content -LiteralPath .\.local\face-preview.py -Encoding utf8
& .\.local\face-venv\Scripts\python.exe .\.local\face-preview.py
```

This is an API/setup smoke test, not a face-security benchmark. Record consent, model hashes, lighting, false accepts/rejects and independent evaluation images before considering an access feature. OpenCV example thresholds must not be treated as a safe household unlock policy. YuNet/SFace do not provide liveness. Photo/display attacks and stale/replayed camera frames require a separate evaluated design. Keep the existing owner confirmation and door gate intact.

## 14. Test the cloned source

The automated suites use isolated fixtures/injected hardware; they must not exercise a live broker, camera or door. Run from the repository root:

```powershell
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Software tests failed.' }
```

For browser/navigation, mobile themes and module setup:

```powershell
npm.cmd exec --prefix server -- playwright install chromium
if ($LASTEXITCODE -ne 0) { throw 'Test browser installation failed.' }
npm.cmd --prefix server run test:modules-browser
if ($LASTEXITCODE -ne 0) { throw 'Modules browser checks failed.' }
npm.cmd --prefix server run test:browser-conversation
if ($LASTEXITCODE -ne 0) { throw 'Conversation browser checks failed.' }
npm.cmd --prefix server run test:ux
if ($LASTEXITCODE -ne 0) { throw 'UX browser checks failed.' }
```

Optional mobile coverage: install WebKit with `npm.cmd exec --prefix server -- playwright install webkit`, then run `npm.cmd --prefix server run test:mobile -- --browser=webkit`. Test results are under ignored `.local\qa`. Browser speech is substituted in automated conversation checks; a pass does not certify real microphone accuracy, voice quality or physical actuation. Do not use historical native STT/TTS test scripts as the base installation procedure.

Manually verify the actual laptop:

- Modules/first owner work without hardware; normal runtime reports `simulation: false`.
- Browser refresh and Back/Forward preserve valid routes; My Home returns Home once hardware is ready.
- All four themes work; Theme 05 Serene Emerald is the fresh-install default.
- Disconnected ESP32 prevents controls/assistant; a broker-only connection cannot bypass that state.
- On a supervised physical fixture, a fresh board enables only its supported devices; disconnect removes availability.
- Missing camera/sensors show their own warnings and do not block connected lights.
- English/Hindi microphone, reply language, volume, Stop and wake-word option work with the actual browser's voices.
- When testing offline manual controls, disconnect WAN while retaining the local router/Wi-Fi; switching Wi-Fi off also disconnects the ESP32.

## 15. Backup, transfer existing household data and recover

Fresh installation is the default. To retain actual household data, use an encrypted/private drive or another authorized private transfer, never GitHub.

1. Stop the old hub and any operator writer. Do not delete a database lock while its process is running.
2. From the old repository root, run `npm.cmd --prefix server run recovery -- backup`. This prints a private backup path. If a custom database path is used, set the same `HOMEAUTO_DB_PATH` for the operator command.
3. Transfer the resulting `.db` and its `.sha256` sidecar privately, outside the new checkout. Treat the data as sensitive: it contains accounts/audit/household records and is not database-encrypted.
4. Install dependencies on the new laptop, then **stop its hub** before restoring.
5. From the new repository root, substitute the actual private backup path:

```powershell
npm.cmd --prefix server run recovery -- inspect 'C:\path\to\private\homeauto-backup.db'
if ($LASTEXITCODE -ne 0) { throw 'Backup verification failed.' }
npm.cmd --prefix server run recovery -- restore 'C:\path\to\private\homeauto-backup.db'
if ($LASTEXITCODE -ne 0) { throw 'Backup restore failed.' }
```

6. Restart and sign in with the restored local account. Restored sessions/challenges are invalidated, pending commands are not replayed and hardware must report again.
7. Re-enter Modules credentials on the new machine, create new host certificates and configure its CA path. Do not move Windows DPAPI ciphertext or share private keys through Git.
8. Re-select browser preferences and approve microphone permission. Shut down the old controlling hub before enabling the new one against the same devices; avoid two hubs issuing commands.

For a forgotten local password, stop the hub, then run `npm.cmd --prefix server run setup -- reset-password YOUR_USERNAME` in an interactive terminal. Enter at least 12 characters at the hidden operator prompt. The operator CLI minimum remains 12; the one-time browser setup minimum is 10. Passwords are never command-line arguments.

## 16. Everyday startup, shutdown and updates

**Start:** start your provisioned MQTT broker if it is not a service, power the commissioned ESP32, then use the desktop shortcut/BAT. Keep the controlling laptop awake and on the LAN. Reopen Modules to diagnose missing devices. The camera is optional.

**Foreground alternative:** useful for diagnostics and clean Ctrl+C shutdown. Do not run it beside the BAT-started hub:

```powershell
$env:HOMEAUTO_PORT = '3001'
# If required, set HOMEAUTO_MQTT_CA to your public broker CA file first.
npm.cmd --prefix server start
```

Leave that terminal open; press Ctrl+C to stop it. Direct `npm start` without the port variable defaults to 3000, while the BAT uses 3001. Use `127.0.0.1` consistently because changing origin changes cookies and browser preferences.

**Stop a hidden BAT-started hub:** inspect `Get-NetTCPConnection -State Listen -LocalPort 3001`, then look up its `OwningProcess` with `Get-CimInstance Win32_Process -Filter 'ProcessId=THE_ACTUAL_PID'`. Verify that it is the HomeAuto Node server before `Stop-Process -Id THE_ACTUAL_PID`. This terminates the process; use foreground Ctrl+C when you need graceful shutdown for maintenance. Do not terminate all Node processes or remove a live DB lock. Stop/secure physical activity before maintenance; do not rely on hub shutdown to relock a door.

**Update:** back up, stop the hub and run these commands from the correct checkout:

```powershell
git status --short
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw 'Update failed. Preserve local edits and resolve them before continuing.' }
npm.cmd ci --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'Root install failed.' }
npm.cmd ci --ignore-scripts --prefix server
if ($LASTEXITCODE -ne 0) { throw 'Server install failed.' }
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Updated tests failed.' }
.\Start-HomeAuto.bat
```

If `git status` shows your edits, preserve/review them before pulling. Do not use `git reset --hard` or copy an old database over a newer one to fix an update. Cloning/pushing this repository does not redeploy the public website.

## 17. Second laptop, phones and remote website

`localhost` always refers to the computer running that browser. On the presentation laptop, `127.0.0.1:3001` does not point to the GPU/hub laptop. Both machines need a reachable LAN and a trusted HTTPS hub endpoint for direct LAN browser/microphone use.

The one-click BAT is deliberately for loopback HTTP. For LAN operation, stop it and provision fresh web TLS separately:

```powershell
# Replace the example IP with the hub's actual reserved private address.
npm.cmd --prefix server run tls:setup -- localhost 127.0.0.1 192.168.1.50
```

This creates `.local\tls\server.cert` and `server.key` only if neither exists. It prints a fingerprint and does not establish client trust. Prefer a household CA-signed leaf certificate; explicitly establish trust and verify identity on each client. The provided leaf expires in 90 days. A certificate-warning bypass does not establish secure microphone operation.

With trusted TLS prepared, use a terminal/manual start, not the hardcoded HTTP BAT:

```powershell
$env:HOMEAUTO_HOST = '192.168.1.50'
$env:HOMEAUTO_PORT = '3001'
$env:HOMEAUTO_ALLOWED_HOSTS = 'localhost,127.0.0.1,[::1],192.168.1.50'
npm.cmd --prefix server start
```

Allow inbound web TCP 3001 only from intended private-LAN clients and open `https://192.168.1.50:3001` on the other device. The actual IP must match the TLS SAN and allowed hosts. Do the first owner setup on loopback before switching to LAN. Once the default web TLS files exist, the hub serves HTTPS; do not use the HTTP-only BAT readiness check in that configuration.

The public Vercel site is a separate runtime. A local owner account does not enroll a cloud gateway. Keep remote actuation gates off until the existing gateway enrollment and release checks are satisfied. Never open the hub/MQTT/camera ports to the public internet to make the website connect. Remote browser voice should not be described as a completed offline audio relay; that integration remains separate work.

## 18. Troubleshooting

| Symptom | Check and next action |
|---|---|
| BAT says Node 22 required | `node --version`, PATH, or set `HOMEAUTO_NODE` to the actual Node 22 executable |
| `npm.ps1` blocked | Use `npm.cmd` as in this guide; no global execution-policy change is needed |
| Dependencies missing | Run both `npm.cmd ci --ignore-scripts` commands from section 4 |
| Port 3001 occupied | Identify its listener/process. Reuse the correct hub or stop only the verified conflicting process |
| Browser cannot open page | Check `.local\launcher` logs, runtime URL and whether web TLS makes the URL HTTPS; do not use the loopback BAT for a TLS/LAN profile |
| Setup form absent | A local account already exists, wrong origin/database is open, or the request is not loopback; use login/recovery instead of deleting data |
| Login fails | Use the local account, exact registered username and password; cloud credentials are separate |
| Modules reports config unavailable after transfer | DPAPI settings came from another user/machine; save new broker/camera settings under this Windows user |
| MQTT disconnected | Broker running, correct endpoint/listener, correct CA/SAN, independent username/password, ACL and restricted firewall |
| MQTT connected but ESP32 missing | Check firmware TLS/auth, serial logs, Wi-Fi, logical role, exact topics and fresh non-retained reports |
| Only some devices available | Inspect the specific board/sensor freshness; one connected role does not implement the other |
| Camera reachable but no video | Current check is TCP only; verify supported local stream/decoder before recognition work |
| Door action disabled | Expected commissioning gate; retain it until physical acceptance, not a reason to bypass it |
| Mic disabled | ESP32 readiness first, then browser/Windows permission, supported browser and correct secure/local origin |
| Hindi reply silent/wrong voice | Install/select an actual Hindi voice, preview it, check Automatic reply language and site/system volume |
| Piper installed but app unchanged | Expected: section 12 is an isolated trial, not an integrated speech provider |
| Face models installed but no unlock | Expected: standalone comparison is not an access-control integration |
| GPU usage stays zero | Current app and the documented standalone trials do not request a CUDA provider |
| Complete voice reply exceeds 100 ms | No such guarantee exists; measure loaded-model generation and playback separately, including actual recognition/action delays |

## 19. Handoff acceptance and next development work

Before presenting, record the Git commit (`git rev-parse HEAD`), Node version, broker/firmware versions, actual browser voice selection and software-test results on the new laptop. Confirm the UI and hardware path on supervised fixtures, including disconnect/reconnect behavior. Keep actual secrets and personal test media out of reports and Git.

At publication, the development laptop had passing hardware-module software/browser tests with injected devices. These do not prove destination-laptop installation, physical camera/ESP32 operation, human voice quality, face security or GPU performance. Optional model commands are separate setup trials and cannot remove those acceptance requirements.

Transfer preflight on 2026-11-18 used a clean export of the publication's 304 tracked files, without the old laptop's dependencies or private state. Both lockfile installs, publication scan, 142 JavaScript syntax checks, cloud containment build, 271 software tests, three module browser groups/eight captures, 12 conversation groups/16 layouts and 30 UX checks passed. Playwright Chromium installed with the documented command, without a browser fallback. A fresh disk-backed hardware runtime opened Modules and first-owner setup with simulation disabled and no physical commands. All 28 PowerShell examples and both Python examples parsed; the exact Piper helper generated both language samples using the prior isolated CPU environment and model files. OpenCV package/model/license URLs and publisher model hashes were checked; the two-photo helper was syntax-checked, not certified against a camera or human evaluation set. Staged source and existing Git history passed Gitleaks with zero findings. Private/generated/PPT files were excluded.

Remaining implementation work is explicit: secure combined single-ESP32 firmware, actual camera stream verification, face enrollment/quality/liveness evaluation with an appropriate access policy, and an app-integrated persistent local TTS output worker if its voice/latency is accepted. Keep existing APIs, MQTT contracts, UI themes and security gates while implementing those changes.

## 20. Reference sources

- [Node.js 22 downloads](https://nodejs.org/en/download/archive/v22), [Git for Windows](https://git-scm.com/install/windows), [Python Windows installers](https://www.python.org/downloads/windows/).
- [Mosquitto downloads](https://mosquitto.org/download/) and the committed `deploy/mosquitto.conf.example` / `deploy/homeauto.acl` templates.
- [Piper source and runtime license](https://github.com/OHF-Voice/piper1-gpl), [Python API](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/API_PYTHON.md), [voice repository](https://huggingface.co/rhasspy/piper-voices).
- [OpenCV face API tutorial](https://docs.opencv.org/4.x/d0/dd4/tutorial_dnn_face.html), [OpenCV Zoo](https://github.com/opencv/opencv_zoo), [NVIDIA driver downloads](https://www.nvidia.com/Download/index.aspx).

Older documents retain dated implementation history, including retired preview/native voice procedures. For this laptop transfer, use this file and the active entry point `server/server.js`; do not follow old model/environment paths as if they were active.
