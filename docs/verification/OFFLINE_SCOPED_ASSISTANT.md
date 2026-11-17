> Current voice update, 2026-11-15: [browser conversation implementation](../verification/BROWSER_VOICE_ASSISTANT.md). The user has replaced native speech with browser Web Speech recognition/synthesis and authenticated final-text WebSocket validation. No HomeAuto speech models or Python workers load. Downloaded assets/environments were moved outside the project into a recoverable archive; old native instructions and measurements below are historical. Start conversation alternates listening and speech with a 350ms quiet buffer. Browser recognition may require internet, and Automatic listening follows the app language rather than promising portable bilingual detection. Device execution, authentication and physical confirmation rules remain on the hub.

# Offline scoped assistant — 2026-11-15

## Delivered behavior

The local assistant now handles English/Hindi greetings, identity, wellbeing, help, capabilities, thanks and goodbye, alongside existing home commands and queries. Clear out-of-scope speech reaches a spoken capability reply instead of being rejected just because it is not a device command. Examples:

- English: “I can't help with that request yet. I can turn lights on or off, lock the door and check device status.”
- Hindi: “मैं फिलहाल यह काम नहीं कर सकता। मैं लाइट चालू या बंद कर सकता हूँ, दरवाज़ा लॉक कर सकता हूँ और उपकरणों की स्थिति बता सकता हूँ।”

Capability lists reflect the caller's current permissions, configured devices and whether door control is enabled. Viewers are offered status checks, not control authority. Unlocking and access-card management remain on the Security screen. Malformed home commands, negation, unknown targets, conflicting actions and unsupported qualifiers never become inferred device actions.

This is a small **rule-based bilingual NLP layer**, not a newly trained speech model or a general knowledge LLM. No cloud inference or Live API was added. Unknown questions receive scope guidance; the assistant does not invent factual answers. Broad free-form paraphrase understanding and open-domain conversation are not claimed.

## Local pipeline and language

Browser microphone → existing authenticated local `/voice` WebSocket → resident Whisper medium CPU INT8 → strict command parser or dialogue classifier → session-bound intent → protected execute API → Kokoro speech job → authenticated WAV playback. Input is streamed in bounded chunks; recognition still runs after the existing automatic endpoint. WebSocket itself is transport and does not improve recognition accuracy or compute speed.

Existing Automatic input/reply defaults remain. New local preference defaults enable spoken replies; explicitly saved choices are preserved. Typed Hindi follows its script in Automatic mode, and recognized English/Hindi selects the spoken reply language. Explicit input-language choices now reach the interpreter. Fixed failure prompts include language-specific guidance for unsupported requests, unknown targets, negated/conflicting requests and Security confirmation. A final live check exposed a long Hindi help reply exceeding the old 30-second synthesis bound. STT and TTS now each have a 60-second native job bound, with 65-second browser response/poll bounds. Queued audio jobs survive up to 90 seconds and keep their full 60-second playback lifetime after completion.

The installed output voices remain Kokoro `af_heart` for English and `hf_alpha` for Hindi. Both produced playable native WAVs in this run. They were not replaced with untested voices, and no claim of a universally “best” voice or perfect accent coverage is made.

## Command and state preservation

- Supported requests include explicit device/room/all-light controls, permitted door locking, current status and sensor queries. Recognized polite wrappers and room prepositions are accepted without guessing a target. Temporal qualifiers, cross-room/numeric conflicts and relations between device numbers still fail closed.
- Sensor answers use controller data and label gas values as estimates. Unavailable reports do not become success. Physical-profile door status states that lock position is not sensed. Simulation replies remain labeled.
- Conversation intents have empty device lists and read permission. They retain the existing session ownership, expiry and idempotency rules. The browser does not show a device-confirmation modal for a read-only conversation reply; actual physical controls retain review and sensitive denial.
- Starting a new voice turn retires the old conversation generation. Typing cancels capture and retires playback before interpreting the new turn. Old command tracking cannot overwrite a new conversation; already published device actions are not undone.
- Fixed dialogue/error audio can be reused from bounded RAM and local disk caches keyed by exact reply, language, rate, voice metadata and verified model/worker fingerprint. Each cache is limited to 16 audio entries / 8 MiB. RAM clears on TTS failure/shutdown; verified fixed audio survives service restarts in `.local/speech-cache`. Files use SHA-256 names, byte counts and content hashes with atomic writes; corrupt or mismatched entries become cache misses. Every audio job still has its own owner and expiry. Device commands, microphone recordings, device names/readings and action confirmations are not written to this cache. QA previews disable persistent caching by default.

