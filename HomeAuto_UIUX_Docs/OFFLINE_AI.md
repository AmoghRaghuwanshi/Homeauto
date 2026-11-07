# Shrimaan — implemented local CPU speech

Revision 4, 2026-11-05. Local inference and synthetic benchmarks were executed. Historical architecture research and primary-source links remain in history/revision-3/OFFLINE_AI.md. No model has passed a consented human accuracy/holdout gate.

## Active pipeline

A deliberate tap requests a session-bound voice ticket and microphone access. The AudioWorklet continuously resamples to signed little-endian16-bit16k mono PCM, emits100ms frames, applies simple energy VAD with700ms trailing silence/5s no-speech cutoff, and caps capture at20s. WSS accepts start/end/cancel separately from binary PCM and bounds total data at640kB. It runs Vosk locally in an isolated child process. English or Hindi may be selected; Automatic runs both and accepts one unambiguous semantic result, rejecting any conflicting/negative candidate. Models and broker credentials stay off the browser.

The deterministic parser handles explicit devices/rooms/all lights, bilingual queries, numerals and optional Shrimaan wake prefix. It rejects unknown, negative, unsupported and conflicting requests. Bare light commands ask for clarification. Typed text works independently of speech. There is no LLM, longest-transcript selection or direct model-to-MQTT path.

Recognized controls show a review dialog before sending; Cancel sends no command. Manual/text/voice/RFID execution uses the same durable command service. Unlock is never executed from voice/text; use the protected Security flow. Spoken success refers only to an observed controller report, never physical state. No reply claims a lock is physically secure or a PIR proves absence.

Kokoro ONNX CPU synthesis uses af_heart English and hf_alpha Hindi, isolated in a pinned Python environment. Local audio jobs are tied to the requesting user, expire60s and use no-store authenticated WAV endpoints. Only trusted owned result templates/test phrases can be synthesized. Stop/navigation/logout cancel playback, including delayed jobs. Startup verifies SHA256 assets and performs native model/voice probes; missing/mismatched assets disable voice while typed/manual controls remain available. One global inference job,30s timeout. Cancellation drops buffers/results; already-running pure inference can finish within that bound.

Wake phrase is optional inside the tapped utterance, never an always-on listener. Microphone does not start on page load even if permission was previously granted. Capture stops on cancel/navigation/logout/hidden page. No Web Speech API/cloud fallback or runtime download exists. Runtime audio/transcripts remain in RAM; explicitly generated synthetic test WAVs live only in ignored .local/qa.

## Measured evidence

Host: Windows, Intel Core i5-12450H, Node20.19.0, Python3.14.3, Vosk0.3.39, kokoro-onnx0.4.7, ONNX Runtime CPU provider. Both native language decoders and both TTS voices ran. Initial smoke cold readiness4.05s; English/Hindi synthesis1.62/2.22s under that load. Later hash-verified smoke timings and actual process peak working sets are in .local/qa/speech/results.json. These are short synthetic probes, not latency guarantees.

| Nine synthetic utterances | Exact intended outcomes | Accepted positive controls | p50/p95 decode including CLI startup where applicable |
|---|---|---|---|
| Vosk in Base comparison | 5/9 (includes2negative rejections) | 3/7 | 1.40/1.86s |
| Whisper Base q5_1 | 5/9 | 3/7 | 2.75/3.30s |
| Vosk in Small comparison | 5/9 | 3/7 | 3.10/4.18s |
| Whisper Small q5_1 | 5/9 | 3/7 | 11.81/13.16s |

No wrong accepted action occurred in these nine fixtures, but this sample cannot establish a zero-wrong-action safety rate. Vosk missed two/room numbers; Base emitted Urdu/mixed script for several Hindi phrases; Small recognized one Hindi number phrase but had other spelling/Hinglish failures and high latency. Host load differed between runs. The corpus uses locally synthesized voices, not Indian-accent speakers or a held-out human test set. Do not tune phonetic substitutions to these nine examples and claim generalized accuracy.

Vosk remains the measured lightweight baseline; neither Whisper variant qualifies for promotion. The browser requires review before voice actuation. Human Hindi/English/Hinglish trials and another model/profile evaluation remain release work. Synthetic Hindi all-lights control and English room control work; ambiguous Hindi room-number transcripts are deliberately rejected.

Active model assets total506,702,900bytes (~483MiB), including152,983,133bytes of the pre-existing Vosk English-US/Hindi models. Kokoro ONNX weights325,505,369bytes plus voices28,214,398bytes are local. Benchmark-only Base59,707,625bytes and Small190,085,487bytes add~238MiB; combined stored model data remains below1GB. Disk bytes are not runtime RAM. Vosk measured RSS~306MB. See the latest OS process peak measurements; Whisper peak RSS is unmeasured.

Native browser integration passes with an injected synthetic MediaStream: passive startup, capture/worklet/VAD, session WSS, native STT, review/Cancel, shared commands with simulated reports, native TTS/authenticated WAV/playback/Stop. Chromium fake-file getUserMedia returned NotSupportedError on this environment. Real microphones, denied/revoked permission and household phones remain unverified.

## Provisioning and provenance

See OPERATIONS.md. server/voice/requirements-lock.txt pins the installed Python environment; asset-manifest.json records per-file hashes/bytes and official Kokoro release source. The Vosk hash inventory records the existing baseline. Whisper CLI is official release b5454 CPU Windows and models from ggerganov/whisper.cpp; local .local/whisper/manifest.json records hashes/provenance. Whisper is benchmark-only and uses deleted temporary synthetic WAV files because the Windows CLI stdin path yielded empty output. Runtime Vosk capture never uses temporary audio files.

The kokoro-onnx adapter expects an int32 speed tensor for some exports; this publisher model declares float. The worker wrapper casts inputs using actual ONNX input metadata and both language probes succeed. No installed dependency source was patched. Workers receive filtered environments and do not download files.

Licensing: Vosk/its selected distributions and Kokoro weights carry Apache-2.0 notices; kokoro-onnx, ONNX Runtime and whisper.cpp use their upstream notices; eSpeak NG has GPL source obligations. Preserve actual per-model/voice distribution notices. A redistribution-ready license/source bundle and voice auditions are pending. No real person's voice was cloned. NOTICE.txt is a local inventory, not a blanket redistribution clearance.

Next gate: collect consented human recordings with separate tune/holdout partitions, noise/no-speech/negation/target confusion cases, elderly/Indian-accent/Hinglish coverage; measure rejection, false actions, semantic accuracy, p50/p95, CPU and peak RAM on the target hub. Review both languages and names with native speakers, then select/promote a profile using the preserved acceptance matrix.
