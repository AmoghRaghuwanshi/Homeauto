# Local listening model replacement — 2026-11-14

Later follow-up 2026-11-15: [voice timeout repair](VOICE_TIMEOUT_REPAIR.md) supersedes the 30/35-second bounds and timing expectations below. The active model remains full-context medium; a smaller model and shortened context were rejected after recognition regressions. New native acceptance and browser evidence are recorded in that report.

Follow-up 2026-11-15: [startup/foreground/retry repair](SPEECH_STARTUP_REPAIR.md) adds truthful loading/failure states and explicit protected recovery. That report contains newer test results and the personal-Chrome automation limitation; the model acceptance below remains dated evidence.

Status: **installed, tested and active on this development laptop**. This report supersedes the active Vosk choice in earlier planning documents. Historical tests and model comparisons remain historical evidence. The local simulation is running at http://localhost:3001/assistant; reload to load the current frontend.

## Decision and scope

The user's actual listening experience was unsatisfactory despite passing synthetic demo checks. Replace the small Vosk English/Hindi recognizers with multilingual Whisper medium through faster-whisper, running CPU INT8 on the hub. This development laptop has an i5-12450H, about 16 GB RAM and Intel integrated graphics. No GPU or cloud speech service is required. This is a candidate chosen for local evaluation; a model name or successful installation does not establish human recognition accuracy.

Spoken output remains the installed Kokoro English/Hindi model because the user clarified that listening is the problem. Simulation remains isolated from physical devices. Automatic input/reply language, microphone auto-stop, spoken clarification and explicit review for physical-profile controls remain in place. Remote website-to-hub audio relay and the general Windows bootstrap remain separate unfinished work.

Primary references:

