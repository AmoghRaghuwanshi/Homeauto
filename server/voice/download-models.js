/*
 * ═══════════════════════════════════════════════════════════
 *  Vosk Model Downloader — run once with internet
 *  Downloads English + Hindi speech models for offline use
 *  Usage:  node server/voice/download-models.js
 * ═══════════════════════════════════════════════════════════
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createUnzip } = require('zlib');

const MODELS_DIR = path.join(__dirname, 'models');

const MODELS = [
  {
    name: 'English (small)',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
    folder: 'vosk-model-small-en-us-0.15',
    target: 'en',
  },
  {
    name: 'Hindi (small)',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip',
    folder: 'vosk-model-small-hi-0.22',
    target: 'hi',
  },
];

// ─── Download a file with progress ────────────────────────
function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    console.log(`  Downloading: ${url}`);

    proto.get(url, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const file = fs.createWriteStream(destPath);

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalBytes > 0) {
          const pct = ((downloaded / totalBytes) * 100).toFixed(1);
          const mb = (downloaded / 1024 / 1024).toFixed(1);
          process.stdout.write(`\r  Progress: ${mb} MB (${pct}%)   `);
        }
      });

      // Pipe response to file and wait for it to fully finish writing
      res.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          console.log('\n  Download complete.');
          resolve();
        });
      });

      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });

      res.on('error', reject);
    }).on('error', reject);
  });
}


// ─── Extract zip using built-in child_process (tar on win) ─
async function extractZip(zipPath, destDir) {
  // Use PowerShell's Expand-Archive on Windows
  const { execSync } = require('child_process');
  console.log('  Extracting...');
  try {
    execSync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`,
      { stdio: 'inherit' }
    );
    console.log('  Extraction complete.');
  } catch (err) {
    throw new Error('Failed to extract zip: ' + err.message);
  }
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Vosk Model Downloader                      ║');
  console.log('║  English + Hindi (offline speech recognition)║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log();

  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }

  for (const model of MODELS) {
    const targetDir = path.join(MODELS_DIR, model.target);
    if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
      console.log(`✅ ${model.name} model already exists at ${targetDir}`);
      continue;
    }

    console.log(`\n📥 Downloading ${model.name} model...`);
    const zipPath = path.join(MODELS_DIR, `${model.target}.zip`);

    try {
      await download(model.url, zipPath);
      await extractZip(zipPath, MODELS_DIR);

      // Rename extracted folder to target name
      const extractedDir = path.join(MODELS_DIR, model.folder);
      if (fs.existsSync(extractedDir)) {
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
        fs.renameSync(extractedDir, targetDir);
      }

      // Clean up zip
      fs.unlinkSync(zipPath);
      console.log(`✅ ${model.name} model ready at ${targetDir}`);
    } catch (err) {
      console.error(`❌ Failed to download ${model.name}:`, err.message);
    }
  }

  console.log('\n🎉 All models ready! Voice recognition will work offline.');
}

main().catch(console.error);
