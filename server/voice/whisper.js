const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
function pcmWav(pcm) {
  const header = Buffer.alloc(44); header.write('RIFF'); header.writeUInt32LE(pcm.length + 36, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(16000, 24); header.writeUInt32LE(32000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40); return Buffer.concat([header, pcm]);
}
function transcribeWhisper(pcm, language, { binary, model, signal } = {}) {
  if (!Buffer.isBuffer(pcm) || pcm.length > 640000 || pcm.length % 2 || !['en', 'hi', 'auto'].includes(language)) throw new Error('Invalid audio');
  return new Promise((resolve, reject) => {
    // This Windows CLI release does not decode piped WAV input. This adapter is
    // benchmark-only; temporary synthetic audio is removed on every exit path.
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'homeauto-benchmark-')); const file = path.join(folder, 'utterance.wav'); fs.writeFileSync(file, pcmWav(pcm), { mode: 0o600 });
    const cleanup = () => fs.rmSync(folder, { recursive: true, force: true });
    const start = performance.now(); let child;
    try { child = spawn(binary, ['-m', model, '-f', file, '-l', language, '-t', '4', '-ng', '-nt', '-np', '-bo', '1', '-bs', '1'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], signal }); } catch (error) { cleanup(); reject(error); return; }
    let output = ''; const deadline = setTimeout(() => { child.kill(); reject(new Error('Whisper timeout')); }, 30000);
    child.stdout.setEncoding('utf8'); child.stdout.on('data', value => { output += value; if (output.length > 16000) child.kill(); });
    child.once('error', error => { clearTimeout(deadline); cleanup(); reject(error); }); child.once('close', code => { clearTimeout(deadline); cleanup(); code === 0 && output.trim() ? resolve({ candidates: [{ lang: language, text: output.trim() }], duration_ms: performance.now() - start, provider: 'whisper.cpp-base-q5_1' }) : reject(new Error('Whisper failed or returned no transcript')); });
  });
}
module.exports = { pcmWav, transcribeWhisper };
