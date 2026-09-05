const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')
const assert = require('node:assert')
const { HistoryRepository } = require('../main/historyRepository')

async function createRepository () {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'min-history-'))
  const repository = await HistoryRepository.open(path.join(directory, 'history.sqlite'))
  return { repository, directory }
}

test('stores graph visits, FTS content, notes, and sync changes in SQLite', async function () {
  const { repository, directory } = await createRepository()
  try {
    await repository.request({ action: 'updatePlace', pageData: { url: 'https://example.com/start', title: 'Start', contentDigest: 'First research page' }, flags: { isNewVisit: true } })
    await repository.request({ action: 'updatePlace', pageData: { url: 'https://example.com/guide', title: 'SQLite guide', contentDigest: 'A history research guide' }, flags: { isNewVisit: true, sourceURL: 'https://example.com/start' } })
    await repository.request({ action: 'addHistoryNote', pageData: { url: 'https://example.com/guide', text: 'Keep this migration note.' } })

    const [result] = await repository.request({ action: 'searchHistoryGraph', text: 'migration note' })
    assert.strictEqual(result.url, 'https://example.com/guide')
    assert.ok(result.stableId)
    assert.strictEqual(result.relationshipCount, 1)
    assert.strictEqual(result.notes[0].text, 'Keep this migration note.')
    assert.ok((await repository.db.get('SELECT COUNT(*) AS count FROM sync_changes')).count >= 3)
  } finally {
    await repository.db.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('creates a searchable SQLite database without a Node ABI-specific addon', async function () {
  const { repository, directory } = await createRepository()
  try {
    await repository.request({ action: 'updatePlace', pageData: { url: 'https://example.com/sqlite', title: 'SQLite', extractedText: 'full text search' }, flags: { isNewVisit: true } })
    assert.strictEqual((await repository.search('full text')).length, 1)
  } finally {
    await repository.db.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
