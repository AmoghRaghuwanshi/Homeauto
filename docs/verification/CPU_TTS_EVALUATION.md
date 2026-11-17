# CPU-only English/Hindi output evaluation — 2026-11-16

## Scope and current decision

The user requested actual low-latency, natural-sounding English/Hindi output trials while retaining current Web Speech input. Four Piper voice candidates were downloaded and tested outside HomeAuto. This is an evaluation, not a change to the application's active provider. No app dependencies, source, database, MQTT, firmware, device controls, speech recognition or production deployment were changed in this task.

The latency requirement is promising. All four voices generated usable PCM output on this laptop's CPU, and fresh audio played in Chrome. Naturalness, pronunciation, preferred timbre and acceptability to the user remain listening acceptance gates. These checks do not establish a young/soft voice, perfect pronunciation or a natural Indian English accent. The two English candidates are explicitly US English.

Audition page: **http://127.0.0.1:3010/**. It is a separate loopback-only test server, not the HomeAuto site on port 3001. It offers saved samples and fresh synthesis for greetings, home features, numbers, mixed words/names and a safety message. The selected text is visible beside each player. It never opens a microphone or connects to devices. Stop the test with Ctrl+C in its process; restart with `D:/homeauto-audit-tools/cpu-tts-20261116/Run-Voice-Trial.cmd`.

## Environment and reproducibility

- Intel Core i5-12450H, 8 cores / 12 logical processors, 15.7 GiB installed RAM, Windows. About 3.5 GiB free physical RAM was observed during evaluation; this was an ordinary loaded development machine, not a controlled lab benchmark.
- Isolated environment: `D:/homeauto-audit-tools/cpu-tts-20261116/.venv`. Python 3.14.3, `piper-tts==1.8.0`, `onnxruntime==1.32.0`, `numpy==2.5.5`. Complete installed versions are in `requirements-evaluation-lock.txt`.
- All inference sessions explicitly use only `CPUExecutionProvider`; the runtime provider list is asserted. No GPU runtime/model service or paid API is used.
- Publisher: [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices). Repository revision pinned to `e9ab671f2a0e50a701b34361136ba3e6a3a9eb0c`. Four ONNX models are approximately 63 MB each. Model downloads verify publisher LFS SHA-256; config and model-card hashes/provenance are recorded in `model-provenance.json`.
- Installation/downloads used the internet. During benchmark and audition synthesis, Python socket connections are explicitly denied. The audition HTTP listener remains available only on 127.0.0.1. The browser test blocked and recorded external requests; there were none. This establishes local output operation, not offline Web Speech recognition.
- The Windows Store Python 3.13 launcher initially returned Access denied before creating an environment. The installed user Python 3.14 interpreter then created the isolated environment successfully. No application environment or archived native speech environment was modified.

## Measured latency

Every voice was evaluated with 1, 2 and 4 ONNX inference threads, with one first request and three repeated requests per thread setting. Four threads gave the lowest tuning median for all four voices. The selected resident model then generated six phrases three times each: **18 measured warm generations per voice, 72 total**, without a reply/audio cache. There were another 48 tuning generations. The examples cover greetings, short replies, capabilities, number words, names/mixed Hindi-English terms and safety qualifiers. Speech speed/noise settings retain the publisher defaults; no accelerated playback was used to improve latency numbers.

| Candidate | Warm engine first audio, median | Full generation, median / p95 | Chrome playback start, median / p95 |
|---|---:|---:|---:|
| Hindi Rohan medium | 96 ms | 162 / 285 ms | 313 / 412 ms |
| Hindi Pratham medium | 129 ms | 231 / 441 ms | 248 / 303 ms |
| English Ryan medium (US) | 92 ms | 181 / 346 ms | 178 / 281 ms |
| English Lessac medium (US) | 116 ms | 231 / 418 ms | 215 / 274 ms |

The engine first-audio measurement is the first available PCM sentence chunk; it is not speaker playback. Full generation is measured until all sentence chunks are produced, before the benchmark's file write. Multi-sentence replies can have much shorter first-chunk time than complete generation.

