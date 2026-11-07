const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
function checksum(file) { return new Promise((resolve,reject)=>{ const hash=crypto.createHash('sha256'); const stream=fs.createReadStream(file); stream.on('data',chunk=>hash.update(chunk)); stream.on('error',reject); stream.on('end',()=>resolve(hash.digest('hex'))); }); }
async function verifyProfile(kind, config) {
  const manifest=require('./asset-manifest.json').filter(a=>a.kind===kind); let bytes=0;
  for(const entry of manifest) {
    const root=kind==='stt'?config.MODELS_DIR:null; const file=kind==='stt'?path.join(root,entry.file):config[entry.config];
    if(!file || fs.statSync(file).size!==entry.bytes || await checksum(file)!==entry.sha256) throw new Error('Speech asset verification failed'); bytes+=entry.bytes;
  }
  return {bytes,files:manifest.length,sha256:crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex')};
}
module.exports={checksum,verifyProfile};
