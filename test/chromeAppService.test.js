const test = require('node:test')
const assert = require('node:assert')
const path = require('path')
const { createChromeAppService, getHostsFilePath, parseHostsFile } = require('../main/chromeAppService')

test('hosts file path is chosen by platform and never by the renderer', function () {
  assert.equal(getHostsFilePath('win32'), 'C:/Windows/System32/drivers/etc/hosts')
  assert.equal(getHostsFilePath('darwin'), '/etc/hosts')
  assert.equal(getHostsFilePath('linux'), '/etc/hosts')
})

test('hosts parsing skips comments, placeholders and duplicates', function () {
  const parsed = parseHostsFile([
    '# a comment',
    '127.0.0.1 localhost example.test',
    '127.0.0.1 example.test',
    '255.255.255.255 broadcasthost',
    ''
  ].join('\n'))

  assert.deepEqual(parsed, ['127.0.0.1', 'localhost', 'example.test'])
})

test('hosts reading resolves to an empty list when the file is unavailable', async function () {
  const service = createChromeAppService({
    userDataPath: path.join(path.sep, 'user-data'),
    platform: 'linux',
    fileSystem: {
      readFile: (file, encoding, callback) => callback(new Error('ENOENT'))
    }
  })

  assert.deepEqual(await service.readHosts(), [])
})

test('bookmarks backup is written to a main-owned path the renderer cannot choose', async function () {
  const userDataPath = path.join(path.sep, 'user-data')
  const writes = []
  const service = createChromeAppService({
    userDataPath,
    fileSystem: {
      writeFile: (file, data, options, callback) => {
        writes.push([file, data, options.encoding])
        callback(null)
      }
    }
  })

  await service.writeBookmarksBackup('<html></html>')

  assert.deepEqual(writes, [[
    path.join(userDataPath, 'bookmarksBackup.html'),
    '<html></html>',
    'utf-8'
  ]])
})

test('bookmarks backup rejects payloads that are not a non-empty string', function () {
  const service = createChromeAppService({ userDataPath: path.join(path.sep, 'user-data') })

  assert.throws(() => service.writeBookmarksBackup(''), TypeError)
  assert.throws(() => service.writeBookmarksBackup(null), TypeError)
  assert.throws(() => service.writeBookmarksBackup({ path: '/etc/passwd' }), TypeError)
})
