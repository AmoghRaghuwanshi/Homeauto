> Hindi/chat/wake follow-up, 2026-11-15: automatic replies use actual recognized words, including Hindi under an English decoder hint. Manual mic and manually started conversation never require a wake word. Optional Settings wake listening accepts Shrimaan/Shreeman/Shiman and Hindi forms on visible pages, pauses during replies, and has a global Stop control. Reload preserves only the option, never silently starts the microphone. Live chat retains up to 40 turns in memory; home/account changes and refresh clear it. Browser provider/network limitations and physical confirmation rules remain. See docs/verification/BROWSER_VOICE_ASSISTANT.md for current behavior and isolated evidence.

> Current voice update, 2026-11-15: [browser conversation implementation](verification/BROWSER_VOICE_ASSISTANT.md). The user has replaced native speech with browser Web Speech recognition/synthesis and authenticated final-text WebSocket validation. No HomeAuto speech models or Python workers load. Downloaded assets/environments were moved outside the project into a recoverable archive; old native instructions and measurements below are historical. Start conversation alternates listening and speech with a 350ms quiet buffer. Browser recognition may require internet, and Automatic listening follows the app language rather than promising portable bilingual detection. Device execution, authentication and physical confirmation rules remain on the hub.

# Local AI implementation progress

> Offline scoped assistant, 2026-11-15: [implemented behavior and evidence](verification/OFFLINE_SCOPED_ASSISTANT.md). Local English/Hindi dialogue now covers greetings, capabilities and spoken out-of-scope guidance alongside existing commands. This is a bounded intent/reply layer; no general-purpose LLM, Live API or new speech weights were installed. Approved fixed reply audio uses bounded RAM and verified local disk caches, reusable after restart; no recordings, hardware state or action confirmations enter this cache. A measured long-Hindi timeout required a 60s TTS bound with 65s browser polling, superseding the older TTS30s note below. All 238 backend tests and native voice/output/responsive checks pass; new-speech latency remains limited. Installer and remote audio relay remain unfinished.

> Latest voice follow-up, 2026-11-15: [timeout repair](verification/VOICE_TIMEOUT_REPAIR.md) retains full-context Whisper medium, reuses only identical encoder features within an utterance, retires Windows interpreter descendants and adds private processing feedback. STT/browser bounds are now 60/65 seconds; TTS remains 30 seconds. Shorter-context and small-model candidates were rejected rather than weakening command interpretation. Installer and remote audio relay work below remain unfinished.

> Latest listening upgrade, 2026-11-14: [Whisper replacement](verification/WHISPER_UPGRADE.md) supersedes the active Vosk baseline. Kokoro spoken output and existing demo/physical safety boundaries remain. Earlier dated evidence below is preserved.

> Architecture revision2026-11-14: AI runs on the ESP32-connected home hub. Remote clients will relay voice/conversations to that hub and receive its responses; the hub must be active and connected for remote voice and control. Models are installed on the hub only. See [the revised execution contract](cloud/HUB_AI_EXECUTION_PLAN.md). The implementation descriptions below remain current/historical evidence as dated; remote audio forwarding is not implemented yet.


2026-11-14. Implements the staged handoff in [LOCAL_AI_IMPLEMENTATION_PLAN.md](LOCAL_AI_IMPLEMENTATION_PLAN.md). Existing planning changes and the approved UI are preserved. This is an implementation checkpoint, not a completed installer release.

## W0 / W1 — transition prerequisites

The four audit2 findings have source fixes and regression evidence:

| Finding | Change | Verification |
|---|---|---|
| SM2-01 home/batch ownership | Household and demo changes share retirement/invalidation. Old device controls are removed before auth rotation. Bulk operations carry their origin realm and stop subsequent batches after a change. Failed household hydration leaves controls unavailable with Retry instead of restoring old-home authority. Late transition completions are ignored after realm retirement. | Actual-source tests for A→B batching and failed hydration; mocked browser journey emits only the original two Home A requests. |
| SM2-02 command cleanup | Per-device Symbol owner releases its own busy lock even if reauthentication makes the result stale. Retired cleanup cannot release a newer command owner. | Reauth completion and overlapping-owner regressions. |
| SM2-03 voice cancellation/settlement | Handshake resolve/reject/cancel share one settlement owner and clear the watchdog. Early socket close settles start. Generation is checked after native AudioContext.resume, and cleanup retires graph references. | Three mocked asynchronous regressions; actual Chromium AudioContext/AudioWorklet with synthetic stream reproduces the audit timing and finishes ready, stream/socket null, track ended. |
| SM2-04 stale assistant error | Current conversation generation gates execute success, failure and continuation after refresh. Retired playback errors cannot toast into the next session. | Held old execute failure after a newer successful reply preserves Current reply with no old error notification. |

`server/tests/audit2-transitions.test.js` exercises actual frontend source using deterministic VM/network/audio fixtures, following the existing coordinator-test pattern. All8 new expectations fail against an isolated copy of HEAD's pre-fix source and pass with the changes. These are finite regression checks, not a proof of all possible state interleavings.

Evidence outside source: `D:/homeauto-audit-tools/local-ai-implementation-20261114`.

- Baseline comparison: `before-regressions.log`,0/8 passed (expected failures); the isolated source copy is retained.
- Full updated suite:180 tests passed in the first run; final run is recorded in `backend-final.log`.
- Existing browser checks:30 UX groups and9 remediation groups passed, no page errors. These include navigation, preferences, focus, accessibility modes, disconnection and microphone-denial behavior. Their harness output is in the execution transcript; existing screenshots remain under ignored `.local/qa/ux`.
- `browser-household.cjs/json/png`: actual UI with mocked APIs, two Home A requests only, no page errors, no physical actions. Uses the prior audit journey with its expected result changed to the safe invariant.
- `native-voice-cancel.cjs/json`: actual Chromium Web Audio and actual VoiceCapture class, synthetic silent stream and mocked signaling. State ready, no stream/socket, track ended. No real microphone was recorded.

The historical audit report remains unchanged; its open statuses describe the audited baseline. This progress record describes the implementation follow-up. Do not erase or rewrite its original counterexamples.

## Runtime/dependency investigation for W2–W4

A fresh external directory containing only current `server/package.json` and its committed lockfile completed `npm ci --ignore-scripts --omit=dev` under Node22.23.4:173 packages installed,0 reported vulnerabilities. Imports of Express, sql.js, MQTT and Vosk succeeded. This is an empty dependency folder on the development host; installed system DLLs/tools may still affect it. It is not a clean Windows VM pass, and Vosk import alone is not a newly measured model inference test.

Official Node distribution checksum endpoint was read directly. Windows-x64 candidate:

```text
URL: https://nodejs.org/dist/v22.23.4/node-v22.23.4-win-x64.zip
SHA256: cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20
Source: https://nodejs.org/dist/v22.23.4/SHASUMS256.txt
```

Do not mistake this candidate record for a complete installation manifest. Python distribution/wheel locks, model archive digests/extraction policy and license bundle still need concrete verification before a managed setup can be implemented safely.

## Remaining delivery

W2–W9 remain: typed installation config/manifests, managed bootstrap/BAT launcher, verified dependency/model provisioning, persistent installation/account migration and process supervision, explicit speech-worker recovery, local-setup/cloud UI, clean-machine/offline test matrix and release docs. `Run HomeAuto.bat` does not exist yet. No GitHub push, Vercel deployment, live gateway/broker/device call, firmware change or physical acceptance occurred in this implementation checkpoint.
