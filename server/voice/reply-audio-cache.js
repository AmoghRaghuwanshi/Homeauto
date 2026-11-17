// Persistent audio for approved fixed copy only. No recordings, commands or
// observations. Paths are internal SHA-256 keys and writes are best-effort.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MAX_BYTES = 8 * 1024 * 1024, MAX_ENTRIES = 16;
const digest = audio => crypto.createHash('sha256').update(audio).digest('hex');
class ReplyAudioCache {
  constructor(root) { this.root = path.resolve(root); }
  file(key, suffix) {
    if (!/^[a-f0-9]{64}$/.test(key) || !['.wav', '.json'].includes(suffix)) throw Error('Invalid audio cache key');
    return path.join(this.root, key + suffix);
  }
  get(key) {
    try {
      const root = fs.lstatSync(this.root); if (!root.isDirectory() || root.isSymbolicLink()) return null;
      const wav = this.file(key, '.wav'), meta = this.file(key, '.json');
      const info = fs.lstatSync(wav), metadataInfo = fs.lstatSync(meta);
      if (!info.isFile() || !metadataInfo.isFile() || metadataInfo.size > 1024 || info.size < 44 || info.size > MAX_BYTES) return null;
      const metadata = JSON.parse(fs.readFileSync(meta, 'utf8'));
      if (metadata.version !== 1 || metadata.bytes !== info.size) return null;
      const audio = fs.readFileSync(wav);
      if (digest(audio) !== metadata.sha256 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') return null;
      const now = new Date(); fs.utimesSync(wav, now, now);
      return { audio, duration_ms: 0 };
    } catch { return null; }
  }
  put(key, audio) {
    if (audio.length < 44 || audio.length > MAX_BYTES || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') return;
    const temporary = [];
    try {
      const wav = this.file(key, '.wav'), meta = this.file(key, '.json');
      fs.mkdirSync(this.root, { recursive: true });
      if (fs.lstatSync(this.root).isSymbolicLink()) return;
      for (const [target, value] of [[wav, audio], [meta, JSON.stringify({ version: 1, bytes: audio.length, sha256: digest(audio) })]]) {
        if (fs.existsSync(target) && !fs.lstatSync(target).isFile()) return;
        const staging = target + '.' + crypto.randomUUID() + '.tmp'; temporary.push(staging);
        fs.writeFileSync(staging, value, { flag: 'wx' }); fs.renameSync(staging, target);
      }
      this.prune();
    } catch { /* A cache write must not turn a successful reply into a failure. */ }
    finally { for (const file of temporary) try { fs.unlinkSync(file); } catch {} }
  }
  prune() {
    const entries = fs.readdirSync(this.root, { withFileTypes: true }).filter(entry => entry.isFile() && /^[a-f0-9]{64}\.wav$/.test(entry.name)).map(entry => {
      const file = path.join(this.root, entry.name), stat = fs.lstatSync(file);
      return { key: entry.name.slice(0, -4), bytes: stat.size, used: stat.mtimeMs };
    }).sort((a, b) => a.used - b.used);
    let bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0), count = entries.length;
    for (const entry of entries) {
      if (bytes <= MAX_BYTES && count <= MAX_ENTRIES) break;
      for (const suffix of ['.wav', '.json']) { const file = this.file(entry.key, suffix); if (fs.existsSync(file) && fs.lstatSync(file).isFile()) fs.unlinkSync(file); }
      bytes -= entry.bytes; count--;
    }
  }
}
module.exports = { ReplyAudioCache };