## Verification and timing

Evidence: `D:/homeauto-audit-tools/offline-dialogue-20261115`.

| Check | Evidence |
|---|---|
| Full backend suite | 238 passed, 0 failed/skipped — `backend-final-cache.log` |
| Final focused command, dialogue, session, HTTP, capture ownership and policy checks | 102 passed — `focused-complete.log` |
| Native browser speech | Six typed English/Hindi cases; real local recognizer and Kokoro for two synthetic out-of-scope recordings; matching-language output and actual playback; 0 commands/page errors/external requests — `browser-native/results.json` |
| Native first-answer timings | English: 9.6s recognition, 21.5s from Start voice to playback. Hindi: 13.2s recognition, 28.5s total. Includes synthetic capture delay, endpoint silence and synthesis; not a human benchmark |
| Fixed reply cache | Repeating the typed request began cached playback in 156ms English / 130ms Hindi. A new spoken request still incurs recognition time. Cache results do not establish subsecond new voice interaction |
| Mocked browser protocol | Six typed cases, English/Hindi WebSocket→dialogue→playback and cache reuse; physical-profile read-only reply without confirmation; 0 hardware commands — `browser-mock/results.json` |
| Responsive scoped replies | 16 captures: four themes × English/Hindi × 320/1280 widths; keyboard Enter submits, no horizontal overflow or unwanted device dialog — `browser-layout-final/results.json` |
| Existing navigation/accessibility regression | All 30 groups passed, 0 page errors — `ux-final.log` |
| Cloud containment | 457 traced files, 0 native hub files — `build-final.log`; no deployment |
| Source and publication checks | 275 publication candidates inspected, 123 JavaScript syntax checks, 0 issues — `source-final.json`; tracked-file publication verifier also passed (`publication-final.log`), and `git diff --check` passed |
| Persistent-cache and long-output focused tests | 18 passed — `cache-and-output-final.log`; restart reuse, profile invalidation, corruption, size limits, job ownership, post-generation expiry and browser playback after a simulated 40-second generation |
| Live long Hindi synthesis | The initial live probe failed at the old 30-second bound (`live-preview-final.log`). With the corrected bound, the same help reply completed in 34.8s; all six English/Hindi greeting/help/scope WAVs generated successfully — `live-cold-prepared.json` |
| Actual service restart | All six prepared replies returned `duration_ms:0` after restarting both native workers; protected API calls returned valid WAVs in 23–59ms, with no hardware commands — `live-after-restart.json` |
| Actual cached Chrome playback | English/Hindi capability replies played after the real restart, starting in 333ms/61ms; 0 page errors/external requests — `live-browser-cache.json` and two screenshots |

The final runtime probe returned `mode: local`, `transport: websocket`, `simulation: true` and `device_transport: simulated`. The running preview is available on port 3001; this does not establish physical-device commissioning.

The first cache unit test omitted the user row needed by a preference foreign key; the test now injects a changed preference without weakening the database. A sensor test initially reused a report across disconnect/reconnect; it now requires a new simulated report, preserving the real freshness rule. The first live Hindi help probe revealed the separate TTS deadline defect described above. All failed logs are retained and are not counted as passes. The fixed cache contains only approved non-personal replies, not test recordings or hardware confirmations.

English copy was audited with the installed Unslop 2.3.0 core/cleanup process. It produced 0 hard phrase findings and advisory soft cadence/structure findings across an inventory of independent messages. Necessary device terms and “No command was sent” were preserved. Hindi was reviewed manually, not through English scanner results. Details are in `docs/ux/UNSLOP_AUDIT.md`.

## Limits and use

Reload `http://localhost:3001/assistant` after the restarted simulator is ready. Try “Hello,” “What can you do?”, “Could you turn on light two?”, “कृपया लाइट दो चालू करो,” or an unsupported question. Use explicit targets. Start with Shrimaan when the saved wake-phrase preference requires it.

This remains tap-to-speak with automatic recording completion, not continuous full-duplex conversation. It remains slower than a cloud Live API on this laptop. The latest measurements do not erase earlier 30–45s recognition observations under other load. Only synthetic inputs and simulated devices were used; personal microphone/accent quality and physical commissioning remain unverified. The local models and assets must be installed before offline operation. No OS network disconnect was performed, so no air-gap certification is claimed.

The remote website audio relay, cloud Live APIs, general installer and physical ESP32 commissioning remain separate unfinished work. No firmware, MQTT topics, RFID rules, authentication scheme, production database, Git publication or deployment was changed in this task.
