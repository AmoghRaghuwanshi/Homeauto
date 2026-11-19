const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const site = path.join(root, 'website');
const files = [
  'package.json', 'package-lock.json', '.vercelignore',
  'scripts/verify-cloud-build.js',
  'server/auth/sessions.js', 'server/services/home.js', 'server/voice/intent.js',
  'server/cloud/config.js', 'server/cloud/postgres.js', 'server/cloud/protocol.js',
];
const directories = ['api', 'public', 'server/online', 'server/lib'];
const expected = new Map();
function add(relative) {
  expected.set(relative.replaceAll('\\', '/'), fs.readFileSync(path.join(root, relative)));
}
for (const file of files) add(file);
for (const dir of directories) {
  function visit(base) {
    for (const entry of fs.readdirSync(path.join(root, base), { withFileTypes: true })) {
      const relative = path.join(base, entry.name);
      if (entry.isDirectory()) visit(relative);
      else if (entry.isFile()) add(relative);
    }
  }
  visit(dir);
}
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
vercel.git = { deploymentEnabled: true };
expected.set('vercel.json', Buffer.from(JSON.stringify(vercel, null, 2) + '\n'));
function currentGenerated() {
  const found = [];
  for (const name of [...files, 'vercel.json']) if (fs.existsSync(path.join(site, name))) found.push(name.replaceAll('\\', '/'));
  for (const dir of directories) {
    const start = path.join(site, dir);
    if (!fs.existsSync(start)) continue;
    function visit(base) {
      for (const entry of fs.readdirSync(path.join(site, base), { withFileTypes: true })) {
        const relative = path.join(base, entry.name);
        if (entry.isDirectory()) visit(relative);
        else if (entry.isFile()) found.push(relative.replaceAll('\\', '/'));
      }
    }
    visit(dir);
  }
  return found;
}
const drift = [];
for (const [relative, bytes] of expected) {
  const target = path.join(site, relative);
  if (!fs.existsSync(target) || !fs.readFileSync(target).equals(bytes)) drift.push(relative);
}
for (const relative of currentGenerated()) if (!expected.has(relative)) drift.push(relative);
if (process.argv.includes('--check')) {
  if (drift.length) { console.error('Website copy is out of sync:', drift.join(', ')); process.exitCode = 1; }
  else console.log(`Website copy matches ${expected.size} source files.`);
} else {
  for (const relative of currentGenerated()) if (!expected.has(relative)) fs.rmSync(path.join(site, relative));
  for (const [relative, bytes] of expected) {
    const target = path.join(site, relative);
    if (fs.existsSync(target) && fs.readFileSync(target).equals(bytes)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  console.log(`Synchronized ${expected.size} website files.`);
}
