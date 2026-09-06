const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const buildPreload = require('../scripts/buildPreload')

test('buildPreload creates the isolated chrome preload', function () {
  const preloadPath = path.resolve(__dirname, '../dist/preload-chrome.js')

  buildPreload()

  const content = fs.readFileSync(preloadPath, 'utf-8')
  assert.match(content, /contextBridge\.exposeInMainWorld\('min'/)
  assert.match(content, /bootstrap/)
  assert.match(content, /chrome:window:minimize/)
  assert.match(content, /chrome:clipboard:write-text/)
  assert.doesNotMatch(content, /ipcRenderer:\s*{/)
})
