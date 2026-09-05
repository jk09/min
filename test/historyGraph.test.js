const test = require('node:test')
const assert = require('node:assert')
const historyGraph = require('../js/places/historyGraph.js')

test('canonicalizes URL identity without fragments or credentials', function () {
  assert.strictEqual(
    historyGraph.canonicalizeURL('https://person:secret@example.com/guide#section'),
    'https://example.com/guide'
  )
})

test('creates a normalized bounded content digest', function () {
  const digest = historyGraph.createContentDigest(` a\n\n${'word '.repeat(3000)}`)

  assert.ok(digest.length <= historyGraph.MAX_DIGEST_LENGTH)
  assert.ok(!digest.includes('\n'))
})

test('ranks matching and attended history above an otherwise identical page', function () {
  const now = Date.UTC(2026, 8, 5)
  const base = { url: 'https://example.com', title: 'Research guide', lastVisit: now - 1000 }
  const attended = historyGraph.calculateHistoryRelevance({ ...base, visitCount: 4, activeDwellTime: 5000, attentionScore: 1 }, 'research', now)
  const unvisited = historyGraph.calculateHistoryRelevance({ ...base, visitCount: 0, activeDwellTime: 0, attentionScore: 0 }, '', now)

  assert.ok(attended > unvisited)
})
