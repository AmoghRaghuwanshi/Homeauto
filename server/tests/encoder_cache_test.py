import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec = importlib.util.spec_from_file_location('encoder_cache', Path(__file__).resolve().parents[1] / 'voice' / 'encoder_cache.py')
cache_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cache_module)


class FakeModel:
    def __init__(self):
        self.calls = 0
        self.detected_features = None

    def encode(self, features):
        self.calls += 1
        return object()

    def detect_language(self, **kwargs):
        self.detected_features = kwargs.get('features')
        if self.detected_features is not None:
            self.encode(np.pad(self.detected_features, ((0, 0), (0, 3000 - self.detected_features.shape[-1]))))
        return ('hi', 0.9, [('hi', 0.9)])


class ExactEncoderReuse(unittest.TestCase):
    def test_long_auto_speech_is_rejected_before_any_encoder_pass(self):
        model = FakeModel()
        with self.assertRaises(cache_module.SpeechLimitReached) as error:
            with cache_module.reuse_encoder(model, max_speech_frames=1200):
                model.detect_language(features=np.ones((2, 1501)))
        self.assertEqual(error.exception.frames, 1500)
        self.assertEqual(model.calls, 0)

    def test_only_identical_features_reuse_output(self):
        model = FakeModel(); cache = cache_module.EncoderCache(model.encode)
        features = np.ones((2, 4), dtype=np.float32)
        first = cache(features)
        self.assertIs(cache(features.copy()), first)
        changed = features.copy(); changed[0, -1] = 2
        self.assertIsNot(cache(changed), first)
        self.assertEqual((cache.passes, cache.hits), (2, 1))

    def test_input_mutation_does_not_mutate_the_cache(self):
        model = FakeModel(); cache = cache_module.EncoderCache(model.encode)
        features = np.ones((2, 4), dtype=np.float32); first = cache(features)
        features[0, 0] = 2
        self.assertIsNot(cache(features), first)

    def test_detection_and_decoder_use_the_same_padding_boundary(self):
        model = FakeModel(); features = np.ones((2, 5), dtype=np.float32)
        with cache_module.reuse_encoder(model) as cache:
            self.assertEqual(model.detect_language(features=features)[0], 'hi')
            model.encode(np.pad(features[..., :-1], ((0, 0), (0, 2996))))
            self.assertEqual((cache.passes, cache.hits), (1, 1))
        self.assertIsNone(cache.features); self.assertIsNone(cache.output)

    def test_exception_restores_methods_and_no_cache_crosses_requests(self):
        model = FakeModel(); encode, detect = model.encode, model.detect_language
        features = np.ones((2, 4), dtype=np.float32)
        with self.assertRaises(ValueError):
            with cache_module.reuse_encoder(model) as cache:
                model.encode(features); raise ValueError('decoder failed')
        self.assertEqual(model.encode, encode); self.assertEqual(model.detect_language, detect)
        self.assertIsNone(cache.features); self.assertIsNone(cache.output)
        with cache_module.reuse_encoder(model) as second:
            model.encode(features); self.assertEqual(second.passes, 1)
        self.assertEqual(model.calls, 2)

    def test_audio_and_multisegment_detection_are_not_rewritten(self):
        model = FakeModel(); features = np.ones((2, 5), dtype=np.float32)
        with cache_module.reuse_encoder(model):
            model.detect_language(features=features, audio=np.ones(3200))
            self.assertEqual(model.detected_features.shape[-1], 5)
            model.detect_language(features=features, language_detection_segments=2)
            self.assertEqual(model.detected_features.shape[-1], 5)


if __name__ == '__main__':
    unittest.main()
