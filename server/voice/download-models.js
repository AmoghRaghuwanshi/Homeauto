// Explicit model setup only. Never invoked at app startup.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const python = process.env.HOMEAUTO_STT_PYTHON || path.resolve(__dirname, '../../.local/stt-venv/Scripts/python.exe');
if (!fs.existsSync(python)) {
  console.error('Install the local STT environment first. See docs/verification/WHISPER_UPGRADE.md.');
  process.exitCode = 1;
} else {
  const result = spawnSync(python, [path.join(__dirname, 'provision-stt.py')], { windowsHide: true, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
}
