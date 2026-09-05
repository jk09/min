const test = require('node:test')
const assert = require('node:assert')

const sessionSidebarState = require('../js/navbar/sessionSidebarState.js')

test('session descriptions prefer titles and fall back to domains', function () {
  assert.strictEqual(
    sessionSidebarState.getSessionDescription({ title: 'Example page', url: 'https://example.com/path' }),
    'Example page'
  )
  assert.strictEqual(
    sessionSidebarState.getSessionDescription({ title: '', url: 'https://www.example.com/path' }),
    'www.example.com'
  )
  assert.strictEqual(sessionSidebarState.getSessionDescription({}), 'New tab')
})

test('session descriptions are truncated to a stable readable length', function () {
  const description = sessionSidebarState.getSessionDescription({ title: 'a'.repeat(200) })

  assert.strictEqual(description.length, sessionSidebarState.MAX_DESCRIPTION_LENGTH)
  assert.ok(description.endsWith('\u2026'))
})

test('session items retain every live tab and mark the selected tab', function () {
  const items = sessionSidebarState.getSessionItems([
    { id: 'first', title: 'First page' },
    { id: 'second', url: 'https://example.com' }
  ], 'second')

  assert.deepStrictEqual(items, [
    { id: 'first', description: 'First page', selected: false },
    { id: 'second', description: 'example.com', selected: true }
  ])
})
