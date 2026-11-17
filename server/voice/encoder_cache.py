"""Reuse one utterance's identical encoder tensors in pinned faster-whisper 1.2.1."""
from contextlib import contextmanager


class SpeechLimitReached(ValueError):
    def __init__(self, frames):
        super().__init__('Speech exceeds the command limit')
        self.frames = frames


class EncoderCache:
    def __init__(self, encode, progress=None):
        self.original = encode
        self.progress = progress
        self.features = None
        self.output = None
        self.passes = 0
        self.hits = 0

    def __call__(self, features):
        import numpy as np
        if self.features is not None and np.array_equal(self.features, features):
            self.hits += 1
            return self.output
        if self.progress: self.progress('encoding')
        output = self.original(features)
        if self.progress: self.progress('decoding')
        self.features = features.copy()
        self.output = output
        self.passes += 1
        return output

    def clear(self):
        self.features = None
        self.output = None


@contextmanager
def reuse_encoder(model, progress=None, max_speech_frames=None):
    # Model use is serialized by the worker. These adapters live for one request
    # only; audio features/encoder outputs never carry over to another utterance.
    encode, detect = model.encode, model.detect_language
    cache = EncoderCache(encode, progress)

    def detect_language(*args, **kwargs):
        features = kwargs.get('features')
        if (kwargs.get('audio') is None and features is not None
                and features.ndim == 2 and 0 < features.shape[-1] <= 2001
                and kwargs.get('language_detection_segments', 1) == 1):
            if max_speech_frames is not None and features.shape[-1] - 1 > max_speech_frames:
                raise SpeechLimitReached(features.shape[-1] - 1)
        # v1.2.1's generator excludes the final 10 ms padding frame. Apply that
        # same boundary to detection so both encoder inputs are exactly equal.
        # Accepted audio is <=20 s; never adapt arbitrary long-form input here.
        if (kwargs.get('audio') is None and features is not None
                and features.ndim == 2 and 1 < features.shape[-1] < 3000
                and kwargs.get('language_detection_segments', 1) == 1):
            kwargs = {**kwargs, 'features': features[..., :-1]}
        return detect(*args, **kwargs)

    model.encode, model.detect_language = cache, detect_language
    try:
        yield cache
    finally:
        model.encode, model.detect_language = encode, detect
        cache.clear()
