// Actual CPU models, synthetic inputs, in-memory home; never executes an intent.
const { createPreview } = require('./preview');
const fs = require('node:fs'); const path = require('node:path');
const assert = require('node:assert/strict'); const { execFileSync } = require('node:child_process');
const { resolveCommand } = require('../voice/intent');
async function runStress(fixture, folder = process.env.HOMEAUTO_STRESS_QA_DIR || path.resolve(__dirname, '../../.local/qa/recognition-stress')) {
  fs.mkdirSync(folder, { recursive: true });
  const speech = fixture.runtime.speech;
  const commandsBefore = fixture.runtime.repo.one('SELECT COUNT(*) AS n FROM commands').n;
  const report = { input: 'Synthetic PCM; actual CPU models; no execute request', rows: [] };
  const pcm = index => execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-i',path.resolve(__dirname, '../../.local/qa/speech/corpus-' + index + '.wav'),'-f','s16le','-ar','16000','-ac','1','-']);
  try {
    const until = Date.now() + 60000;
    while (!speech.ready.stt_ready || !speech.ready.tts_ready) { if (Date.now() > until) throw Error('Models not ready'); await new Promise(r => setTimeout(r, 100)); }
    const english = Buffer.alloc(640000); pcm(2).copy(english, 160000);
    const hindi = Buffer.alloc(640000); pcm(6).copy(hindi, 64000);
    let seed = 1;
    for (let i = 0; i < hindi.length; i += 2) { seed = (1664525 * seed + 1013904223) >>> 0; const noise = (seed % 513) - 256; hindi.writeInt16LE(Math.max(-32768, Math.min(32767, hindi.readInt16LE(i) + noise)), i); }
    for (const [name, audio, language, action, ids] of [['20s English with pauses', english, 'en', 'off', ['light-1','light-2','light-3','light-4']], ['20s Hindi with background noise', hindi, 'hi', 'on', ['light-2']]]) {
      const result = await speech.run('stt', { pcm: audio.toString('base64'), language: 'auto' });
      const candidate = result.candidates[0]; const parsed = resolveCommand(candidate?.text || '', fixture.runtime.repo.getDevices(), fixture.runtime.home.rooms());
      const row = { name, transcript: candidate?.text, ...result }; delete row.id;
      report.rows.push(row); console.log(JSON.stringify(row));
      assert.equal(parsed.ok, true); assert.equal(parsed.intent.action, action); assert.deepEqual(parsed.intent.device_ids, ids); assert.equal(candidate.lang, language);
      assert.ok(result.duration_ms < 60000); assert.equal(result.encoder_passes, 1);
    }
    const actor = { user_id: 'synthetic-stress', role: 'owner' };
    const { job_id } = await speech.synthesize('Do not turn on light two.', 'en', actor);
    while (speech.job(job_id, actor).state === 'queued') await new Promise(r => setTimeout(r, 100));
    const file = path.join(folder, 'negative-tail.wav'); fs.writeFileSync(file, speech.audio(job_id, actor));
    const tail = execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-i',file,'-f','s16le','-ar','16000','-ac','1','-']);
    const positive = pcm(1); const repeated = Buffer.concat([...Array.from({ length: 12 }, () => positive), tail]);
    assert.ok(repeated.length <= 640000, 'The negative tail must not be clipped');
    const long = Buffer.alloc(640000); repeated.copy(long);
    const result = await speech.run('stt', { pcm: long.toString('base64'), language: 'auto' });
    report.rows.push({ name: 'Long repeated speech with negative tail', ...result });
    assert.equal(result.limit_reached, true); assert.equal(result.encoder_passes, 0);
    assert.deepEqual(result.candidates, []);
    assert.equal(resolveCommand(result.candidates[0]?.text || '', fixture.runtime.repo.getDevices(), fixture.runtime.home.rooms()).ok, false);
    assert.ok(result.duration_ms < 30000);
    assert.equal(fixture.runtime.repo.one('SELECT COUNT(*) AS n FROM commands').n, commandsBefore);
    report.commands_sent = 0;
    console.log(JSON.stringify(report.rows.at(-1)));
  } catch (error) { report.failure = error.message; report.last_recognition = speech.recognitionMetrics(); throw error; }
  finally { fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(report, null, 2)); }
  return report;
}
async function main() {
  const fixture = await createPreview({ voice: true });
  try { await runStress(fixture); } finally { await fixture.runtime.stop(); }
}
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
module.exports = { runStress };
