const path = require('node:path');
const { spawnSync } = require('node:child_process');

// A Windows venv python.exe launches the interpreter as a child. Killing just
// the launcher leaves inference running during Retry, consuming CPU and RAM.
// Only accept our live ChildProcess handle; never a PID supplied by a request.
function stopWorker(child, platform = process.platform, run = spawnSync) {
  if (!child) return;
  if (platform === 'win32' && Number.isInteger(child.pid) && child.pid > 0 && child.exitCode === null) {
    const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
    try {
      const result = run(executable, ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 2000 });
      if (result.status === 0) return;
    } catch { /* Fall back to the owned handle if process-tree cleanup fails. */ }
  }
  child.kill();
}

module.exports = { stopWorker };
