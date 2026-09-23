const test = require('node:test')
const assert = require('node:assert')
const { isSerializableSettingValue } = require('../js/util/settings/settingsMain')

test('settings capability accepts JSON-compatible setting values', function () {
  assert.strictEqual(isSerializableSettingValue({ enabled: true, levels: [1, 2] }), true)
  assert.strictEqual(isSerializableSettingValue(undefined), true)
})

test('settings capability rejects malformed setting values', function () {
  assert.strictEqual(isSerializableSettingValue(Infinity), false)
  assert.strictEqual(isSerializableSettingValue(function () {}), false)
  assert.strictEqual(isSerializableSettingValue(new Date()), false)
})