# English/Hindi local demo voice repair

## Latest: Chrome lifecycle and Hindi reply language — 2026-11-14

User reports success in the in-app browser but regular Chrome stuck at Understanding, using a localhost address, with Hindi input returning English. The personal Chrome profile could not be inspected: computer-use initialization failed with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. No personal browser data or permission settings were accessed. Do not claim the exact personal-profile failure was reproduced.

Confirmed source defects and repairs:

- After capture ends, VoiceCapture now has a35-second response deadline. An open socket without a result cannot remain processing forever. This is slightly above the server's existing30-second inference limit.
- Hiding the page cancels microphone permission/listening with an explanatory result rather than leaving old Understanding text. Once capture has ended, backgrounding no longer discards processing; the response may finish and its audio is retained for manual playback when visible. Hidden pages do not start new playback. Explicit cancellation still retires a processing request. Track cleanup and no-replay behavior remain.
- Local HTML/application modules use no-store headers. This prevents future loads retaining stale app/worklet code, but is not proof caching caused this user's failure.
- The recognized speech language is forwarded into the stored assistant intent and Automatic reply selection. Typed Hindi containing English device/room names now chooses Hindi instead of treating mixed script as English.
- Visible command results and assistant errors follow the conversation reply language, independently from interface language. Spoken clarification language is retained when a target-ambiguous candidate has a known decoder language.
- A saved Require Shrimaan setting now has a visible Assistant hint and a specific, spoken WAKE_PHRASE_REQUIRED error instead of generic recognition failure. Browser/origin-specific local storage can differ; the user's actual wake preference was not inspected or silently reset.

Regression tests cover missing result watchdog, hidden-page cancellation, Hindi with an English room name, model-language provenance, Hindi command-result text with an English UI, static no-store headers and wake-phrase failure. All tests use simulated effects.

Native browser evidence: `D:/homeauto-audit-tools/chrome-voice-repair-20261114/results.json` and `localhost/results.json`. Installed Google Chrome used a separate persistent profile, not the user's own profile. Both127.0.0.1 and localhost loopback fixture addresses passed Automatic recognition/control/output, spoken missing-target clarification and blocked-autoplay fallback. Hindi asserted an actual `language: hi` synthesis request and Hindi result text while interface language remained English; English asserted `language: en`.0 page errors/external requests. Microphone input is still generated synthetic speech; no human microphone or cross-accent accuracy claim.

The current local preview requires a reload after its process was restarted. Use `http://localhost:3001/assistant` consistently in regular Chrome. A live hosted site is a separate runtime and still has no remote voice relay. Full-suite200/200 pass is retained in `backend-release.log`; earlier intermediate199-test pass is retained in `backend-final.log`. After the final background-processing/playback adjustment,15 focused lifecycle/dispatch tests passed, including the actual visibility handler. Dedicated-profile browser teardown took longer than the successful functional flow; this is not a hidden claim of a clean personal-browser reproduction.

## Latest behavior: automatic endpoint and simulated dispatch — 2026-11-14

User now requires speech to finish automatically and proceed with the simulated task. This supersedes the manual demo endpoint/review behavior described below. The Assistant starts VoiceCapture in automatic mode for the demo as well as the physical profile. Existing sustained-input qualification,10-second initial wait and20-second overall bound remain; after qualified speech,18 quiet100ms frames (approximately1.8seconds) trigger processing. This is pause detection, not a semantic guarantee that a sentence is complete. Finish recording remains an optional early finish.

Clear, non-sensitive commands automatically execute only when the authoritative snapshot explicitly has `system.simulation === true`. The same recognized physical-profile control still requires review, and an absent simulation flag cannot authorize automatic dispatch. Sensitive intent denial is unchanged. Ambiguous phrases still ask for a target instead of guessing.

Processing and speech synthesis have visible progress. Failed synthesis replaces progress with an error; browser-autoplay rejection retains the actual player. Current Automatic English/Hindi native browser fixtures contain no click on Finish recording or Send request for simulation. Both simulated control/audio paths and the exact user phrase's spoken clarification passed,0 page errors/external requests. Evidence: `D:/homeauto-audit-tools/demo-auto-endpoint-20261114/results.json` and screenshots. Full194-test suite passed, build/syntax checks passed;15 focused coordinator/dispatch regressions passed after the final error-display adjustment.

