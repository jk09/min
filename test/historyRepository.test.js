const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')
const assert = require('node:assert')
const { HistoryRepository } = require('../main/historyRepository')

function createRepository () {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'min-history-'))
  const repository = new HistoryRepository(path.join(directory, 'history.sqlite'))
  return { repository, directory }
}

test('stores graph visits, FTS content, notes, and sync changes in SQLite', function () {
  const { repository, directory } = createRepository()
  try {
    repository.request({ action: 'updatePlace', pageData: { url: 'https://example.com/start', title: 'Start', contentDigest: 'First research page' }, flags: { isNewVisit: true } })
    repository.request({ action: 'updatePlace', pageData: { url: 'https://example.com/guide', title: 'SQLite guide', contentDigest: 'A history research guide' }, flags: { isNewVisit: true, sourceURL: 'https://example.com/start' } })
    repository.request({ action: 'addHistoryNote', pageData: { url: 'https://example.com/guide', text: 'Use this for migration notes.' } })

    const [result] = repository.request({ action: 'searchHistoryGraph', text: 'migration notes' })
    assert.strictEqual(result.url, 'https://example.com/guide')
    assert.ok(result.stableId)
    assert.strictEqual(result.relationshipCount, 1)
    assert.strictEqual(result.notes[0].text, 'Use this for migration notes.')
    assert.ok(repository.db.prepare('SELECT COUNT(*) AS count FROM sync_changes').get().count >= 3)
  } finally {
    repository.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('imports version 2 IndexedDB graph records once with preserved relationships', function () {
  const { repository, directory } = createRepository()
  try {
    const legacy = {
      places: [
        { id: 1, url: 'https://example.com/start', title: 'Start', visitCount: 1 },
        { id: 2, url: 'https://example.com/guide', title: 'Guide', extractedText: 'SQLite migration reference', visitCount: 2 }
      ],
      visits: [{ id: 1, placeId: 2, visitedAt: 100, sourcePlaceId: 1 }],
      navigationEdges: [{ id: 1, sourcePlaceId: 1, destinationPlaceId: 2, visitedAt: 100 }],
      notes: [{ id: 1, placeId: 2, text: 'Preserve this note', updatedAt: 100 }]
    }
    repository.importLegacy(legacy)
    repository.importLegacy(legacy)

    const [result] = repository.search('preserve')
    assert.strictEqual(result.url, 'https://example.com/guide')
    assert.strictEqual(result.notes.length, 1)
    assert.strictEqual(result.relationshipCount, 1)
  } finally {
    repository.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
