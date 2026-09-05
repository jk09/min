const crypto = require('crypto')
const Database = require('better-sqlite3')
const { createContentDigest, canonicalizeURL } = require('../js/places/historyGraph')

function parseJSON (value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function prepareSearchQuery (query) {
  return String(query || '').trim().split(/\s+/).filter(Boolean).map(function (term) {
    return '"' + term.replace(/"/g, '') + '"'
  }).join(' AND ')
}

class HistoryRepository {
  constructor (databasePath) {
    this.db = new Database(databasePath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.migrate()
  }

  migrate () {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY,
        stable_id TEXT NOT NULL UNIQUE,
        legacy_id INTEGER UNIQUE,
        url TEXT NOT NULL UNIQUE,
        canonical_url TEXT,
        title TEXT NOT NULL,
        color TEXT,
        visit_count INTEGER NOT NULL DEFAULT 0,
        first_visit INTEGER,
        last_visit INTEGER,
        active_dwell_time INTEGER NOT NULL DEFAULT 0,
        attention_score REAL NOT NULL DEFAULT 0,
        extracted_text TEXT,
        content_digest TEXT,
        is_bookmarked INTEGER NOT NULL DEFAULT 0,
        tags_json TEXT NOT NULL DEFAULT '[]',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        deleted_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY,
        page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        visited_at INTEGER NOT NULL,
        tab_id TEXT,
        source_page_id INTEGER REFERENCES pages(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS navigation_edges (
        id INTEGER PRIMARY KEY,
        source_page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        destination_page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        visited_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY,
        stable_id TEXT NOT NULL UNIQUE,
        page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS page_enrichments (
        id INTEGER PRIMARY KEY,
        page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        source_version TEXT,
        provider TEXT,
        model TEXT,
        status TEXT NOT NULL,
        output_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sync_changes (
        id INTEGER PRIMARY KEY,
        change_id TEXT NOT NULL UNIQUE,
        entity_type TEXT NOT NULL,
        entity_stable_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        changed_at INTEGER NOT NULL,
        tombstone INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS pages_last_visit_index ON pages(last_visit DESC);
      CREATE INDEX IF NOT EXISTS visits_page_time_index ON visits(page_id, visited_at DESC);
      CREATE INDEX IF NOT EXISTS edges_source_index ON navigation_edges(source_page_id, visited_at DESC);
      CREATE INDEX IF NOT EXISTS edges_destination_index ON navigation_edges(destination_page_id, visited_at DESC);
      CREATE INDEX IF NOT EXISTS notes_page_index ON notes(page_id, updated_at DESC);
      CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(url, title, content_digest, extracted_text, notes);
    `)
  }

  recordChange (entityType, entityStableId, operation, timestamp, tombstone) {
    this.db.prepare('INSERT INTO sync_changes (change_id, entity_type, entity_stable_id, operation, changed_at, tombstone) VALUES (?, ?, ?, ?, ?, ?)').run(
      crypto.randomUUID(), entityType, entityStableId, operation, timestamp, tombstone ? 1 : 0
    )
  }

  indexPage (page) {
    const notes = this.db.prepare('SELECT text FROM notes WHERE page_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC').all(page.id).map(note => note.text).join('\n')
    this.db.prepare('DELETE FROM history_fts WHERE rowid = ?').run(page.id)
    this.db.prepare('INSERT INTO history_fts (rowid, url, title, content_digest, extracted_text, notes) VALUES (?, ?, ?, ?, ?, ?)').run(
      page.id, page.url, page.title, page.content_digest || '', page.extracted_text || '', notes
    )
  }

  savePage (pageData, flags = {}) {
    const timestamp = Date.now()
    return this.db.transaction(() => {
      let page = this.db.prepare('SELECT * FROM pages WHERE url = ?').get(pageData.url)
      if (!page) {
        page = {
          stable_id: crypto.randomUUID(),
          url: pageData.url,
          canonical_url: pageData.canonicalURL || canonicalizeURL(pageData.url),
          title: pageData.title || pageData.url,
          color: pageData.color || null,
          visit_count: 0,
          first_visit: timestamp,
          last_visit: timestamp,
          active_dwell_time: 0,
          attention_score: 0,
          extracted_text: pageData.extractedText || '',
          content_digest: pageData.contentDigest || createContentDigest(pageData.extractedText),
          is_bookmarked: 0,
          tags_json: '[]',
          metadata_json: '{}'
        }
        const result = this.db.prepare(`INSERT INTO pages (stable_id, url, canonical_url, title, color, first_visit, last_visit, extracted_text, content_digest, tags_json, metadata_json)
          VALUES (@stable_id, @url, @canonical_url, @title, @color, @first_visit, @last_visit, @extracted_text, @content_digest, @tags_json, @metadata_json)`).run(page)
        page.id = Number(result.lastInsertRowid)
      }

      const next = {
        ...page,
        canonical_url: pageData.canonicalURL || page.canonical_url,
        title: pageData.title || page.title,
        color: pageData.color === undefined ? page.color : pageData.color,
        extracted_text: pageData.extractedText === undefined ? page.extracted_text : pageData.extractedText,
        content_digest: pageData.contentDigest === undefined ? page.content_digest : pageData.contentDigest,
        tags_json: pageData.tags === undefined ? page.tags_json : JSON.stringify(pageData.tags),
        metadata_json: pageData.metadata === undefined ? page.metadata_json : JSON.stringify(pageData.metadata),
        is_bookmarked: pageData.isBookmarked === undefined ? page.is_bookmarked : (pageData.isBookmarked ? 1 : 0),
        visit_count: page.visit_count + (flags.isNewVisit ? 1 : 0),
        last_visit: flags.isNewVisit ? timestamp : page.last_visit
      }
      this.db.prepare(`UPDATE pages SET canonical_url = @canonical_url, title = @title, color = @color, extracted_text = @extracted_text,
        content_digest = @content_digest, tags_json = @tags_json, metadata_json = @metadata_json, is_bookmarked = @is_bookmarked, visit_count = @visit_count, last_visit = @last_visit WHERE id = @id`).run(next)
      page = this.db.prepare('SELECT * FROM pages WHERE id = ?').get(page.id)

      if (flags.isNewVisit) {
        const source = flags.sourceURL ? this.db.prepare('SELECT id FROM pages WHERE url = ?').get(flags.sourceURL) : null
        this.db.prepare('INSERT INTO visits (page_id, visited_at, tab_id, source_page_id) VALUES (?, ?, ?, ?)').run(page.id, timestamp, flags.tabId || null, source ? source.id : null)
        if (source && source.id !== page.id) {
          this.db.prepare('INSERT INTO navigation_edges (source_page_id, destination_page_id, visited_at) VALUES (?, ?, ?)').run(source.id, page.id, timestamp)
        }
      }
      this.indexPage(page)
      this.recordChange('page', page.stable_id, 'upsert', timestamp, false)
      return { id: page.id, stableId: page.stable_id }
    })()
  }

  recordAttention (url, duration) {
    const page = this.db.prepare('SELECT * FROM pages WHERE url = ?').get(url)
    if (!page || !duration) return
    const activeDwellTime = page.active_dwell_time + duration
    const attentionScore = Math.min(1, activeDwellTime / (10 * 60 * 1000))
    this.db.prepare('UPDATE pages SET active_dwell_time = ?, attention_score = ? WHERE id = ?').run(activeDwellTime, attentionScore, page.id)
    this.recordChange('page', page.stable_id, 'upsert', Date.now(), false)
  }

  saveNote (url, text, id) {
    const page = this.db.prepare('SELECT * FROM pages WHERE url = ?').get(url)
    if (!page) return null
    const timestamp = Date.now()
    const existing = id ? this.db.prepare('SELECT * FROM notes WHERE id = ? AND page_id = ?').get(id, page.id) : null
    const noteId = existing ? existing.id : Number(this.db.prepare('INSERT INTO notes (stable_id, page_id, text, updated_at) VALUES (?, ?, ?, ?)').run(crypto.randomUUID(), page.id, text, timestamp).lastInsertRowid)
    if (existing) this.db.prepare('UPDATE notes SET text = ?, updated_at = ?, deleted_at = NULL WHERE id = ?').run(text, timestamp, noteId)
    this.indexPage(page)
    this.recordChange('note', existing ? existing.stable_id : this.db.prepare('SELECT stable_id FROM notes WHERE id = ?').get(noteId).stable_id, 'upsert', timestamp, false)
    return noteId
  }

  search (query, limit = 100) {
    const ftsQuery = prepareSearchQuery(query)
    const rows = ftsQuery
      ? this.db.prepare(`SELECT pages.*, bm25(history_fts) AS text_rank FROM history_fts JOIN pages ON pages.id = history_fts.rowid
        WHERE history_fts MATCH ? AND pages.deleted_at IS NULL ORDER BY text_rank LIMIT ?`).all(ftsQuery, limit)
      : this.db.prepare('SELECT pages.*, 0 AS text_rank FROM pages WHERE deleted_at IS NULL ORDER BY last_visit DESC LIMIT ?').all(limit)
    return rows.map(page => this.formatPage(page))
  }

  getPage (url) {
    const page = this.db.prepare('SELECT pages.*, 0 AS text_rank FROM pages WHERE url = ? AND deleted_at IS NULL').get(url)
    return page ? this.formatPage(page) : null
  }

  deletePage (url) {
    return this.db.transaction(() => {
      const page = this.db.prepare('SELECT * FROM pages WHERE url = ?').get(url)
      if (!page) return
      this.db.prepare('DELETE FROM history_fts WHERE rowid = ?').run(page.id)
      this.db.prepare('DELETE FROM pages WHERE id = ?').run(page.id)
      this.recordChange('page', page.stable_id, 'delete', Date.now(), true)
    })()
  }

  deleteHistory () {
    return this.db.transaction(() => {
      const pages = this.db.prepare('SELECT id, stable_id FROM pages WHERE is_bookmarked = 0').all()
      pages.forEach(page => {
        this.db.prepare('DELETE FROM history_fts WHERE rowid = ?').run(page.id)
        this.db.prepare('DELETE FROM pages WHERE id = ?').run(page.id)
        this.recordChange('page', page.stable_id, 'delete', Date.now(), true)
      })
    })()
  }

  importLegacy (legacy) {
    return this.db.transaction(() => {
      if (this.db.prepare('SELECT 1 FROM schema_migrations WHERE version = 2').get()) return
      const pageIds = new Map()
      ;(legacy.places || []).forEach(place => {
        const existing = this.db.prepare('SELECT id FROM pages WHERE legacy_id = ?').get(place.id)
        if (existing) {
          pageIds.set(place.id, existing.id)
          return
        }
        const result = this.db.prepare(`INSERT INTO pages (stable_id, legacy_id, url, canonical_url, title, color, visit_count, first_visit, last_visit,
          active_dwell_time, attention_score, extracted_text, content_digest, is_bookmarked, tags_json, metadata_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          crypto.randomUUID(), place.id, place.url, place.canonicalURL || canonicalizeURL(place.url), place.title || place.url, place.color || null,
          place.visitCount || 0, place.firstVisit || place.lastVisit || Date.now(), place.lastVisit || Date.now(), place.activeDwellTime || 0,
          place.attentionScore || 0, place.extractedText || '', place.contentDigest || createContentDigest(place.extractedText), place.isBookmarked ? 1 : 0,
          JSON.stringify(place.tags || []), JSON.stringify(place.metadata || {})
        )
        const pageId = Number(result.lastInsertRowid)
        pageIds.set(place.id, pageId)
        this.indexPage(this.db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId))
      })
      ;(legacy.notes || []).forEach(note => {
        const pageId = pageIds.get(note.placeId)
        if (pageId) this.db.prepare('INSERT OR IGNORE INTO notes (id, stable_id, page_id, text, updated_at) VALUES (?, ?, ?, ?, ?)').run(note.id, crypto.randomUUID(), pageId, note.text || '', note.updatedAt || Date.now())
      })
      ;(legacy.visits || []).forEach(visit => {
        const pageId = pageIds.get(visit.placeId)
        if (pageId) this.db.prepare('INSERT OR IGNORE INTO visits (id, page_id, visited_at, tab_id, source_page_id) VALUES (?, ?, ?, ?, ?)').run(visit.id, pageId, visit.visitedAt, visit.tabId || null, pageIds.get(visit.sourcePlaceId) || null)
      })
      ;(legacy.navigationEdges || []).forEach(edge => {
        const source = pageIds.get(edge.sourcePlaceId)
        const destination = pageIds.get(edge.destinationPlaceId)
        if (source && destination) this.db.prepare('INSERT OR IGNORE INTO navigation_edges (id, source_page_id, destination_page_id, visited_at) VALUES (?, ?, ?, ?)').run(edge.id, source, destination, edge.visitedAt)
      })
      pageIds.forEach(pageId => {
        this.indexPage(this.db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId))
      })
      this.db.prepare('INSERT INTO schema_migrations (version) VALUES (2)').run()
    })()
  }

  formatPage (page) {
    const notes = this.db.prepare('SELECT id, stable_id AS stableId, text, updated_at AS updatedAt FROM notes WHERE page_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC').all(page.id)
    const relationshipCount = this.db.prepare('SELECT COUNT(*) AS count FROM navigation_edges WHERE source_page_id = ? OR destination_page_id = ?').get(page.id, page.id).count
    const ageDays = Math.max(0, (Date.now() - (page.last_visit || 0)) / 86400000)
    const relevance = Math.max(0, -(page.text_rank || 0) * 20) + Math.log2(page.visit_count + 1) * 8 + Math.log2(page.active_dwell_time + 1) * 2 + page.attention_score * 10 + 30 / (1 + ageDays)
    return {
      id: page.id,
      stableId: page.stable_id,
      url: page.url,
      canonicalURL: page.canonical_url,
      title: page.title,
      color: page.color,
      visitCount: page.visit_count,
      firstVisit: page.first_visit,
      lastVisit: page.last_visit,
      activeDwellTime: page.active_dwell_time,
      attentionScore: page.attention_score,
      extractedText: page.extracted_text,
      contentDigest: page.content_digest,
      isBookmarked: Boolean(page.is_bookmarked),
      tags: parseJSON(page.tags_json, []),
      metadata: parseJSON(page.metadata_json, {}),
      notes,
      relationshipCount,
      relevance
    }
  }

  request (request) {
    const pageData = request.pageData || {}
    if (request.action === 'updatePlace') return this.savePage(pageData, request.flags)
    if (request.action === 'recordAttention') return this.recordAttention(pageData.url, pageData.duration)
    if (request.action === 'addHistoryNote') return this.saveNote(pageData.url, pageData.text, pageData.id)
    if (request.action === 'searchHistoryGraph' || request.action === 'searchPlaces' || request.action === 'searchPlacesFullText') return this.search(request.text, request.options && request.options.limit)
    if (request.action === 'getPlace') return this.getPage(pageData.url)
    if (request.action === 'getAllPlaces') return this.search('')
    if (request.action === 'getPlaceSuggestions') return this.search('', 100)
    if (request.action === 'deleteHistory') return this.deletePage(pageData.url)
    if (request.action === 'deleteAllHistory') return this.deleteHistory()
    if (request.action === 'importLegacyHistory') return this.importLegacy(request.legacy)
    if (request.action === 'getSuggestedTags' || request.action === 'getAllTagsRanked' || request.action === 'getSuggestedItemsForTags' || request.action === 'autocompleteTags') return []
    return null
  }

  close () { this.db.close() }
}

module.exports = { HistoryRepository }
