# Local voice timeout repair — 2026-11-15

Later follow-up: [offline scoped assistant](OFFLINE_SCOPED_ASSISTANT.md) adds bilingual dialogue and verified persistent fixed-reply audio. Its live check also exposed a separate long-Hindi synthesis timeout; TTS now has a 60s worker /65s browser bound. That supersedes the older TTS30s statements in this dated report. Recognition remains local and bounded, with no cloud Live API.

Implemented and verified in isolated local simulation. Full-context recognition still takes tens of seconds on this laptop; this repair prevents the measured work from being cut off at the old deadline and makes processing/recovery visible. It does not claim low-latency or universal accent acceptance.

## User story and confirmed failure

Start voice → browser microphone/automatic endpoint → authenticated PCM WebSocket → local recognition → deterministic interpretation → simulated execution or physical-profile review → matching-language spoken reply. The reported error was `SPEECH_TIMEOUT`, not proof of microphone failure.

The original native job ended after 30 seconds and the browser after 35. A synthetic diagnostic traced about 32 seconds in the medium model's encoder alone and about 41 seconds for a complete 1.3-second recording under the observed laptop load. A clean-server reproduction also exceeded 30 seconds. The i5-12450H/16 GB development laptop has integrated graphics; available memory varied substantially during testing. These are observations under current load, not a controlled hardware benchmark.

