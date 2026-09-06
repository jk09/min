const test = require('node:test')
const assert = require('node:assert')
const { getChromeWindow } = require('../main/chromeCapabilities')

test('chrome capability guard accepts the active chrome sender', function () {
  const sender = { id: 1 }
  const window = {}
  const registry = { windowFromContents: () => ({ win: window }) }

  assert.strictEqual(getChromeWindow({ sender }, registry, () => sender), window)
})

test('chrome capability guard rejects a non-chrome sender', function () {
  const sender = { id: 2 }
  const registry = { windowFromContents: () => undefined }

  assert.throws(
    () => getChromeWindow({ sender }, registry, () => sender),
    /chrome capability request rejected/
  )
})