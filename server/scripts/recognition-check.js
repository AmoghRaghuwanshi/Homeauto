// Native listening acceptance: synthetic speech/silence/noise, disposable home, no MQTT.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createPreview } = require('./preview');
const { resolveCommand } = require('../voice/intent');

async function main() {
  const folder = process.env.HOMEAUTO_RECOGNITION_QA_DIR || path.resolve(__dirname, '../../.local/qa/recognition');
  fs.mkdirSync(folder, { recursive: true });
  const fixture = await createPreview({ voice: true });
  const speech = fixture.runtime.speech;
  const report = { provider: 'faster-whisper-medium-int8', input: 'Synthetic Kokoro speech; not human/accent acceptance', rows: [], errors: [] };
  try {
    const deadline = Date.now() + 60000;
    while (!speech.ready.stt_ready || !speech.ready.tts_ready) {
      if (Date.now() > deadline) throw Error('Native workers not ready');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    report.assets = speech.assets();
    const corpus = [
      ['en', 'Turn off room one lights.', 'off', ['light-1', 'light-2']],
      ['en', 'Turn on light two.', 'on', ['light-2']],
      ['en', 'Turn off all lights.', 'off', ['light-1', 'light-2', 'light-3', 'light-4']],
      ['en', 'Do not unlock the door.', null, []],
      ['hi', 'कमरा एक की लाइट बंद करो।', 'off', ['light-1', 'light-2']],
      ['hi', 'सभी लाइटें बंद करो।', 'off', ['light-1', 'light-2', 'light-3', 'light-4']],
      ['hi', 'लाइट दो चालू करो।', 'on', ['light-2']],
      ['hi', 'दरवाजा मत खोलो।', null, []],
      ['hi', 'रूम वन की लाइट बंद करो।', 'off', ['light-1', 'light-2']],
    ];
    for (let index = 0; index < corpus.length; index++) {
      const [language, text, action, devices] = corpus[index];
      // Reuse the exact historical corpus for the documented comparison when present.
      const existing = path.resolve(__dirname, '../../.local/qa/speech/corpus-' + index + '.wav');
      const wav = path.join(folder, 'corpus-' + index + '.wav');
      if (fs.existsSync(existing)) fs.copyFileSync(existing, wav);
      else {
        const actor = { user_id: 'synthetic-listening-test', role: 'owner' };
        const { job_id } = await speech.synthesize(text, language, actor);
        while (speech.job(job_id, actor).state === 'queued') await new Promise(resolve => setTimeout(resolve, 100));
        fs.writeFileSync(wav, speech.audio(job_id, actor));
      }
      const pcm = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', wav, '-f', 's16le', '-ar', '16000', '-ac', '1', '-']);
      for (const requested of ['auto', language]) {
        const decoded = await speech.run('stt', { pcm: pcm.toString('base64'), language: requested });
        const candidate = decoded.candidates[0];
        const parsed = resolveCommand(candidate?.text || '', fixture.runtime.repo.getDevices(), fixture.runtime.home.rooms());
        const exact = action === null ? !parsed.ok : parsed.ok && parsed.intent.action === action && JSON.stringify(parsed.intent.device_ids) === JSON.stringify(devices);
        const row = { index, requested, language, text, transcript: candidate?.text || '', detected: candidate?.lang, exact_intent: exact, reason: parsed.reason, duration_ms: decoded.duration_ms, audio_ms: decoded.audio_ms, encoder_passes: decoded.encoder_passes, encoder_reuses: decoded.encoder_reuses };
        report.rows.push(row); console.log(JSON.stringify(row));
        if (action === null) assert.equal(parsed.ok, false, 'Negated audio must never execute');
      }
    }
    for (const kind of ['silence', 'noise']) {
      const pcm = Buffer.alloc(64000);
      if (kind === 'noise') { let seed = 123; for (let i = 0; i < pcm.length; i += 2) { seed = (1664525 * seed + 1013904223) >>> 0; pcm.writeInt16LE((seed % 2001) - 1000, i); } }
      const result = await speech.run('stt', { pcm: pcm.toString('base64'), language: 'auto' });
      report.rows.push({ kind, ...result }); assert.deepEqual(result.candidates, []);
    }
    assert.equal(fixture.runtime.repo.one('SELECT COUNT(*) AS n FROM commands').n, 0);
    report.commands_sent = 0;
    report.summary = ['auto', 'en', 'hi'].map(requested => { const rows = report.rows.filter(row => row.requested === requested); return { requested, exact: rows.filter(row => row.exact_intent).length, total: rows.length, max_ms: Math.max(...rows.map(row => row.duration_ms)) }; });
    console.log(JSON.stringify(report.summary));
    assert.ok(report.rows.filter(row => row.requested).every(row => row.exact_intent), 'Synthetic command acceptance failed; inspect retained transcripts');
  } catch (error) { report.errors.push(error.message); throw error; }
  finally { fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(report, null, 2)); await fixture.runtime.stop(); }
}
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
