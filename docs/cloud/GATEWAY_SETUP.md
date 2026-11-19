# Connect a home gateway

New accounts start with a private, empty home. The primary action is **Connect gateway**; **Explore demo home** is offered alongside it. No device is provisioned or confirmed by visiting the website.

## Owner setup

1. Sign in to the online app and open Settings → Home gateway.
2. Prepare the existing local HomeAuto installation on the computer connected to the ESP32 boards. Keep its MQTT, device and offline speech configuration.
3. Select Create connection file and confirm the owner password. Download `homeauto-gateway.json` to that computer. It is a private credential: do not commit, share, upload, or attach it to a support report.
4. Stop the existing hub process. From the project root, run:

   ```powershell
   node server/scripts/with-gateway.js "C:\private\homeauto-gateway.json"
   ```

5. Open gateway setup again and check the connection. Devices appear only after an accepted gateway report. Merely downloading the file does not establish a connection.

The launcher enables the telemetry gateway and keeps the legacy cloud mirror off. Remote lighting and door gates are off by default; the laptop operator can enable them with the separately documented environment flags after secure broker and physical checks. The laptop dashboard validates the same cloud account credentials against the paired household. See the [remote hub flow](REMOTE_HUB_ARCHITECTURE.md).

The connection file expires after 30 days. Renew a connected gateway through the existing local operator workflow before expiry. Before the first report, the owner can explicitly replace a lost setup file; the old key is revoked. A connected or revoked gateway cannot be overwritten by this browser flow. Do not remove an existing gateway merely to repeat setup.

## Trust boundaries

The server derives household and user identity from the current session. A fresh owner password confirmation is required, and SQL revalidates the session under a user lock. Household-scoped enrollment is serialized. The runtime can execute the narrow enrollment function but cannot select gateway keys, passwords, or sessions. Only the token hash is stored. The plaintext token is returned once, held in memory for the download, and never rendered into text, persisted in browser storage, or logged. All browser writes retain Origin, CSRF and rate limits.

Migrations 004 and 005 are additive. The application accepts schema versions 2–5 for existing operations; remote door control requires version 5. Apply through the existing migration ledger and restricted grants. Do not edit migrations 001–004.

## Demo home

Demo home is an explicit browser simulation, separate from the authenticated real household. It has four lights, five rooms, read-only door status, sensor scenarios, favorites, activity and a bounded text preview of Shrimaan. The offline Vosk/Kokoro microphone and spoken replies remain on the actual hub; the demo does not claim to run that pipeline.

A persistent banner identifies simulated data on every demo screen. All non-auth API calls are intercepted by the demo transport; unsupported actions fail within the simulation. No physical request is sent. Door actuation, RFID management and real gateway enrollment are unavailable in demo mode.

Simulated light choices and favorites use a versioned, per-user/per-home sessionStorage key. Demo mode survives refresh within the tab. Scenarios, conversation and activity are transient and restart on reload. Reset affects only demo values. Use my real home restores the server snapshot; logout clears the active demo marker. Themes and accessibility preferences continue to use the existing durable preference system. No demo value becomes authoritative hardware state.

## Verification limits

Automated tests use disposable PostgreSQL and simulated hardware. Native database acceptance uses the isolated Neon acceptance branch. Production verification must never automatically enroll a real gateway or actuate hardware. Physical pairing, board communication, offline speech and real phone testing require the user's supervised installation.
