"""Decoder admission and safety tests; fake inference, no downloaded models required."""
import base64
import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

spec = importlib.util.spec_from_file_location("whisper_worker", Path(__file__).resolve().parents[1] / "voice" / "whisper-worker.py")
sys.path.insert(0, str(Path(spec.origin).parent))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class WhisperAdmission(unittest.TestCase):
    def request(self, **changes):
        return {"id": "test", "type": "transcribe", "language": "auto", "pcm": base64.b64encode(b"\x00\x10" * 3200).decode(), **changes}

    def engine(self, text="लाइट दो चालू करो।", language="hi", confidence=-0.3):
        engine = Mock()
        engine.transcribe.return_value = (iter([SimpleNamespace(text=text, avg_logprob=confidence, tokens=[1, 2, 3])]), SimpleNamespace(language=language, duration_after_vad=1))
        return engine

    def test_auto_transcribes_original_language_without_command_prompts(self):
        engine = self.engine()
        result = worker.transcribe(engine, self.request())
        self.assertEqual(result["candidates"], [{"lang": "hi", "text": "लाइट दो चालू करो।"}])
        options = engine.transcribe.call_args.kwargs
        self.assertIsNone(options["language"])
        self.assertEqual(options["task"], "transcribe")
        self.assertFalse(options["condition_on_previous_text"])
        self.assertNotIn("initial_prompt", options)
        self.assertTrue(options["vad_filter"])
        self.assertTrue(options["without_timestamps"])
        self.assertEqual(options['beam_size'], 5)
        self.assertEqual(options['max_new_tokens'], 64)

    def test_manual_language_is_respected(self):
        engine = self.engine("Turn off light two.", "en")
        worker.transcribe(engine, self.request(language="en"))
        self.assertEqual(engine.transcribe.call_args.kwargs["language"], "en")

    def test_silence_does_not_generate_a_command(self):
        engine = Mock()
        result = worker.transcribe(engine, self.request(pcm=base64.b64encode(bytes(6400)).decode()))
        self.assertEqual(result["candidates"], [])
        engine.transcribe.assert_not_called()

    def test_invalid_audio_never_reaches_decoder(self):
        for pcm in (b"a", bytes(6398), bytes(640002)):
            engine = Mock()
            with self.assertRaises(ValueError):
                worker.transcribe(engine, self.request(pcm=base64.b64encode(pcm).decode()))
            engine.transcribe.assert_not_called()
        with self.assertRaises(ValueError):
            worker.transcribe(Mock(), self.request(pcm="not base64!"))

    def test_unsupported_language_is_rejected_without_decoding(self):
        engine = Mock()
        with self.assertRaises(ValueError):
            worker.transcribe(engine, self.request(language="fr"))
        engine.transcribe.assert_not_called()

    def test_uncertain_unsupported_or_oversized_result_cannot_execute(self):
        for engine in (self.engine(confidence=-1.1), self.engine(language="ur"), self.engine(text="light 1 on " + "x" * 501)):
            self.assertEqual(worker.transcribe(engine, self.request())["candidates"], [])

    def test_negation_is_preserved_verbatim_for_command_policy(self):
        engine = self.engine("Do not unlock the door.", "en")
        self.assertEqual(worker.transcribe(engine, self.request())["candidates"][0]["text"], "Do not unlock the door.")

    def test_token_limited_prefix_is_never_an_executable_candidate(self):
        engine = self.engine()
        engine.transcribe.return_value = (iter([SimpleNamespace(text='Turn on light one.', avg_logprob=-0.1, tokens=[1] * 56)]), SimpleNamespace(language='en', duration_after_vad=1))
        result = worker.transcribe(engine, self.request())
        self.assertTrue(result['limit_reached'])
        self.assertEqual(result['candidates'], [])

    def test_long_speech_is_rejected_without_decoding_a_prefix(self):
        engine = self.engine()
        def must_not_decode():
            raise AssertionError('Long speech must not enter the decoder')
            yield
        engine.transcribe.return_value = (must_not_decode(), SimpleNamespace(language='en', duration_after_vad=15))
        result = worker.transcribe(engine, self.request())
        self.assertTrue(result['limit_reached'])
        self.assertEqual(result['candidates'], [])

    def test_long_auto_speech_detection_returns_an_empty_bounded_result(self):
        engine = self.engine()
        engine.transcribe.side_effect = worker.SpeechLimitReached(1500)
        result = worker.transcribe(engine, self.request())
        self.assertTrue(result['limit_reached'])
        self.assertEqual(result['speech_ms'], 15000)
        self.assertEqual(result['candidates'], [])
        self.assertIsNone(result['language'])


if __name__ == "__main__":
    unittest.main()
