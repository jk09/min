/*
Small module holding main-process state and paths that need to be shared across
main/*.js modules. Previously this state existed as implicit global variables
created by concatenating all main-process scripts into main.build.js.
*/

const path = require('path')
const { app } = require('electron')

const isDevelopmentMode = process.argv.some(arg => arg === '--development-mode')
const isDebuggingEnabled = process.argv.some(arg => arg === '--debug-browser')
const isStartupDiagnosticsEnabled = process.argv.some(arg => arg === '--startup-diagnostics') || process.env.MIN_STARTUP_DIAGNOSTICS === '1'

if (isDevelopmentMode) {
  app.setPath('userData', app.getPath('userData') + '-development')
}

module.exports = {
  // absolute path to the repository/app root, since main/*.js modules no longer
  // share __dirname with the (previously concatenated) main.build.js at the app root
  appRoot: path.resolve(__dirname, '..'),
  isDevelopmentMode,
  isDebuggingEnabled,
  isStartupDiagnosticsEnabled,
  userDataPath: app.getPath('userData'),
  // mutated by main/menu.js and read by main/main.js
  isFocusMode: false,
  // set by main/main.js once the places service window is created, read by main/menu.js
  placesWindow: null
}