Implementation references: [pinned faster-whisper 1.2.1 source](https://github.com/SYSTRAN/faster-whisper/blob/v1.2.1/faster_whisper/transcribe.py) and [CTranslate2 Whisper API](https://opennmt.net/CTranslate2/python/ctranslate2.models.Whisper.html). Local traces, rather than upstream benchmark numbers, determine the deadline used here.

The pinned faster-whisper implementation performed separate encoder passes for automatic language detection and decoding. Windows additionally runs the virtual-environment Python launcher and an interpreter descendant: killing only the launcher can leave inference consuming resources during a retry.

## Implemented behavior

- Keep the pinned multilingual **Whisper medium CPU INT8** profile and Kokoro English/Hindi output. No smaller model or shorter encoder context is active.
- Reuse the encoder output only when feature tensors are exactly equal within the same request. The pinned 1.2.1 detection adapter aligns the final 10 ms padding boundary with decoding. Restore the original methods and clear the cache after every request, including failure. No feature cache crosses users or utterances.
- Retain the full model context and beam size 5. Disable timestamp decoding, cap generation at 64 tokens, and reject the complete output at the conservative 56-token margin. Never execute a generated prefix whose missing tail could contain a negation.
- Reject requests with more than 12 seconds of VAD-retained audio, including speech padding. Automatic mode rejects these before language encoding; explicit languages reject before text decoding. Capture still permits 20 seconds including pauses. No command is sent for this error, and no sensitive input is saved.
- Give genuine CPU recognition a **60-second** job deadline and the browser a **65-second** watchdog. TTS stays at 30 seconds. No stage notification extends either deadline, and no failed request is replayed automatically. This is a bounded capacity adjustment based on measured timing, not a claim of fast inference.
- Send request-scoped `voice_progress` stages through the authenticated voice socket. Show recording checks, local recognition and text generation in English/Hindi. Ignore progress from old utterances or retired capture generations. Keep cancellation available and label the disabled microphone as processing.
- Stop an owned Windows worker's process tree on failure, timeout, retry and shutdown. Use the owned live ChildProcess handle rather than accepting a PID from an API request. Keep the process-handle fallback for other platforms or a failed Windows cleanup.
- Owner diagnostics expose only coarse phase, audio duration, processing time, encoder counts and error code. No recording or transcript enters these metrics. A progress callback cannot settle the job, release its busy lock, or break completion if its observer disconnects.
- Correct the Cancel button's text, border and keyboard focus colors on the dark assistant panel using existing semantic theme tokens. Layout, navigation, all four themes and simulation isolation remain intact.

Cancellation stops capture and discards the result. Recognition already in progress may occupy the shared speech worker until it finishes or reaches its deadline; cancellation cannot undo an already published action. No physical-device authorization rules changed.

## Rejected experiments and retained failures

Evidence root: `D:/homeauto-audit-tools/voice-performance-20261115`.

- Encoder reuse alone improved an earlier short synthetic A/B comparison from about 18 seconds to 10 seconds, but subsequent 30-second jobs still timed out. Those failed runs are retained in `stress`, `stress-greedy`, `live-stress-results.json` and the corresponding logs. Startup failure in one stress fixture is not counted as a recognition pass.
- Rhasspy's pinned multilingual small INT8 candidate downloaded and passed its hashes, but misheard explicit targets in English and Hindi. It is not activated, advertised or selected by the application. The candidate files remain ignored local evaluation data. One initial diagnostic stopped because its console lacked UTF-8; its partial output is not a complete acceptance run.
- Shorter encoder windows reduced latency but changed the Hindi room-one transcript to a merged word that the strict parser correctly refused. A ten-second-window full acceptance attempt also timed out. These profiles, alternate beams and timestamp experiments were rejected; the active encoder retains full context. The parser was not weakened to make a benchmark pass.
- The initial browser locale test changed a server preference while UI language is a browser preference. English checks passed; the Hindi assertion failed. The harness now sets the isolated browser's language explicitly. A subsequent scanner injection was correctly blocked by the application's CSP; the scanner now runs through Playwright evaluation. Production CSP was not weakened. Failed reports remain separate.
- A matrix attempt during concurrent native-model work stalled on initial page loading after five successful cases; the report retained `HomeAuto. Loading…` and no page error. Its cause was not established. The final sixteen-case matrix ran without a concurrent native copy and passed with no network failure. The subsequent actual-model browser test separately passed with one native model copy and one Chrome instance.

## Verification

| Check | Result / evidence |
|---|---|
| Backend/security/state-machine suite | 223 passed, 0 failed/skipped — `backend-final.log` |
| Final focused worker/progress/deadline/realm checks | 31 passed — `focused-final.log` |
| Python encoder isolation, decoder admission, silence, negation and complete long-request rejection | 16 passed — `python-final.log` |
| Real Windows launcher/interpreter cleanup | Both owned test processes stopped — `worker-tree.json`; no model or device command |
| Cloud containment build | 457 traced files, 0 native hub files — `build-final.log`; no deployment |
| Native Automatic + explicit English/Hindi | 9/9 Automatic and 9/9 explicit (EN 4, HI 5); silence/noise empty; 0 commands — `recognition-full-context/results.json` |
| Browser progress/cancel and four-theme contrast | 16 cases: four themes × two UI languages × 390/1280 widths. Axe Cancel contrast passed, no horizontal overflow, cancel/stale-progress checks passed; 0 page errors, external requests or network failures — `browser-progress-final/results.json` and 16 screenshots |
| Actual native Chrome audio/control/output on localhost | English missing-target clarification sends no command; English/Hindi automatic endpointing and simulated execution; matching-language TTS playback; real worker progress delivered; blocked-autoplay player fallback. 0 page errors/external requests — `native-browser-final/results.json`, EN/HI screenshots; process exited 0 and both workers were retired |
| 20-second capture with pauses / light noise | English recognized correctly in 26.3s; Hindi with deterministic light noise in 34.8s — `native-browser-final/stress/results.json`; no extra commands |
| Long speech with negative tail | Whole request rejected in 298ms, 0 encoder passes, empty candidates, 0 extra commands — same stress report |
| Source/publication candidates | 118 JS/CJS syntax checks, 269 tracked/untracked source candidates, no publication issues — `source-final.log` |
| Restarted localhost:3001 service | Simulation true; Whisper/Kokoro both ready/active; Automatic input/reply and spoken replies enabled. Actual protected voice-ticket → WebSocket ready → Cancel handshake passed without audio or commands — `live-preview-final.json`. Final whitespace/publication checks passed. |

The final native corpus took about 33.1–44.8 seconds in Automatic mode; explicit-language results ranged about 26.6–43.9 seconds. This is slower than earlier observations and deliberately reported rather than hidden. Capture, endpoint silence and synthesis add time. A separate actual Chrome observation completed a 5.7-second capture in about 46 seconds of backend processing. Those jobs exceeded the old 30-second budget and completed within the new one. Longer real-world requests or greater CPU/memory pressure can still fail at the bounded deadline.

The restarted preview is served at `http://localhost:3001/assistant`. Reload once for the new frontend/preview session. Automatic input/reply languages and spoken replies are enabled in the simulator; existing browser theme, accessibility and wake preferences are preserved. If the wake phrase is enabled, begin with Shrimaan. Use an explicit target such as “Turn on light two” or “लाइट दो चालू करो”; an unspecified light produces clarification instead of a guessed action. Live final readiness is recorded separately in `live-preview-final.json`.

The native corpus and microphone substitutes are synthetic Kokoro clips, not held-out human speech. Do not infer personal Chrome microphone acceptance, accent accuracy or physical ESP32 commissioning from them. Real devices, MQTT topics, firmware, cloud databases, online deployment and Git publication are unchanged. The installer and remote website-to-hub audio relay remain separate unfinished work.