The separate native physical-profile fixture uses an in-memory fake publisher, actual local Vosk/Kokoro and simulated microphone: review/Cancel(no command), confirm, owned WAV playback/Stop all passed. Its first attempt started synthetic audio during getUserMedia before the capture graph was ready and transcribed “chernoff room one lights”; that fixture was corrected to start after the real Listening indication. Original failure evidence is preserved in `physical-profile-first` in the external directory; successful fixture results remain under ignored `.local/qa/native-browser-results.json`. This is not a recording or accuracy measurement of the user's actual microphone. Wait for Listening before speaking.

All earlier investigation notes below remain historical. The current demo is automatic, not manual-finish-only.

## Latest follow-up: Automatic, spoken clarification and playback — 2026-11-14

User confirms the microphone meter moves and reports the exact phrase “Turn on the light.” There are four lights, so the missing target requires clarification. The voice service previously collapsed an intelligible but ambiguous light request into RECOGNITION_UNCLEAR. It now distinguishes INTENT_AMBIGUOUS before accepting another decoder's potentially different target. It asks Which light instead of inventing a device. Negation/conflict rejection remains. Rejected recognition returns bounded actual EN/HI transcripts through the authenticated voice socket for display; no raw recordings are stored.

Fresh voice previews now default **input Automatic, reply Automatic, spoken replies enabled**, superseding the earlier English-default choice below. New isolation tests verify simulation never calls real MQTT despite inherited physical/gateway enable flags. The real runtime remains a separate profile and never fabricates a simulator when no controller is present. `/api/runtime` now explicitly reports simulation and device transport; simulation cannot silently discover/connect a physical board.

Final follow-up verification: **190/190 tests passed**, cloud build trace passed with0 native hub files, syntax checks and diff whitespace checks passed. The30 UX and9 remediation browser groups also passed. These counts supersede the intermediate checkpoints later in this investigation history.

Speech output has a visible native audio player. A blocked automatic play attempt retains a usable manual Play control with a specific instruction. Supported recognition/target clarification errors also produce fixed approved English/Hindi speech prompts. The synthesis route permits only one owned-result/test/allowlisted-message source; it does not accept arbitrary caller text. HTTP tests verify unknown/prototype message names, multiple sources and free-form text are rejected.

Native browser harness now leaves the selector on Automatic for every case. Final evidence: `D:/homeauto-audit-tools/demo-auto-voice-20261114/final/results.json`.

- Exact user phrase “Turn on the light.” → visible/spoken Which light clarification, zero device commands.
- English room command → review, explicit confirmation, simulated observations and actual English audio playback.
- Hindi all-lights command → review, explicit confirmation, simulated observations and actual Hindi audio playback.
- Injected browser autoplay rejection → player retained with manual Play instruction.
- No page errors, no external requests. Microphone source remains synthetic; actual user accent/recording quality is not inferred from these fixtures.

Existing30 UX groups and9 remediation groups passed. Backend checkpoints:187 tests passed before adding the isolation/HTTP cases; initial fixtures needed an optional DOM lookup stub for the new player and the new HTTP prompt test needed to run after login. These fixture failures were corrected without weakening authentication or assertions. `backend-final.log` retains the HTTP-order failure; `backend-release.log` contains the final complete suite. The running preview was explicitly restarted and its API confirms simulation=true, device_transport=simulated, STT/TTS ready, both languages Automatic and spoken replies=true. Refresh the browser to retire old JS/CSRF/worklet state.

The earlier report below is retained as investigation history; English-by-default is no longer current behavior.

2026-11-14. Scope: isolated local preview with real CPU speech engines and simulated devices. The Windows installer remains a separate unfinished task.

## Reported issue and evidence

User reports microphone stopping before speech and unclear/ambiguous errors. Source review found the AudioWorklet marked any single100ms frame above RMS0.009 as speech, then ended after700ms quiet; a transient click followed by silence therefore could end recording before the user started. A separate no-speech cutoff was5seconds. These are confirmed algorithm behaviors, not a recording of the user's microphone. Automatic language decoding can also yield semantically conflicting results and intentionally rejects them; those authorization/interpretation protections remain.

