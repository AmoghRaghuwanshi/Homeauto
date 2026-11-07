const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { createRepository } = require('../db/repository'); const { Home } = require('../services/home'); const { Assistant } = require('../services/assistant'); const { SpeechService } = require('../voice/speech-service'); const { resolveCommand } = require('../voice/intent'); const { transcribeWhisper } = require('../voice/whisper'); const { loadConfig } = require('../lifecycle');
async function main() {
  const repo = await createRepository(); const home = new Home(repo); const speech = new SpeechService(home, new Assistant(home), loadConfig()); const actor = { user_id: 'synthetic-benchmark', role: 'owner' };
  const folder = path.join(__dirname, '../../.local/qa/speech'); fs.mkdirSync(folder, { recursive: true });
  const profile = process.argv.includes('--small') ? 'small' : 'base';
  const config = { binary: path.join(__dirname, '../../.local/whisper/Release/whisper-cli.exe'), model: path.join(__dirname, '../../.local/whisper/ggml-' + profile + '-q5_1.bin') };
  const corpus = [['en','Turn off room one lights.','off',['light-1','light-2']], ['en','Turn on light two.','on',['light-2']], ['en','Turn off all lights.','off',['light-1','light-2','light-3','light-4']], ['en','Do not unlock the door.',null,[]], ['hi','कमरा एक की लाइट बंद करो।','off',['light-1','light-2']], ['hi','सभी लाइटें बंद करो।','off',['light-1','light-2','light-3','light-4']], ['hi','लाइट दो चालू करो।','on',['light-2']], ['hi','दरवाजा मत खोलो।',null,[]], ['hi','रूम वन की लाइट बंद करो।','off',['light-1','light-2']]];
  const results = { date: new Date().toISOString(), corpus: 'Nine synthetic local Kokoro utterances; not human/accent/holdout accuracy', cpu: require('os').cpus()[0].model, ram_bytes: require('os').totalmem(), results: [] };
  try {
    speech.start(); const deadline = Date.now()+60000; while ((!speech.ready.tts_ready || !speech.ready.stt_ready) && Date.now()<deadline) await new Promise(r=>setTimeout(r,100));
    if (!speech.ready.tts_ready || !speech.ready.stt_ready) throw new Error('Speech workers unavailable');
    for (let i=0;i<corpus.length;i++) {
      const [language,text,action,ids] = corpus[i]; const wav=path.join(folder,'corpus-'+i+'.wav'); if (!fs.existsSync(wav)) { const {job_id}=await speech.synthesize(text,language,actor); while(speech.job(job_id,actor).state==='queued') await new Promise(r=>setTimeout(r,100)); fs.writeFileSync(wav,speech.audio(job_id,actor)); }
      const pcm=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',wav,'-f','s16le','-ar','16000','-ac','1','-']);
      const vosk=await speech.run('stt',{pcm:pcm.toString('base64'),language}); const whisper=await transcribeWhisper(pcm,language,config);
      for(const [provider,output] of [['vosk',vosk],['whisper-' + profile + '-q5_1',whisper]]) {
        const transcript=output.candidates[0]?.text||'';const parsed=resolveCommand(transcript,repo.getDevices(),home.rooms()); const exact=action===null?!parsed.ok:parsed.ok&&parsed.intent.action===action&&JSON.stringify(parsed.intent.device_ids)===JSON.stringify(ids);
        const row={index:i,language,text,provider,transcript,action_expected:action,exact_intent:exact,parsed:parsed.ok?parsed.intent:null,duration_ms:output.duration_ms,memory_bytes:output.memory_bytes||null};results.results.push(row);console.log(JSON.stringify(row));
      }
    }
  } finally { speech.close();repo.close();fs.writeFileSync(path.join(folder,'benchmark-' + profile + '.json'),JSON.stringify(results,null,2)); }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
