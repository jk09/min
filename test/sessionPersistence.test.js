const test = require('node:test')
const assert = require('node:assert')
const { createSessionPersistence, parseSessionData } = require('../main/sessionPersistence')

const validSession = JSON.stringify({ version: 2, state: { tasks: [] }, saveTime: Date.now() })

test('session persistence writes only validated session snapshots to its fixed path', async function () {
  let writtenPath = null
  const persistence = createSessionPersistence({
    userDataPath: '/profile',
    fileSystem: { promises: { readFile: async () => null } },
    atomicWrite: function (filePath, data, options, callback) {
      writtenPath = filePath
      callback()
    }
  })

  await persistence.write(validSession)

  assert.strictEqual(writtenPath, require('path').join('/profile', 'sessionRestore.json'))
})

test('session persistence rejects malformed snapshots before writing', function () {
  assert.throws(() => parseSessionData('{'), /valid JSON/)
  assert.throws(() => parseSessionData(JSON.stringify({ version: 1 })), /invalid shape/)
  assert.throws(() => parseSessionData({}), /must be a string/)
})