## Changes

- The demo uses explicit Finish recording, with the existing20-second limit. Pauses and a click no longer close the demo microphone. Non-demo automatic capture remains available with sustained-signal qualification and a longer silence allowance.
- A live microphone meter shows actual captured RMS; the Input language selector is beside the mic. Choose English or Hindi rather than requiring a trip to Settings. Input-language changes cancel active capture. Existing Automatic remains available and does not bypass semantic disagreement/negation rejection.
- Capture qualifies sustained input across three frames, accommodates quieter audio and emits level updates. Silence receives a specific microphone message instead of being described as an understood but ambiguous command. This threshold is a provisional engineering setting, not a validated speech classifier or accent-accuracy claim.
- Starting the microphone stops current assistant playback. Existing cancel/navigation/logout resource cleanup and request review remain intact.
- Fresh voice previews default to English input and spoken replies enabled. Hindi can be selected directly; automatic reply language follows the recognized supported language. These settings are in the preview's disposable in-memory repository, not physical-runtime defaults.
- Preview heartbeats refresh its actual simulated light/door/sensor values every5seconds instead of refreshing only board health. Changed simulated values are preserved and reports do not silently age stale while someone rehearses.
- Spoken simulated command replies are concise and explicitly labeled Demo; they read fresh simulated status rather than asserting an old action remains current. Real-hardware speech qualifiers are preserved.

## Full-flow verification

Story: tap the microphone → delayed synthetic speech through real Chromium AudioContext and the production worklet → authenticated local WSS → native Vosk → review → explicit Send request → simulated command/observations → native Kokoro → authenticated audio → browser playback.

| Boundary | Result |
|---|---|
| Capture | Waited3seconds before test speech and another1.5seconds after its end. Finish recording stayed available, meter registered input. Unit tests additionally cover click +8seconds quiet, soft input, pauses, resampling and20-second cap. |
| English recognition/review | `turn off room one lights` → Light1 and2 off. No command record created before confirmation. |
| Hindi recognition/review | `सभी लाइट बंद करो` → all four lights off. No command record created before confirmation. |
| Simulated action | Records created only after Send request; observed simulated states rendered. No real MQTT/hardware action. |
| Speech output | Actual local English/Hindi synthesis, owned WAV delivery and browser playing event verified. Synthetic speech input is not human accent validation. |
| Page/network | Final native browser run:0 page errors and0 external requests. Both input languages verified on mobile390px viewport. |

Harness: `server/scripts/demo-voice-check.js`, npm script `npm --prefix server run test:demo-voice`. Requires installed speech assets/runtime and Playwright Chromium. On this Windows host the external Chrome fallback preload was used because the downloaded Chromium executable has previously encountered launch restrictions. Test fixtures store only generated synthetic audio evidence; microphone audio from the user was not recorded.

Evidence directory: `D:/homeauto-audit-tools/demo-voice-repair-20261114`. Native results and screenshots: `final/results.json`, `final/en.png`, `final/hi.png`. Initial attempt timed out awaiting speech playback; diagnostic run showed slow synthesis of verbose historical replies and then passed both languages. Concise demo speech was implemented and the final two-language run passed. Do not describe the entire investigation as error-free. The first new concise-response unit fixture lacked a fake publisher and correctly got DEVICE_UNAVAILABLE; the fixture was corrected without weakening application checks. Original failed log is retained in `backend-final.log`; final suite output is `backend-release.log`.

Existing30 UX groups and9 remediation browser groups passed with0 page errors. Full test count and build/syntax results are recorded in the current development checkpoint after the final run. Actual personal microphone behavior, varied Indian accents and native phone audio still require user/human testing. Speech models support a defined command/query grammar here, not general chat.

## Running the repaired demo

Local preview is at `http://127.0.0.1:3001/assistant` when started with `npm --prefix server run preview:isolated` under the tested Node22 environment. Use a fresh preview process for the new default preferences. Refresh the browser for updated capture code; each new recording creates a new worklet context. Select English or Hindi, tap to speak, watch the meter, speak, tap Finish recording, review and send. Use Cancel request to discard. If the meter remains flat while speaking, check the browser/OS microphone device and permission; do not assume a model upgrade fixes an absent signal.
