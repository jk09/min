const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { ALLOWED_VIEW_METHODS, sanitizeViewWebPreferences } = require('../main/viewPreferences')

test('view creation accepts only the partitions the renderer may ask for', function () {
  assert.deepEqual(sanitizeViewWebPreferences({ partition: 'persist:webcontent' }), { partition: 'persist:webcontent' })
  // private tabs get their own session, named after the numeric tab id
  assert.deepEqual(sanitizeViewWebPreferences({ partition: '1738104999' }), { partition: '1738104999' })
})

test('view creation rejects an unknown or malformed partition', function () {
  assert.throws(() => sanitizeViewWebPreferences({ partition: 'persist:chrome' }), /partition is not allowed/)
  assert.throws(() => sanitizeViewWebPreferences({ partition: '../../etc' }), /partition is not allowed/)
  assert.throws(() => sanitizeViewWebPreferences({}), /partition is not allowed/)
  assert.throws(() => sanitizeViewWebPreferences({ partition: 42 }), /partition is not allowed/)
})

test('a renderer cannot merge privileged web preferences into a content view', function () {
  const hostile = {
    partition: 'persist:webcontent',
    nodeIntegration: true,
    sandbox: false,
    contextIsolation: false,
    preload: '/tmp/evil.js',
    webSecurity: false
  }

  // only the partition survives; everything else is decided by the main process
  assert.deepEqual(sanitizeViewWebPreferences(hostile), { partition: 'persist:webcontent' })
})

test('the main process allowlists view methods independently of the preload', function () {
  assert.ok(ALLOWED_VIEW_METHODS.includes('goBack'))
  assert.ok(ALLOWED_VIEW_METHODS.includes('executeJavaScript'))
  assert.ok(!ALLOWED_VIEW_METHODS.includes('loadURL'))
  assert.ok(!ALLOWED_VIEW_METHODS.includes('session'))
  assert.ok(Object.isFrozen(ALLOWED_VIEW_METHODS))
})

test('the preload and the main process agree on the view method allowlist', function () {
  const preload = fs.readFileSync(path.resolve(__dirname, '../js/preload/browserChrome.js'), 'utf-8')
  const declared = preload.slice(preload.indexOf('const VIEW_METHODS'), preload.indexOf('])', preload.indexOf('const VIEW_METHODS')))

  ALLOWED_VIEW_METHODS.forEach(function (method) {
    assert.ok(declared.includes("'" + method + "'"), method + ' is allowed in main but missing from the preload allowlist')
  })
})
