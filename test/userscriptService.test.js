const test = require('node:test')
const assert = require('node:assert')
const path = require('path')
const { createUserscriptService, isUserscriptName } = require('../main/userscriptService')

test('userscript service accepts only JavaScript filenames without path components', function () {
  assert.equal(isUserscriptName('example.js'), true)
  assert.equal(isUserscriptName('example.txt'), false)
  assert.equal(isUserscriptName('../example.js'), false)
  assert.equal(isUserscriptName('nested/example.js'), false)
})

test('userscript service reads scripts from its fixed user-data directory', async function () {
  const userDataPath = path.join(path.sep, 'user-data')
  const expectedDirectory = path.join(userDataPath, 'userscripts')
  const operations = []
  const service = createUserscriptService(userDataPath, {
    fs: {
      mkdir: async directory => operations.push(['mkdir', directory]),
      readdir: async directory => {
        assert.equal(directory, expectedDirectory)
        return [
          { name: 'example.js', isFile: () => true },
          { name: 'readme.txt', isFile: () => true },
          { name: 'folder.js', isFile: () => false }
        ]
      },
      readFile: async file => {
        assert.equal(file, path.join(expectedDirectory, 'example.js'))
        return 'console.log("loaded")'
      }
    }
  })

  assert.deepEqual(await service.list(), [{ name: 'example.js', content: 'console.log("loaded")' }])
  assert.deepEqual(operations, [['mkdir', expectedDirectory]])
})
