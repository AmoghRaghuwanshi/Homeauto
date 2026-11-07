const fs = require('fs'); const path = require('path'); const net = require('net');
async function provisionTLS(folder, names = ['localhost', '127.0.0.1', '::1']) {
  if (!names.length || names.some(n => !net.isIP(n) && !/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/.test(n))) throw new Error('Provide explicit DNS names or IP addresses.');
  fs.mkdirSync(folder, { recursive: true });
  const cert = path.join(folder, 'server.cert'); const key = path.join(folder, 'server.key');
  if (fs.existsSync(cert) || fs.existsSync(key)) throw new Error('TLS files already exist. Move them to a private backup before rotating.');
  const pems = await require('selfsigned').generate([{ name: 'commonName', value: names[0] }], { keySize: 3072, algorithm: 'sha256', notAfterDate: new Date(Date.now() + 90 * 86400000), extensions: [
    { name: 'basicConstraints', cA: false }, { name: 'keyUsage', digitalSignature: true, keyEncipherment: true }, { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames: names.map(name => net.isIP(name) ? { type: 7, ip: name } : { type: 2, value: name }) },
  ] });
  fs.writeFileSync(key, pems.private, { flag: 'wx', mode: 0o600 }); fs.writeFileSync(cert, pems.cert, { flag: 'wx', mode: 0o600 });
  return { cert, key, fingerprint: new (require('crypto').X509Certificate)(pems.cert).fingerprint256 };
}
if (require.main === module) provisionTLS(path.join(__dirname, '../../.local/tls'), process.argv.length > 2 ? process.argv.slice(2) : undefined).then(result => console.log('New private TLS files created in .local/tls. Certificate SHA256: ' + result.fingerprint + '\nEstablish certificate trust on each client before LAN microphone use. No trust store was changed.')).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { provisionTLS };
