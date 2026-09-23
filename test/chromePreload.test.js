const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const buildPreload = require('../scripts/buildPreload')

/*
Evaluates the built chrome preload against a stub Electron module and returns
the object it hands to contextBridge, so the exposed surface can be asserted
without starting Electron.
*/
function loadBridge () {
  buildPreload()

  const source = fs.readFileSync(path.resolve(__dirname, '../dist/preload-chrome.js'), 'utf-8')
  let exposed = null

  const electronStub = {
    contextBridge: {
      exposeInMainWorld: function (key, value) {
        assert.equal(key, 'min')
        exposed = value
      }
    },
    ipcRenderer: {
      on: function () {},
      removeListener: function () {},
      send: function () {},
      sendSync: function () {},
      invoke: function () { return Promise.resolve() }
    },
    webUtils: { getPathForFile: () => '' }
  }

  const sandboxRequire = function (name) {
    if (name === 'electron') {
      return electronStub
    }
    throw new Error('the chrome preload must not require ' + name)
  }

  // eslint-disable-next-line no-new-func
  new Function('require', 'process', source)(sandboxRequire, { argv: [], platform: 'linux' })

  assert.ok(exposed, 'the preload did not expose a bridge')
  return exposed
}

test('buildPreload creates the isolated chrome preload', function () {
  const preloadPath = path.resolve(__dirname, '../dist/preload-chrome.js')

  buildPreload()

  const content = fs.readFileSync(preloadPath, 'utf-8')
  assert.match(content, /contextBridge\.exposeInMainWorld\('min'/)
  assert.match(content, /bootstrap/)
  assert.match(content, /chrome:window:minimize/)
  assert.match(content, /chrome:clipboard:write-text/)
  assert.match(content, /chrome:settings:read/)
  assert.match(content, /chrome:session:write/)
  assert.match(content, /create:\s*data\s*=>\s*ipcRenderer\.send\('createView'/)
  assert.match(content, /chrome:menu:open/)
  assert.match(content, /chrome:downloads:cancel/)
  assert.match(content, /webUtils\.getPathForFile/)
  assert.match(content, /chrome:userscripts:list/)
  assert.match(content, /chrome:userscripts:open-directory/)
  assert.match(content, /chrome:password-manager:check-tool/)
  assert.match(content, /chrome:password-manager:install-tool/)
  assert.match(content, /chrome:password-manager:read-import/)
  assert.match(content, /chrome:password-manager:prompt/)
  assert.match(content, /chrome:prompt:complete/)
  assert.match(content, /chrome:app:quit/)
  assert.match(content, /chrome:app:set-window-title/)
  assert.match(content, /chrome:app:show-secondary-menu/)
  assert.match(content, /chrome:app:write-bookmarks-backup/)
  assert.match(content, /chrome:app:hosts/)
  assert.match(content, /chrome:permissions:grant/)
  assert.match(content, /chrome:tab-state:request/)
  assert.match(content, /chrome:history:request/)
  assert.match(content, /ipcRenderer\.removeListener/)
  assert.doesNotMatch(content, /ipcRenderer:\s*{/)
  assert.doesNotMatch(content, /send:\s*\(channel/)
})

test('the chrome preload only forwards allowlisted main-process commands', function () {
  const bridge = loadBridge()

  const unsubscribe = bridge.app.onCommand('zoomIn', function () {})
  assert.equal(typeof unsubscribe, 'function')
  assert.throws(() => bridge.app.onCommand('executeJavaScript', function () {}), /not allowed/)
  assert.throws(() => bridge.app.onCommand('chrome:session:write', function () {}), /not allowed/)
})

test('the chrome bundle no longer reaches Node or Electron directly', function () {
  const bundle = fs.readFileSync(path.resolve(__dirname, '../dist/bundle.js'), 'utf-8')

  assert.doesNotMatch(bundle, /window\.electron\s*=/)
  assert.doesNotMatch(bundle, /window\.fs\s*=/)
  assert.doesNotMatch(bundle, /window\.ipc\s*=/)
  assert.doesNotMatch(bundle, /window\.EventEmitter\s*=/)
  assert.doesNotMatch(bundle, /window\.globalArgs\s*=/)
})