The Chrome column measures **Generate fresh audio click → local POST → complete uncached WAV → browser `playing` event**. This audition deliberately receives the complete WAV before playback; it does not claim streaming output. Each voice had six requests (greeting and safety message, three rounds), for **24 requests per browser run**. The first and final runs both passed; the table uses the final run. Their different phrase mix and browser/audio overhead explain why browser ordering differs from the six-phrase engine benchmark. P95 uses nearest rank; with only six browser samples it equals the maximum observed sample. These are small local measurements, not a universal latency guarantee or an audible speaker/hardware-loopback measurement. Recognition, endpointing, intent handling and device acknowledgement are excluded.

Selected four-thread model session loads measured approximately 472 ms (Rohan), 755 ms (Pratham), 649 ms (Ryan), and 769 ms (Lessac). They occurred after Python/package imports and earlier tuning loads, and are **not** total machine/process cold-start estimates. A deployed service should load once and stay resident, rather than reload on every reply. The four-voice trial server used approximately 513 MiB RSS after warmup. Individual benchmark process RSS ranged up to about 253–296 MiB.

## Audio and browser verification

- All 72 measured warm syntheses returned finite, non-silent, 22,050 Hz mono PCM. Reply durations ranged up to 8.44 seconds; repeated replies were synthesized anew, not replayed from a cache.
- Saved 24 WAV samples (six per voice), including both clean-language and mixed-word examples. Signal-level checks inspected peak, RMS and near-full-scale sample fraction. Maximum near-full-scale fraction was about 0.0059%; this is not a perceptual distortion or intelligibility test. No missing-phoneme warnings appeared in the four benchmark logs.
- Actual Chrome generated/received/played all 24 fresh requests in the final browser pass. There were zero page errors and zero external requests. Wrong-origin POSTs were rejected (403), unknown voices rejected (400), and missing audio returned 404.
- Audition layouts at 320, 768 and 1280 px passed horizontal-overflow checks and produced screenshots. The 320 px layout was visually inspected. A follow-up fixed the visible sample text so it changes with the selected phrase; the final browser run asserts this for the safety sample.
- No personal microphone, physical ESP32, broker, lock or real sensor was exercised. No human listening verdict is asserted. Judge Hindi consonants, names, English/Hindi code-switches, numbers, pacing and comfortable daily tone using the audition page before selecting a default.

## Voice licensing and integration boundary

Read each downloaded `*.MODEL_CARD.md`; the repository-level license is not proof that every voice permits the same uses. Pratham and Ryan model cards reference CC BY-NC-SA 4.0 dataset terms; Rohan references IIT Madras IndicTTS terms, and Lessac references its source dataset terms. [Hindi Rohan card](https://huggingface.co/rhasspy/piper-voices/blob/main/hi/hi_IN/rohan/medium/MODEL_CARD), [English Ryan card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ryan/medium/MODEL_CARD). Piper runtime is GPL-3.0; see its [official repository and licensing guidance](https://github.com/OHF-Voice/piper1-gpl). Evaluation files remain outside the application and have not been bundled or published. Distribution terms require review before packaging a chosen model into a public/commercial release.

If a voice is accepted, the next implementation should keep browser input unchanged, add an output-only persistent CPU worker, return owner-bound audio through existing protected APIs, preserve cancellation/anti-echo/language and truthful device-confirmation rules, and retain browser speech as an explicit fallback. No reason to restore old Whisper input or the slow historical Kokoro pipeline has been established by this trial.

## Evidence

All experimental source, dependencies and generated audio are in `D:/homeauto-audit-tools/cpu-tts-20261116`:

- `download_voices.py`, `model-provenance.json`, `models/*`, `requirements-evaluation-lock.txt`, `install.log`.
- `benchmark.py`, four `*-medium.json` reports/logs, `summary.json`, `audio/*.wav`.
- `trial_server.py`, `index.html`, `trial.js`, `Run-Voice-Trial.cmd`.
- `browser_check.cjs`, `browser-results-first.json`, `browser-results.json`, `auditions-320.png`, `auditions-768.png`, `auditions-1280.png`.

Final status: the audition page returned HTTP 200 and all 24 WAVs were present (`final-status.json`). Port 3001 was not listening at the final HomeAuto runtime probe; this evaluation did not start or stop HomeAuto, so no live-app availability result is claimed. Application `git diff --check` passed.

No application regression suite was rerun for this evaluation because runtime source was unchanged. The isolated synthesis and browser checks above were executed; this report does not reuse old test counts as new validation.
