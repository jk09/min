const test = require('node:test')
const assert = require('node:assert')
const path = require('path')
const { spawn } = require('child_process')

const PROBE_PREFIX = '[renderer-trust-boundary]'
const LAUNCH_TIMEOUT = 60000

const EXPECTED_BRIDGE_GROUPS = [
  'app', 'bootstrap', 'clipboard', 'downloads', 'files', 'history', 'menu',
  'passwordManager', 'permissions', 'prompt', 'session', 'settings',
  'tabState', 'userscripts', 'views', 'window'
]

/*
Starts Min with --startup-diagnostics and resolves with the trust-boundary
probe that main/windowUtils.js runs inside the real chrome renderer. This is
the only check that loads the bundle in a browser: a renderer that regained
Node access, lost the bridge, or threw on startup passes every other suite.

Min takes a single-instance lock, so the app is launched once and every test
shares the result.
*/
function probeRenderer () {
  return new Promise(function (resolve, reject) {
    // required from Node (rather than from Electron) this resolves to the binary path
    const electron = require('electron')
    const env = Object.assign({}, process.env)
    // Electron runs main.js as plain Node when this is set, leaving `app` undefined
    delete env.ELECTRON_RUN_AS_NODE

    const child = spawn(electron, ['.', '--development-mode', '--startup-diagnostics'], {
      cwd: path.resolve(__dirname, '..'),
      env
    })

    let output = ''
    let settled = false

    const finish = function (fn, value) {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      // spawned without a shell, so this reaches Electron itself and its children follow
      child.kill()
      fn(value)
    }

    const timer = setTimeout(function () {
      finish(reject, new Error('the renderer probe did not report within ' + LAUNCH_TIMEOUT + 'ms:\n' + output))
    }, LAUNCH_TIMEOUT)

    const read = function (chunk) {
      output += chunk.toString('utf-8')
      const line = output.split('\n').find(value => value.includes(PROBE_PREFIX))
      if (line) {
        finish(resolve, JSON.parse(line.slice(line.indexOf(PROBE_PREFIX) + PROBE_PREFIX.length)))
      }
    }

    child.stdout.on('data', read)
    child.stderr.on('data', read)
    child.on('error', function (error) {
      finish(reject, error)
    })
    child.on('exit', function (code) {
      finish(reject, new Error('Min exited with code ' + code + ' before reporting. ' +
        'If another Min instance is running, its single-instance lock makes this exit immediately.\n' + output))
    })
  })
}

let probe = null

test('the chrome renderer starts and reports its trust boundary', { timeout: LAUNCH_TIMEOUT + 15000 }, async function () {
  probe = await probeRenderer()

  assert.equal(probe.error, undefined, 'the probe itself failed: ' + probe.error)
  assert.equal(probe.rendererInitialized, true,
    'the chrome bundle loaded but never finished initializing - it most likely threw on startup')
})

test('the main chrome view is created with the Chromium-only web preferences', function () {
  assert.ok(probe, 'the renderer probe did not run')

  // asserted separately from the runtime checks below: with contextIsolation on,
  // the main world has no Node globals whether or not nodeIntegration is set, so
  // the runtime probe alone would not notice these flags being turned back on
  assert.deepEqual(probe.securityPreferences, {
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    contextIsolation: true,
    sandbox: true
  })
})

test('the chrome renderer runs without Node, Electron or raw IPC access', function () {
  assert.ok(probe, 'the renderer probe did not run')

  assert.equal(probe.require, true, 'require must not be reachable from the renderer')
  assert.equal(probe.process, true, 'process must not be reachable from the renderer')
  assert.equal(probe.Buffer, true, 'Buffer must not be reachable from the renderer')
  assert.equal(probe.module, true, 'the CommonJS module object must not be reachable from the renderer')
  assert.equal(probe.electron, true, 'window.electron must not exist')
  assert.equal(probe.fs, true, 'window.fs must not exist')
  assert.equal(probe.ipc, true, 'window.ipc must not exist')
  assert.equal(probe.EventEmitter, true, 'window.EventEmitter must not exist')
  assert.equal(probe.globalArgs, true, 'window.globalArgs must not exist')
})

test('the chrome renderer receives the whole bridge and nothing more', function () {
  assert.ok(probe, 'the renderer probe did not run')

  assert.deepEqual(probe.bridgeGroups, EXPECTED_BRIDGE_GROUPS)
  assert.deepEqual(probe.bridgeLeaks, [], 'the bridge must not expose a generic escape hatch')

  // a renderer that starts but never receives its bootstrap data is broken in a way
  // that only shows up later, as an empty window id or a missing session
  assert.ok(probe.windowId, 'the bridge must carry a window id')
  assert.ok(probe.platform, 'the bridge must carry the platform')
  assert.match(probe.appVersion, /^\d+\.\d+\.\d+/, 'the bridge must carry the app version')
})
