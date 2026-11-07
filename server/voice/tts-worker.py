"""Local, CPU-only Kokoro worker. No downloads, network endpoints, or shell input."""
import base64
import io
import json
import os
import sys
import time

def send(value):
    sys.stdout.write(json.dumps(value, ensure_ascii=False) + '\n')
    sys.stdout.flush()

try:
    import numpy as np
    import onnxruntime as ort
    import soundfile as sf
    from kokoro_onnx import Kokoro
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(os.environ['HOMEAUTO_TTS_MODEL'], sess_options=options, providers=['CPUExecutionProvider'])
    class TypedSession:
        # kokoro-onnx 0.4.7 assumes int32 speed for input_ids exports; this
        # publisher model declares float speed. Follow actual ONNX metadata.
        def __init__(self, inner):
            self.inner = inner
            self.types = {item.name: {'tensor(float)': np.float32, 'tensor(int64)': np.int64, 'tensor(int32)': np.int32}.get(item.type) for item in inner.get_inputs()}
        def __getattr__(self, key):
            return getattr(self.inner, key)
        def run(self, outputs, inputs):
            return self.inner.run(outputs, {key: np.asarray(value, dtype=self.types[key]) if self.types.get(key) else value for key, value in inputs.items()})
    engine = Kokoro.from_session(TypedSession(session), os.environ['HOMEAUTO_TTS_VOICES'])
    voices = engine.get_voices()
    supported = {'en': 'af_heart', 'hi': 'hf_alpha'}
    supported = {lang: voice for lang, voice in supported.items() if voice in voices}
    for language, voice in supported.items():
        sample, rate = engine.create('नमस्ते।' if language == 'hi' else 'Hello.', voice=voice, lang='hi' if language == 'hi' else 'en-us', speed=1.0)
        if len(sample) == 0 or not np.isfinite(sample).all():
            raise ValueError('voice probe failed')
    send({'type': 'ready', 'languages': list(supported), 'voices': supported, 'pid': os.getpid()})
except Exception:
    send({'type': 'unavailable', 'error': 'TTS_MODEL_LOAD_FAILED'})
    sys.exit(1)

for line in sys.stdin:
    try:
        if len(line) > 16384:
            raise ValueError('input too large')
        msg = json.loads(line)
        if msg.get('type') != 'synthesize' or msg.get('language') not in supported or not isinstance(msg.get('text'), str) or len(msg['text']) > 500:
            raise ValueError('invalid synthesis request')
        start = time.perf_counter()
        samples, rate = engine.create(msg['text'], voice=supported[msg['language']], speed=msg.get('rate', 1), lang='hi' if msg['language'] == 'hi' else 'en-us')
        if len(samples) > rate * 60:
            raise ValueError('audio limit')
        output = io.BytesIO()
        sf.write(output, np.asarray(samples), rate, format='WAV', subtype='PCM_16')
        send({'id': msg['id'], 'audio': base64.b64encode(output.getvalue()).decode('ascii'), 'duration_ms': (time.perf_counter() - start) * 1000, 'sample_rate': rate})
    except Exception:
        send({'id': msg.get('id') if 'msg' in locals() else None, 'error': 'SYNTHESIS_FAILED'})
