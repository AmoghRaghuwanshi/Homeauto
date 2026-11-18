const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync, spawn } = require('node:child_process');

class ModuleStore {
  constructor(filename) { this.filename = filename; }

  windowsProtect(data, decrypt = false) {
    const method = decrypt ? 'Unprotect' : 'Protect';
    const script = `Add-Type -AssemblyName System.Security; $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $result=[Security.Cryptography.ProtectedData]::${method}($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($result))`;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      input: data.toString('base64'), encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 65536,
    });
    if (result.error || result.status !== 0) throw Error('Module credential protection unavailable');
    return Buffer.from(result.stdout.trim(), 'base64');
  }

  localKey() {
    const directory = path.join(os.homedir(), '.homeauto', 'keys');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const filename = path.join(directory, 'modules.key');
    if (!fs.existsSync(filename)) {
      try { fs.writeFileSync(filename, crypto.randomBytes(32), { flag: 'wx', mode: 0o600 }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    const stat = fs.statSync(filename);
    if ((stat.mode & 0o077) !== 0) throw Error('Module key permissions must restrict access to the current user');
    const key = fs.readFileSync(filename);
    if (key.length !== 32) throw Error('Invalid module key');
    return key;
  }

  load() {
    if (!fs.existsSync(this.filename)) return null;
    const saved = JSON.parse(fs.readFileSync(this.filename, 'utf8'));
    if (saved.version !== 1) throw Error('Unsupported module configuration version');
    let plain;
    if (saved.protection === 'windows-user') plain = this.windowsProtect(Buffer.from(saved.data, 'base64'), true);
    else if (saved.protection === 'aes-256-gcm' && process.platform !== 'win32') {
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.localKey(), Buffer.from(saved.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(saved.tag, 'base64'));
      plain = Buffer.concat([decipher.update(Buffer.from(saved.data, 'base64')), decipher.final()]);
    } else throw Error('Unsupported module credential protection');
    return JSON.parse(plain.toString('utf8'));
  }

  async save(value) {
    const plain = Buffer.from(JSON.stringify(value));
    let saved;
    if (process.platform === 'win32') {
      const protectedData = await new Promise((resolve, reject) => {
        const script = 'Add-Type -AssemblyName System.Security; $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $result=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($result))';
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
        let output = '';
        const timeout = setTimeout(() => { child.kill(); reject(Error('Module credential protection timed out')); }, 15000);
        child.stdout.on('data', data => {
          output += data.toString();
          if (output.length > 65536) child.kill();
        });
        child.on('error', () => { clearTimeout(timeout); reject(Error('Module credential protection unavailable')); });
        child.on('close', code => {
          clearTimeout(timeout);
          if (code !== 0 || output.length > 65536) reject(Error('Module credential protection unavailable'));
          else resolve(output.trim());
        });
        child.stdin.on('error', () => {});
        child.stdin.end(plain.toString('base64'));
      });
      saved = { version: 1, protection: 'windows-user', data: protectedData };
    }
    else {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.localKey(), iv);
      saved = { version: 1, protection: 'aes-256-gcm', iv: iv.toString('base64'),
        data: Buffer.concat([cipher.update(plain), cipher.final()]).toString('base64'), tag: cipher.getAuthTag().toString('base64') };
    }
    fs.mkdirSync(path.dirname(this.filename), { recursive: true, mode: 0o700 });
    const temporary = this.filename + '.' + crypto.randomUUID() + '.tmp';
    try {
      fs.writeFileSync(temporary, JSON.stringify(saved), { flag: 'wx', mode: 0o600 });
      fs.renameSync(temporary, this.filename);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
}

module.exports = { ModuleStore };