- [faster-whisper implementation and CPU INT8 usage](https://github.com/SYSTRAN/faster-whisper)
- [SYSTRAN multilingual Whisper medium conversion](https://huggingface.co/Systran/faster-whisper-medium)
- [Original Whisper models and limitations](https://github.com/openai/whisper)

The model is the multilingual `medium` conversion, not `medium.en` or an English-only distilled model. Its pinned revision, byte counts and SHA-256 values are in `server/voice/whisper-manifest.json`. The 1,527,906,378-byte model file is publisher FP16 storage; inference uses INT8. File size is not peak runtime RAM.

## Implementation

- `whisper-worker.py` is a resident Python worker behind the existing bounded speech-service contract. Only PCM and language cross its stdin; it receives no broker/database/cloud credentials. CPU inference uses local files only, with offline environment flags.
- Automatic recognition detects language; synthesis follows the recognized English/Hindi language. An unsupported detected language yields no executable candidate. Explicit English/Hindi selection is still available.
- Built-in voice activity filtering and a low-energy guard reject silence. Decoding has no command prompt, no previous-utterance conditioning and no translation task. Low-confidence, unsupported-language and oversized results are rejected. These checks reduce failure modes; they do not guarantee that a model cannot hallucinate or omit a negation.
- Existing deterministic intent parsing, missing-target clarification, negation/conflict checks and physical command review remain downstream. No fuzzy target correction or blind English homophone replacement was introduced.
- Confirmed parser defects were repaired independently: Hindi light plurals, the spellings `बन्द` and `लाईट`, inflected `कमरे` and explicit numerals such as `रूम वन`. The native corpus also exposed `कम्रा` and `लाईटे`; these have explicit noun mappings. Regression tests retain negation, exclusions, future qualifiers and missing-target rejection. Unknown words and missing device numbers are not guessed.
- Active model metadata and Settings now identify Whisper. The legacy Vosk activation ID is rejected. Spoken reply assets remain unchanged.
- `provision-stt.py` is an explicit setup operation. It downloads only pinned files, checks bounded range responses and the complete SHA-256, then atomically commits each file. Runtime never invokes the downloader. `download-models.js` now delegates to this provisioner.

## Reproduce setup on Windows

From the repository root, with an installed compatible 64-bit Python and Node 22:

```powershell
python -m venv .local/stt-venv
& .local/stt-venv/Scripts/python.exe -m pip install -r server/voice/requirements-stt-lock.txt
node server/voice/download-models.js
```

The lock records the exact Python packages installed on this Windows/Python 3.14 development host. It is not clean-machine certification for every Python/OS version. Model setup initially needs internet. Subsequent recognition uses local files. English/Hindi spoken output additionally requires the existing Kokoro environment/assets; this command does not install TTS or implement the pending all-in-one launcher.

Defaults: `.local/stt-venv/Scripts/python.exe` and `.local/speech-assets/whisper-medium`. Optional local-only overrides: `HOMEAUTO_STT_PYTHON`, `HOMEAUTO_STT_MODEL_DIR`. Neither belongs in browser/Vercel public variables. The configured model directory must match the pinned profile; there is no automatic silent fallback to the old models.

## Evidence and acceptance

Evidence directory: `D:/homeauto-audit-tools/whisper-upgrade-20261114`.

The initial single-stream download reset after about 107 MB and was not treated as an installation. The bounded part downloader retried and verified the final model. Never report a `.part` file as an installed model.

The first native load failed because my initial manifest omitted the required `vocabulary.txt`. The actual decoder error was `Cannot load the vocabulary from the model directory`. Its pinned bytes/digest were added; the provisioner subsequently verified all five files. The failed readiness run is retained as `recognition-initial-failed.{json,log}`. A comparison harness initially also selected the silence/noise rows as language cases and tried an undefined fixture filename; the filter was corrected. That harness failure is retained separately. Neither failure was counted as a pass.

| Final check | Observed result | Evidence |
|---|---|---|
| Full backend/security/storage/coordinator suite after replacement and retirement | **205 passed, 0 failed/skipped** | `backend-accepted.log` |
| Python decoder admission/silence/negation tests | **7 passed** | `python-tests.log` |
| Focused replacement/configuration/asset/grammar tests | **4 passed** | `focused-final.log` |
| Final native recognition, Automatic | **9/9 expected semantic outcomes** | `recognition-final/results.json` |
| Final native recognition, explicit language | **9/9**: English 4/4, Hindi 5/5 | Same report |
| Native silence and deterministic noise | Empty candidates; no command | Same report |
| Actual Chrome mobile demo voice | Ambiguous target speaks clarification with 0 commands; English/Hindi auto-stop and simulated control; matching-language TTS playback; blocked-autoplay player fallback | `browser-demo/results.json` |
| Actual Chrome physical-profile flow with fake publisher | Passive mic; capture/review/Cancel with 0 commands; confirm/report; authenticated WAV/playback/Stop; 0 page errors/external requests | `browser-review-results.json` |
| UI/navigation/preferences/mobile accessibility regression | **30 groups passed**, 0 page errors | `ux.log` |
| Cloud build containment | **457 traced files, 0 native hub files** | `build-accepted.log` |
| Source syntax/publication/secret checks | 112 JS/CJS syntax checks and 259 then-current candidates passed; redacted changed/new-text Gitleaks scan found no leaks | Execution transcript |
| Live restarted preview | Whisper and Kokoro ready/active; simulation true; Automatic input/reply; spoken replies true; old project model folders absent | `live-preview.json` |

The nine clips are the exact earlier synthetic Kokoro corpus, not a held-out human test set. They include room/device/all-light controls and two negative door commands. Final acceptance includes both retaining the intended control target and refusing negative controls. The recognition harness sends **zero device commands**. Installed Chrome uses the documented external launch fallback; the audio source is synthetic, while the browser AudioContext/AudioWorklet, authorized WebSocket, actual native models and playback pipeline are real.

For a same-parser comparison, the retired Vosk models achieved **5/9** semantic outcomes with the known language selected (`vosk-comparison.json`). Whisper initially achieved **7/9** in both Automatic and explicit modes before the explicit Hindi spelling mappings above (`recognition/results.json`). The final run achieved 9/9 in each mode. This is a small command-set integration comparison, **not word error rate or general recognition accuracy**. Both model improvements and parser corrections contribute; the raw transcripts and earlier failures remain visible.

Final Automatic inference ranged approximately **9.9–13.5 seconds** per clip; explicit-language recognition approximately **6.3–7.4 seconds** on this CPU. Browser capture, endpoint silence and synthesis add time. A separate observation during the first native run showed the STT interpreter at about 1.0–1.3 GB working set, peaking near 1.8 GB; this excludes Node, TTS and browser memory and is not a clean-system RAM benchmark. The 30-second speech job and 35-second browser processing limits were retained, not extended to hide stalls. Other audio lengths, noise and CPU load may take longer or fail at those bounds.

## Retired files and limitations

The two Vosk model directories, 14 files each, were removed from `server/voice/models` and archived at `D:/homeauto-audit-tools/whisper-upgrade-20261114/retired-vosk/{en,hi}`. Permanent deletion commands were rejected by automatic execution review (`blocked by policy`, no further reason returned). The reversible archive completed successfully. The interrupted download was also moved outside the project. No old Vosk model is loaded or offered by the active service; old baseline source/dependency/provenance records remain for history. This is retirement from the installation, not a claim of permanent disk erasure.

The final UI/backend/build checks passed after the old model folders were absent. The restarted local preview verifies the replacement assets without them. No physical MQTT/device command, firmware modification, live database mutation, deployment or Git push was performed.

Synthetic English/Hindi audio is useful regression evidence, not proof of human Indian-accent quality. The user's real microphone, room noise, pronunciation and personal Chrome profile still need direct acceptance. Whisper can make transcription mistakes; a passing small set cannot guarantee preservation of every negation or number. Existing physical-profile review and device/security policy remain required. Broad conversation, Raspberry Pi performance, clean-machine installation, the all-in-one launcher and remote website-to-hub audio relay are not established by these tests.
