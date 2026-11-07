# Shrimaan offline AI and voice audit

Date: 2026-11-06. Source review and safe parser/response/browser probes were executed. Native recognition/synthesis was **not rerun** during this audit; prior native artifacts were read and the installed model files were freshly verified against the local manifest.

## Actual pipeline and boundaries

| Stage | Implementation | Assessment |
|---|---|---|
| User intent to record | public/js/voice-controller.js start; POST voice ticket, then getUserMedia | Tap-only; no page-load microphone or always-listening wake system |
| Browser capture | capture-processor.js AudioWorklet | Box-filter16k resampling, mono signed16-bit PCM;100ms chunks; energy RMS threshold .009;700ms trailing silence;5s no-speech/20s total |
| Transport | realtime.js /voice | Auth+Origin, one-use session ticket, explicit start/end/cancel, <=3200-byte PCM frames, <=640,000 bytes, bounded connection/capture |
| STT | stt-worker.js | Both Vosk models loaded locally; selected language or both sequentially for Auto; recognizer freed per request |
| Candidate selection | SpeechService.transcribe | Rejects negated/conflicting candidates and differing accepted action/target sets. Not a guarantee that an accepted parse matches what the person intended. |
| Interpretation | voice/intent.js, services/assistant.js | Deterministic grammar, 30s actor/session-bound intents, explicit execute API; AUD-004 |
| Permission/execution | Home.request | Shared role/availability/persistence/idempotency policy; all assistant unlock denied |
| Review | main.js reviewVoiceIntent | Recognized controls need explicit Send request; queries may answer directly; typed controls execute after Send without this extra review |
| Report/response | Home observations and Assistant.speechText | No physical_verified=true; stale replay and partial-result problems AUD-009/AUD-012 |
| TTS | tts-worker.py | Kokoro ONNX CPU, af_heart English/hf_alpha Hindi; actual ONNX input-type adapter; local warm probes; four intra-op/one inter-op threads |
| Delivery | Owned transient speech jobs/audio endpoints | No-store WAV, user ownership,60s expiry; Stop/navigation/logout stop playback and ignore delayed jobs |

Cancellation drops browser capture and pending UI results; already-running pure native inference can finish within its limit. A single global speech job and30s timeout bound inference load. Timeout kills/disables the affected worker; there is no implemented automatic worker restart. “Check readiness” only confirms a ready profile and is disabled when unavailable. Manual/typed controls remain the fallback; do not advertise that button as recovery or dynamic model activation.

Worker environments omit broker credentials and set offline flags. No cloud speech, Web Speech recognition, browser TTS fallback, remote model URL API or runtime asset download is in the active pipeline. Audio/transcript objects are held in process memory rather than written by the runtime. The benchmark-only Whisper adapter writes temporary synthetic audio; it is not imported into the active speech service.

## Fresh verification versus earlier measurements

Fresh read-only verifyProfile checks passed for **30 installed asset files**: STT28 files/152,983,133 bytes; TTS2 files/353,719,767 bytes. Total506,702,900 bytes, approximately483MiB. Verification proves agreement with the repository manifest, not upstream authenticity of every original Vosk file. The Vosk inventory was derived from the existing baseline; Kokoro provenance is recorded in the manifest/operator documentation.

The prior .local/qa/speech/results.json records native Vosk/Kokoro execution on this Windows host: cold load about4.41s, English/Hindi synthesis about0.81s/2.11s, STT about1.52s/1.54s in that run. Hindi “कमरा एक की लाइट बंद करो” lost the room number in the recorded transcript. Prior process peak working sets were approximately91MB hub,326MB STT and525MB actual TTS Python process. These are historical per-process measurements, not freshly measured or guaranteed simultaneous RAM totals.

Prior nine-utterance synthetic comparisons gave Vosk, Whisper Base q5_1 and Small q5_1 each5/9 exact intended outcomes including two negative rejections, only3/7 accepted positive controls. Small's reported decode p50/p95 was about11.81/13.16s. These results do not establish human recognition accuracy, Indian-accent generalization, safe false-action rates or a superior replacement model. The original native browser run used an injected synthetic MediaStream after Chromium fake-file microphone capture returned NotSupportedError.

Active weights fit within approximately1GB model storage. Adding the recorded benchmark Base/Small weights still fits under1GB of model data. Python environment, Node packages, caches, OS and browser are additional disk/RAM costs. A1GB-RAM hub is not validated by these model-file sizes; CPU-only speech alongside the UI needs measurements on the actual target machine.

## Confirmed findings and safety implications

- **AUD-004, P1:** interrogatives and partially understood requests become actions. Pure probes confirmed English and Hindi status questions become controls; a future-time request becomes immediate; mixed device/room targeting is truncated. The reviewed voice dialog mitigates recognized controls, while typed requests execute directly after Send. Keep backend unlock denial and fix grammar coverage before expanding speech support.
- **AUD-009, P2:** replay reads cached query DTOs or historical command actions with present-tense wording. Revalidate or explicitly timestamp historical speech. Share careful gas/PIR wording.
- **AUD-012, P2:** partial group errors are lost when successful commands reconcile; speech only uses the first command result. Preserve all target outcomes.
- **AUD-017, P2:** Auto speech language uses interface language, overriding the backend's resolved Hindi answer. This was reproduced without synthesis.
- **AUD-019, P2:** readiness-dependent labels remain stale while the mic changes state. Missing-to-ready was reproduced without capture.

Speech recognition itself can omit a negation, number or room, or reinterpret background/assistant audio. These are unmeasured risks, not a claim of an observed dangerous hardware action. The intent parser cannot recover words the STT omitted. Review must remain explicit, display actual resolved devices/actions and not provide a direct unlock route.

The wake feature is a prefix check inside tapped speech, accepting several Shrimaan spellings. It is neither a trained always-on wake detector nor proof of speaker identity. Dual-model Auto is semantic agreement/rejection logic, not calibrated confidence scoring. The VAD threshold is simple energy gating and needs quiet/noisy/older-voice/soft-speech tests.

## Safe remediation and validation

Fix typed/parser semantics first with table-driven pure tests. Cover interrogatives, negation scope, unknown clauses, time/condition words, overlapping names, numbers and combined room/device targets in English, Hindi and Hinglish. Assert zero publication for rejected/query cases.

Then test observed versus uncertain and historical responses, partial group outcomes, automatic/explicit reply language and worker readiness transitions using deterministic mocks. Keep text controls independent of model readiness.

After software fixes, use an isolated native harness with synthetic files and fake publishers to test PCM bounds, silence, ticket expiry, start/end/cancel ordering, disconnect during inference, session revoke, worker crash, timeout, pipe errors, playback cancellation and subprocess cleanup. Preserve per-user audio ownership and no-store behavior. Do not run these against live devices.

Finally obtain consented human tune/holdout data, with Indian accents, elderly speakers, Hindi/Hinglish code switching, background TV/TTS, negation and easily confused device numbers. Measure semantic correctness, false accepted actions, rejection, p50/p95, CPU and actual worker peak RAM. Native listeners should review Hindi/English pronunciation, names and safety wording. No such human gate is complete.

Licenses/source obligations remain a release prerequisite; NOTICE.txt is an inventory, not a full redistribution bundle or legal signoff. No voice was cloned in this audit.

