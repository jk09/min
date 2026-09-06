// Kills leftover dev Electron processes so F5 always attaches to a freshly built app.
// Min uses a single-instance lock, so a stale --development-mode process left running
// from a previous debug session causes new launches to quit immediately while the old
// (stale) process keeps serving the old bundle, making rebuilds appear to have no effect.
const { execSync } = require('child_process')

function run (cmd) {
  try {
    execSync(cmd, { stdio: 'ignore' })
  } catch (err) {
    // no matching process running - nothing to do
  }
}

if (process.platform === 'win32') {
  run('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'electron.exe\'\\" | Where-Object { $_.CommandLine -match \'--development-mode\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"')
} else {
  run("pkill -f 'electron.*--development-mode'")
}
