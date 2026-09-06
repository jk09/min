const test = require('node:test')
const assert = require('node:assert')
const { getManager, installTool, runBitwarden, runOnePassword } = require('../main/passwordManagerService')

test('password-manager service only accepts supported managers', function () {
  assert.strictEqual(getManager('bitwarden').command, 'bw')
  assert.strictEqual(getManager('onepassword').command, 'op')
  assert.throws(() => getManager('cmd'), /not allowed/)
  assert.throws(() => installTool('cmd', 'C:\\Windows\\System32\\cmd.exe'), /not allowed/)
})

test('password-manager service rejects unallowlisted operations before launching a tool', async function () {
  await assert.rejects(runBitwarden('arbitrary-command', {}), /not allowed/)
  await assert.rejects(runOnePassword('arbitrary-command', {}), /not allowed/)
})