# Voice startup, foreground return and retry — 2026-11-15

Later follow-up: [voice timeout repair](VOICE_TIMEOUT_REPAIR.md) adds encoder reuse, Windows interpreter-tree cleanup, private processing stages and measured 60/65-second recognition/browser bounds. That report supersedes the earlier 30/35-second bounds below; this startup/recovery evidence remains dated history.

## Findings

The local server initially responded while both speech workers were still starting. Their asset files and Python environments were present; both subsequently became ready. The UI had only a ready boolean and displayed “Local setup required” for every false value, including loading and worker failure.

Chrome accessibility initially reported a disabled microphone with the setup label while the API reported ready workers. Local state had no foreground reconciliation; only cloud mode refreshed on return. A separate fixture reproduced a stale local snapshot with an apparently open socket and no new WebSocket message. Later native accessibility reads lagged the visible Chrome tab, so they do not establish the exact duration or sole cause of the user's stale screen.

The old recognition worker also stopped during this session while synthesis remained ready. The old service did not retain a diagnostic cause, so a timeout, memory failure or other exit cannot be distinguished from this evidence. Available RAM was about 0.5 GB during one observation and later exceeded 4 GB; pressure may affect loading/inference, but is not a proven cause of that exit.

## Changes

- The speech service reports `checking`, `loading`, `ready`, `not_configured`, `disabled`, `failed` or `stopped` for each worker. Missing assets, loading and failure no longer share one UI message. The existing ready booleans remain compatible.
- Assistant, Voice settings, Local AI and diagnostics use shared status presentation with English/Hindi text. The microphone remains disabled until the recognition worker confirms readiness. Text input remains usable; no foreground event opens the microphone.
- Local window focus, visibility return and persisted page restoration request a fresh snapshot. Concurrent return events share one read. Failures close only the owning transport for normal reconnect. Retired errors cannot close a newer household connection; logout clears the callback. Existing snapshot/session guards remain.
- Owners have an explicit **Retry voice** control. It uses the existing protected model activation route, rechecks hashes, starts a failed/missing profile once and reports loading until its worker confirms ready. It does not download models, enable disabled configuration, replay audio, execute a command or bypass reauthentication/CSRF/origin checks.
- Duplicate activation during checking/loading is rejected. Old worker output/error/exit handlers cannot retire a replacement. Closing prevents late ready messages from reviving the service. Failed workers no longer advertise stale language capabilities.
- Timeout/unavailable feedback describes stopped processing and retry rather than asserting missing installation. No job deadline was increased, and no other applications were closed.

## Verification

Evidence: `D:/homeauto-audit-tools/speech-startup-20261115`.

| Check | Result |
|---|---|
| Final full backend/security suite | **217 passed**, 0 failed/skipped (`backend-recovery.log`) |
| Focused lifecycle/ownership/configuration checks | **15 passed** (`focused-recovery.log`) |
| Isolated mobile Chrome startup/recovery | **8 groups passed**, 0 page errors/external requests (`browser-recovery/results.json`) |
| Broader navigation/preferences/accessibility | **30 groups passed**, 0 page errors (`ux.log`); collection preceded the final explicit-retry addition |
| Cloud build containment | **457 traced files, 0 native hub files** (`build-recovery.log`) |
| Real simulator recovery | Deliberately stopped only the owned recognition interpreter after confirming simulation mode and process ancestry. API reported STT failed/TTS ready. Existing owner activation returned loading, then both actual workers reported ready. No execute request or hardware command was sent. |

The browser fixture exercises checking/loading, missing/failed distinctions, readiness enabling the microphone, failure disabling it again, explicit authenticated retry without command replay or mic capture, a fresh foreground HTTP read without any WS update, preserved drafts and Hindi messages. Workers/assets are mocked in that fixture; it does not load extra native model copies. Backend tests separately cover permission, recent reauthentication, CSRF and origin rejection before activation.

Native Chrome was inspected through the computer-use skill. A tab-selection click initially lacked geometry; screenshots then showed that accessibility state could lag actual visible tabs. Computer Use ultimately stopped because it could not determine the current Windows browser URL with enough confidence to enforce policy. No further Chrome input was sent. Final personal-Chrome button/microphone verification is therefore **not claimed**. The deliberately stopped recognition worker was restored through the same local API after that UI stop; both real speech workers are ready again.

## Current use and limits

Server: `http://127.0.0.1:3001/assistant` in simulation mode. Reload Chrome once to load the changed frontend and the restarted preview's current guest session. Loading feedback then updates with readiness; foreground return reconciles stale status within the current session. A failed worker offers Retry voice to an authorized owner. The existing wake-phrase preference is preserved.

This fixes state presentation, reconciliation and explicit recovery. It does not certify the personal microphone, recognition under every memory/CPU load, or every human accent. The 30-second native job and 35-second browser processing bounds remain; heavy pressure can still require a retry. The earlier actual-model synthetic acceptance is in [WHISPER_UPGRADE.md](WHISPER_UPGRADE.md). Physical ESP32 commissioning, remote audio relay and the all-in-one installer remain outside this change. No firmware, MQTT topics, device authorization, cloud database, Git publication or deployment was changed.
