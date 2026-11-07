// Native speech decoding is isolated from the API/MQTT event loop and credentials.
const path = require('path');
const models = {};
try {
  const vosk = require('vosk'); vosk.setLogLevel(-1);
  for (const lang of ['en', 'hi']) models[lang] = new vosk.Model(path.join(process.env.HOMEAUTO_MODELS, lang));
  process.send({ type: 'ready', languages: Object.keys(models) });
  process.on('message', msg => {
    if (msg.type !== 'transcribe') return;
    const start = performance.now(); const pcm = Buffer.from(msg.pcm, 'base64');
    if (pcm.length > 640000 || pcm.length % 2) return process.send({ id: msg.id, error: 'INVALID_AUDIO' });
    const candidates = [];
    for (const [lang, model] of Object.entries(models)) {
      if (msg.language !== 'auto' && lang !== msg.language) continue;
      let rec;
      try {
        rec = new vosk.Recognizer({ model, sampleRate: 16000 }); rec.setWords(true);
        const words = [];
        for (let i = 0; i < pcm.length; i += 3200) if (rec.acceptWaveform(pcm.subarray(i, i + 3200))) { const r = rec.result(); if (r.text) words.push(r.text); }
        const last = rec.finalResult(); if (last.text) words.push(last.text);
        candidates.push({ lang, text: words.join(' ').trim() });
      } catch { process.send({ id: msg.id, error: 'RECOGNITION_FAILED' }); return; }
      finally { if (rec) rec.free(); }
    }
    process.send({ id: msg.id, candidates, duration_ms: performance.now() - start, memory_bytes: process.memoryUsage().rss });
  });
} catch { process.send({ type: 'unavailable', error: 'STT_MODEL_LOAD_FAILED' }); }
process.on('disconnect', () => { for (const model of Object.values(models)) model.free(); process.exit(0); });
