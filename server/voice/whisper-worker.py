"""Resident CPU-only multilingual Whisper worker; local files, no network or audio logs."""
import base64
import json
import os
import sys
import time
from encoder_cache import reuse_encoder, SpeechLimitReached


def send(value):
    sys.stdout.write(json.dumps(value, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def transcribe(model, msg, progress=None):
    import numpy as np

    if msg.get("type") != "transcribe" or msg.get("language") not in ("auto", "en", "hi"):
        raise ValueError("invalid request")
    pcm = base64.b64decode(msg["pcm"], validate=True)
    if not 6400 <= len(pcm) <= 640000 or len(pcm) % 2:
        raise ValueError("invalid audio")
    if progress: progress('preparing')
    audio = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
    start = time.perf_counter()
    limit_reached = False
    passes, reuses = 0, 0
    speech_ms = 0
    language = None
    # Never supply a command as a prompt: hear the target/action rather than infer it.
    if float(np.sqrt(np.mean(audio * audio))) < 0.001:
        candidates = []
    else:
        with reuse_encoder(model, progress, max_speech_frames=1200) as cache:
            info = None
            try:
                segments, info = model.transcribe(
                    audio, language=None if msg["language"] == "auto" else msg["language"],
                    task="transcribe", beam_size=5, temperature=0.0,
                    condition_on_previous_text=False, vad_filter=True,
                    vad_parameters={"min_silence_duration_ms": 500, "speech_pad_ms": 200},
                    without_timestamps=True, max_new_tokens=64,
                )
            except SpeechLimitReached as error:
                speech_ms = error.frames * 10
            if info is not None:
                speech_ms = info.duration_after_vad * 1000
                language = info.language if info.language in ('en', 'hi') else None
            # The command interface accepts one short request, not dictation.
            # Reject the complete long request rather than decode a costly or
            # potentially misleading prefix. Recording still allows 20 s with pauses.
            limit_reached = speech_ms > 12000
            if progress: progress('decoding')
            decoded = [] if limit_reached else list(segments)
        passes, reuses = cache.passes, cache.hits
        text = " ".join(segment.text.strip() for segment in decoded).strip()
        # Never interpret a token-limited prefix: its missing tail could contain
        # a negation or another target. Leave a conservative special-token margin.
        limit_reached = limit_reached or any(len(segment.tokens) >= 56 for segment in decoded)
        credible = decoded and all(segment.avg_logprob >= -1.0 for segment in decoded)
        # Reject unsupported language and oversized text; never truncate to an action.
        candidates = [{"lang": language, "text": text}] if not limit_reached and credible and text and len(text) <= 500 and language in ("en", "hi") else []
    return {"id": msg.get("id"), "candidates": candidates,
            "duration_ms": (time.perf_counter() - start) * 1000,
            "audio_ms": len(pcm) / 32, "speech_ms": speech_ms, "encoder_passes": passes, "encoder_reuses": reuses,
            "limit_reached": limit_reached,
            "language": language,
            "provider": "faster-whisper-medium-int8"}


def main():
    try:
        from faster_whisper import WhisperModel
        from importlib.metadata import version
        if version('faster-whisper') != '1.2.1':
            raise RuntimeError('Install the pinned speech requirements')
        model = WhisperModel(
            os.environ["HOMEAUTO_STT_MODEL"], device="cpu", compute_type="int8",
            cpu_threads=6, num_workers=1, local_files_only=True,
        )
        send({"type": "ready", "languages": ["en", "hi"], "pid": os.getpid()})
    except Exception:
        send({"type": "unavailable", "error": "STT_MODEL_LOAD_FAILED"})
        return 1
    for line in sys.stdin:
        msg = {}
        try:
            if len(line) > 860000:
                raise ValueError("input too large")
            msg = json.loads(line)
            if not isinstance(msg, dict):
                raise ValueError("invalid request")
            progress = (lambda stage: send({'id': msg.get('id'), 'type': 'progress', 'stage': stage})) if os.environ.get('HOMEAUTO_STT_PROGRESS') == '1' else None
            if progress: progress('received')
            send(transcribe(model, msg, progress))
        except Exception:
            send({"id": msg.get("id") if isinstance(msg, dict) else None, "error": "RECOGNITION_FAILED"})
    return 0


if __name__ == "__main__":
    sys.exit(main())
