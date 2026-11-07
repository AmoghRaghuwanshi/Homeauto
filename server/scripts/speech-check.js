const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { createRepository } = require('../db/repository');
const { Home } = require('../services/home');
const { Assistant } = require('../services/assistant');
const { SpeechService } = require('../voice/speech-service');
const { loadConfig } = require('../lifecycle');
async function main() {
  const repo = await createRepository(); const home = new Home(repo); const assistant = new Assistant(home); const speech = new SpeechService(home, assistant, loadConfig());
  const folder = path.join(__dirname, '../../.local/qa/speech'); fs.mkdirSync(folder, { recursive: true });
  const result = { date: new Date().toISOString(), cpu_only: true, input_kind: 'synthetic local TTS, not human/accent corpus', results: [] };
  const actor = { user_id: 'isolated-speech-test', role: 'owner' };
  try {
    const start = performance.now(); speech.start();
    while ((!speech.ready.stt_ready || !speech.ready.tts_ready) && performance.now() - start < 60000) await new Promise(resolve => setTimeout(resolve, 200));
    result.readiness = speech.readiness(); result.cold_load_ms = performance.now() - start;
    if (!speech.ready.tts_ready || !speech.ready.stt_ready) throw new Error('Local STT/TTS did not become ready');
    for (const [language, text] of [['en', 'Turn off room one lights.'], ['hi', 'कमरा एक की लाइट बंद करो।']]) {
      const started = performance.now(); const { job_id } = await speech.synthesize(text, language, actor);
      while (speech.job(job_id, actor).state === 'queued') await new Promise(resolve => setTimeout(resolve, 100));
      const audio = speech.audio(job_id, actor); const wav = path.join(folder, language + '.wav'); fs.writeFileSync(wav, audio);
      const tts_ms = performance.now() - started; const pcm = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', wav, '-f', 's16le', '-ar', '16000', '-ac', '1', '-']);
      const transcription = await speech.run('stt', { pcm: pcm.toString('base64'), language });
      result.results.push({ language, text, tts_ms, audio_bytes: audio.length, pcm_bytes: pcm.length, ...transcription });
      console.log(JSON.stringify(result.results.at(-1)));
    }
    if(process.platform==='win32') {
      const ids=[process.pid,speech.stt?.pid,speech.ttsWorkerPid].filter(Number.isInteger); result.process_roles={hub:process.pid,stt:speech.stt?.pid,tts:speech.ttsWorkerPid};
      try { result.process_memory=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',`Get-Process -Id ${ids.join(',')} | Select-Object Id,WorkingSet64,PeakWorkingSet64 | ConvertTo-Json -Compress`],{encoding:'utf8'})); } catch { result.process_memory=null; }
    }
  } finally { speech.close(); repo.close(); fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(result, null, 2)); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
