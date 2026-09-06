require('../scripts/registerTs.js')
const test = require('node:test')
const assert = require('node:assert')
const { CHROME_BRIDGE_CAPABILITIES } = require('../js/preload/chromeBridgeContract')

test('chrome bridge contract exposes named least-privilege capabilities', function () {
  assert.deepStrictEqual(CHROME_BRIDGE_CAPABILITIES.bootstrap, ['appVersion', 'developmentMode', 'platform', 'windowId'])
  assert.deepStrictEqual(CHROME_BRIDGE_CAPABILITIES.window, ['close', 'maximize', 'minimize', 'setFullScreen', 'unmaximize'])
  assert.deepStrictEqual(CHROME_BRIDGE_CAPABILITIES.clipboard, ['readText', 'writeText'])
  assert.ok(Object.isFrozen(CHROME_BRIDGE_CAPABILITIES))

  const capabilityNames = Object.keys(CHROME_BRIDGE_CAPABILITIES)
  assert.ok(!capabilityNames.includes('ipc'))
  assert.ok(!capabilityNames.includes('fs'))
  assert.ok(!capabilityNames.includes('electron'))
})
