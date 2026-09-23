const fs = require('fs')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const { dialog, ipcMain: ipc } = require('electron')
const { getChromeWindow } = require('./chromeCapabilities')

const MANAGERS = Object.freeze({
  bitwarden: { command: 'bw', executable: process.platform === 'win32' ? 'bw.exe' : 'bw' },
  onepassword: { command: 'op', executable: process.platform === 'win32' ? 'op.exe' : 'op' }
})

function getManager (manager) {
  if (typeof manager !== 'string' || !MANAGERS[manager]) {
    throw new Error('password manager is not allowed')
  }
  return MANAGERS[manager]
}

function getLocalToolPath (manager) {
  return path.join(require('./appState').userDataPath, 'tools', getManager(manager).executable)
}

function commandExists (command) {
  const lookup = process.platform === 'win32' ? 'where' : 'which'
  return spawnSync(lookup, [command], { stdio: 'ignore' }).status === 0
}

function getToolCommand (manager) {
  const localPath = getLocalToolPath(manager)
  if (fs.existsSync(localPath)) {
    return localPath
  }
  return commandExists(getManager(manager).command) ? getManager(manager).command : null
}

function runTool (command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: Object.assign({}, process.env, options.env),
      timeout: options.timeout
    })
    let data = ''
    let error = ''
    child.stdout.on('data', chunk => { data += chunk })
    child.stderr.on('data', chunk => { error += chunk })
    child.on('error', spawnError => reject(createProcessError(String(spawnError), data)))
    child.on('close', code => code === 0 ? resolve(data.trimEnd()) : reject(createProcessError(error, data)))
    if (options.input !== undefined) {
      child.stdin.end(options.input)
    }
  })
}

function createProcessError (error, data) {
  const processError = new Error(error)
  processError.error = error
  processError.data = data
  return processError
}

function requireString (value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(name + ' must be a non-empty string')
  }
  return value
}

function requireObject (value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(name + ' must be an object')
  }
  return value
}

async function runBitwarden (operation, data) {
  if (!['unlock', 'sync', 'logout', 'sign-in', 'suggestions'].includes(operation)) {
    throw new Error('Bitwarden operation is not allowed')
  }
  const command = getToolCommand('bitwarden')
  if (!command) throw new Error('Bitwarden CLI is unavailable')
  if (operation === 'unlock') return runTool(command, ['unlock', '--raw', requireString(data.password, 'password')])
  if (operation === 'sync') return runTool(command, ['sync', '--session', requireString(data.sessionKey, 'session key')])
  if (operation === 'logout') return runTool(command, ['logout'])
  if (operation === 'sign-in') {
    return runTool(command, ['login', '--apikey'], { env: { BW_CLIENTID: requireString(data.clientID, 'client ID').trim(), BW_CLIENTSECRET: requireString(data.clientSecret, 'client secret').trim() } })
  }
  if (operation === 'suggestions') {
    return runTool(command, ['list', 'items', '--url', requireString(data.domain, 'domain').replace(/[^a-zA-Z0-9.-]/g, ''), '--session', requireString(data.sessionKey, 'session key')])
  }
}

async function runOnePassword (operation, data) {
  if (!['version', 'whoami', 'signout', 'unlock', 'sign-in', 'list', 'get'].includes(operation)) {
    throw new Error('1Password operation is not allowed')
  }
  const command = getToolCommand('onepassword')
  if (!command) throw new Error('1Password CLI is unavailable')
  const deviceEnv = { OP_DEVICE: requireString(data.deviceID, 'device ID') }
  if (operation === 'version') return runTool(command, ['--version'])
  if (operation === 'whoami') return runTool(command, ['whoami'], { env: deviceEnv, timeout: 1000, input: data.input })
  if (operation === 'signout') return runTool(command, ['signout'], { env: deviceEnv, timeout: 5000 })
  if (operation === 'unlock') return runTool(command, ['signin', '--raw', '--account', 'min-autofill'], { env: deviceEnv, timeout: 5000, input: requireString(data.password, 'password') })
  if (operation === 'sign-in') {
    return runTool(command, ['account', 'add', '--address', 'my.1password.com', '--email', requireString(data.email, 'email'), '--secret-key', requireString(data.secretKey, 'secret key'), '--shorthand', 'min-autofill', '--signin', '--raw'], { env: deviceEnv, input: requireString(data.password, 'password') })
  }
  if (operation === 'list') return runTool(command, ['item', 'list', '--categories', 'login', '--session=' + requireString(data.sessionKey, 'session key'), '--format=json'], { env: deviceEnv })
  if (operation === 'get') return runTool(command, ['item', 'get', requireString(data.itemId, 'item ID'), '--session=' + requireString(data.sessionKey, 'session key'), '--format=json'], { env: deviceEnv })
}

function installTool (manager, sourcePath) {
  getManager(manager)
  const targetPath = getLocalToolPath(manager)
  if (typeof sourcePath !== 'string' || !path.isAbsolute(sourcePath) || !fs.existsSync(sourcePath)) {
    throw new Error('tool source is not allowed')
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.copyFileSync(sourcePath, targetPath)
  fs.chmodSync(targetPath, '755')
}

function launchInstaller (manager, sourcePath) {
  getManager(manager)
  if (typeof sourcePath !== 'string' || !path.isAbsolute(sourcePath) || path.extname(sourcePath) !== '.pkg' || !fs.existsSync(sourcePath)) {
    throw new Error('installer source is not allowed')
  }
  return runTool('open', [sourcePath])
}

function registerPasswordManagerCapabilities () {
  ipc.handle('chrome:password-manager:check-tool', function (event, manager) {
    getChromeWindow(event)
    return Boolean(getToolCommand(manager))
  })
  ipc.handle('chrome:password-manager:bitwarden', function (event, operation, data) {
    getChromeWindow(event)
    return runBitwarden(operation, requireObject(data, 'Bitwarden request'))
  })
  ipc.handle('chrome:password-manager:onepassword', function (event, operation, data) {
    getChromeWindow(event)
    return runOnePassword(operation, requireObject(data, '1Password request'))
  })
  ipc.handle('chrome:password-manager:install-tool', function (event, manager, sourcePath) {
    getChromeWindow(event)
    return installTool(manager, sourcePath)
  })
  ipc.handle('chrome:password-manager:launch-installer', function (event, manager, sourcePath) {
    getChromeWindow(event)
    return launchInstaller(manager, sourcePath)
  })
  ipc.handle('chrome:password-manager:read-import', async function (event) {
    const window = getChromeWindow(event)
    const result = await dialog.showOpenDialog(window, { filters: [{ name: 'CSV', extensions: ['csv'] }, { name: 'All Files', extensions: ['*'] }] })
    return result.canceled ? null : fs.readFileSync(result.filePaths[0], 'utf8')
  })
}

module.exports = { getLocalToolPath, getManager, installTool, registerPasswordManagerCapabilities, runBitwarden, runOnePassword }
