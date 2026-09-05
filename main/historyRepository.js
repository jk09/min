const crypto = require('crypto')
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const { createContentDigest, canonicalizeURL } = require('../js/places/historyGraph')

class HistoryRepository {
  static async open (filename) {
    const repository = new HistoryRepository()
    repository.db = await open({ filename, driver: sqlite3.Database })
    await repository.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS pages (id INTEGER PRIMARY KEY, stable_id TEXT UNIQUE NOT NULL, url TEXT UNIQUE NOT NULL, canonical_url TEXT, title TEXT NOT NULL, visit_count INTEGER NOT NULL DEFAULT 0, first_visit INTEGER, last_visit INTEGER, active_dwell_time INTEGER NOT NULL DEFAULT 0, attention_score REAL NOT NULL DEFAULT 0, extracted_text TEXT, content_digest TEXT, is_bookmarked INTEGER NOT NULL DEFAULT 0, tags_json TEXT NOT NULL DEFAULT "[]", metadata_json TEXT NOT NULL DEFAULT "{}"); CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY, page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE, visited_at INTEGER NOT NULL, tab_id TEXT, source_page_id INTEGER REFERENCES pages(id)); CREATE TABLE IF NOT EXISTS navigation_edges (id INTEGER PRIMARY KEY, source_page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE, destination_page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE, visited_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, stable_id TEXT UNIQUE NOT NULL, page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE, text TEXT NOT NULL, updated_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS sync_changes (id INTEGER PRIMARY KEY, change_id TEXT UNIQUE NOT NULL, entity_type TEXT NOT NULL, entity_stable_id TEXT NOT NULL, operation TEXT NOT NULL, changed_at INTEGER NOT NULL, tombstone INTEGER NOT NULL DEFAULT 0); CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(url, title, content_digest, extracted_text, notes);')
    return repository
  }

  async index (page) {
    const notes = await this.db.all('SELECT text FROM notes WHERE page_id=? ORDER BY updated_at DESC', page.id)
    await this.db.run('DELETE FROM history_fts WHERE rowid=?', page.id)
    await this.db.run('INSERT INTO history_fts (rowid,url,title,content_digest,extracted_text,notes) VALUES (?,?,?,?,?,?)', page.id, page.url, page.title, page.content_digest || '', page.extracted_text || '', notes.map(note => note.text).join('\n'))
  }

  async save (data, flags = {}) {
    const now = Date.now()
    let page = await this.db.get('SELECT * FROM pages WHERE url=?', data.url)
    if (!page) {
      const result = await this.db.run('INSERT INTO pages (stable_id,url,canonical_url,title,first_visit,last_visit,extracted_text,content_digest) VALUES (?,?,?,?,?,?,?,?)', crypto.randomUUID(), data.url, data.canonicalURL || canonicalizeURL(data.url), data.title || data.url, now, now, data.extractedText || '', data.contentDigest || createContentDigest(data.extractedText))
      page = await this.db.get('SELECT * FROM pages WHERE id=?', result.lastID)
    }
    const visits = page.visit_count + Number(Boolean(flags.isNewVisit))
    await this.db.run('UPDATE pages SET title=?,canonical_url=?,extracted_text=?,content_digest=?,visit_count=?,last_visit=? WHERE id=?', data.title || page.title, data.canonicalURL || page.canonical_url, data.extractedText === undefined ? page.extracted_text : data.extractedText, data.contentDigest === undefined ? page.content_digest : data.contentDigest, visits, flags.isNewVisit ? now : page.last_visit, page.id)
    page = await this.db.get('SELECT * FROM pages WHERE id=?', page.id)
    if (flags.isNewVisit) {
      const source = flags.sourceURL ? await this.db.get('SELECT id FROM pages WHERE url=?', flags.sourceURL) : null
      await this.db.run('INSERT INTO visits (page_id,visited_at,tab_id,source_page_id) VALUES (?,?,?,?)', page.id, now, flags.tabId || null, source && source.id)
      if (source && source.id !== page.id) await this.db.run('INSERT INTO navigation_edges (source_page_id,destination_page_id,visited_at) VALUES (?,?,?)', source.id, page.id, now)
    }
    await this.index(page)
    await this.db.run('INSERT INTO sync_changes (change_id,entity_type,entity_stable_id,operation,changed_at,tombstone) VALUES (?,?,?,?,?,0)', crypto.randomUUID(), 'page', page.stable_id, 'upsert', now)
    return { id: page.id, stableId: page.stable_id }
  }

  async search (query, limit = 100) {
    const terms = String(query || '').trim().split(/\s+/).filter(Boolean).map(term => '"' + term.replace(/"/g, '') + '"').join(' AND ')
    const rows = terms ? await this.db.all('SELECT pages.* FROM history_fts JOIN pages ON pages.id=history_fts.rowid WHERE history_fts MATCH ? LIMIT ?', terms, limit) : await this.db.all('SELECT * FROM pages ORDER BY last_visit DESC LIMIT ?', limit)
    return Promise.all(rows.map(async page => ({ ...page, stableId: page.stable_id, canonicalURL: page.canonical_url, visitCount: page.visit_count, lastVisit: page.last_visit, contentDigest: page.content_digest, notes: await this.db.all('SELECT id,text,updated_at AS updatedAt FROM notes WHERE page_id=?', page.id), relationshipCount: (await this.db.get('SELECT COUNT(*) AS count FROM navigation_edges WHERE source_page_id=? OR destination_page_id=?', page.id, page.id)).count })))
  }

  async request (request) {
    const data = request.pageData || {}
    if (request.action === 'updatePlace') return this.save(data, request.flags)
    if (request.action === 'searchHistoryGraph' || request.action === 'searchPlaces' || request.action === 'searchPlacesFullText') return this.search(request.text, request.options && request.options.limit)
    if (request.action === 'getAllPlaces' || request.action === 'getPlaceSuggestions') return this.search('', 100)
    return null
  }
}

module.exports = { HistoryRepository }
