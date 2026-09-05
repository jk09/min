# Feature Specification Template

## 1. Feature Title
- **Feature name:** SQLite-backed personal history graph
- **Created on:** 2026-09-05 17:51:39 +02:00
- **Owner:** Jozef Košík <jozef.kosik@gmail.com>

## 2. Summary
Replace Min's IndexedDB/Dexie history persistence with a local SQLite database. Preserve the current history graph contract while adding native full-text search, efficient relational graph queries, an extensible LLM retrieval model, and durable change tracking for future incremental cloud synchronization.

- **Problem statement:** The current `browsingData2` Dexie database stores `places`, `visits`, `navigationEdges`, and `notes`, but full-text search, graph aggregation, and LLM retrieval depend substantially on JavaScript memory caches and application-side filtering. This approach becomes less suitable as history size and query complexity grow.
- **Desired outcome:** Min uses one local SQLite history database as the authoritative store, exposes the same history features without data loss, and provides indexed SQL/FTS queries and a future-ready synchronization change log.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** `js/util/database.js` opens Dexie database `browsingData2`. Its version 2 schema stores URL-keyed `places` records plus `visits`, `navigationEdges`, and `notes`. `placesService` maintains an in-memory cache, tokenizes extracted text, creates a bounded content digest, calculates relevance in JavaScript, and returns graph results to the internal history page and LLM tools. The history graph page is a singleton, excluded from browsing-history collection and session navigation.
- **Motivation:** SQLite supports large local datasets, transactions, indexes, joins, recursive graph traversal, FTS5 full-text search, schema migrations, and explainable query plans. It is a better foundation for extensive history search, summarization, research-note collation, and future incremental sync.
- **Related issues or references:** [Feature spec generator instructions](feature-spec-generator-skill.md). Superseding implementation target: active `personal-history-graph` feature. Relevant current files include `js/util/database.js`, `js/places/places.js`, `js/places/placesService.js`, `js/places/historyGraph.js`, and `js/llmPrompt/tools/browserTools.js`.

## 4. Goals
List the primary outcomes this feature should achieve.

- Goal 1: Make SQLite the sole authoritative local persistence layer for history, page graph data, notes, and activity statistics.
- Goal 2: Preserve compatibility with current IndexedDB records and public places/history APIs while replacing application-side full-text and graph querying with indexed SQLite queries.
- Goal 3: Provide an extensible, local-first data model for LLM retrieval and future incremental cloud synchronization.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Non-goal 1: Implementing cloud synchronization, account management, conflict-resolution UI, or sending history to a remote service.
- Non-goal 2: Changing the history page's singleton/session-navigation behavior, replacing the LLM prompt runtime, or adding a mandatory embedding/vector database.

## 6. User Stories
Capture the expected user experience.

- As an existing Min user, I want my existing history, bookmarks, tags, notes, page digests, visits, and navigation relationships retained after the migration so that I lose no personal browsing knowledge.
- As a researcher, I want fast searches over a large history by URL, title, content digest, notes, metadata, and relationships so that I can recover prior research paths.
- As a person using a local LLM, I want structured, relevant, provenance-rich history results so that the browser can support summarization and research-note collation without exporting my data.
- As a person who may enable sync later, I want local changes recorded consistently so that an opt-in incremental sync can be built without redesigning the database.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. Store history in a per-profile local SQLite database managed outside renderer IndexedDB, with migration/version tracking and serialized access through a defined history repository API.
2. Import all compatible `browsingData2` data exactly once: `places`, `visits`, `navigationEdges`, and `notes`, preserving existing stable local IDs where possible and remapping foreign keys deterministically when required.
3. Preserve the current page record contract: URL, canonical URL, title, color, bookmark/tag fields, metadata, visit count, first/last visit, active dwell time, attention score, extracted text, and bounded content digest.
4. Represent graph records using relational tables for pages, visits, navigation edges, and notes, with foreign keys and indexes supporting direct lookup, page-to-page traversal, chronological visit lookup, and deletion cleanup.
5. Use SQLite FTS5 for searchable page fields and notes. Search must support URL, title, content digest, extracted text when retained, metadata fields selected for indexing, and user notes.
6. Return structured history results compatible with current consumers, including stable page IDs, URLs, titles, digests, notes, visit statistics, relationship counts, relevance, and enough provenance for LLM tools to cite source pages and navigation context.
7. Move relevance calculation into a documented SQL query or repository-level deterministic scorer that combines text relevance, recency, visit frequency, active dwell time, attention, and notes.
8. Preserve history privacy behavior: private pages and unrepresented internal pages remain excluded; the internal history graph page remains a singleton excluded from history collection, breadcrumbs, and the session sidebar.
9. Support single-page deletion and full-history deletion transactionally, including associated visits, edges, notes, FTS rows, and future sync records while preserving bookmarks according to existing product behavior.
10. Add an append-only local change log with operation type, entity type, entity ID, changed-at timestamp, device-local change ID, and tombstone support. The log must be local-only in this feature and enable future incremental cloud sync.
11. Keep LLM enrichment optional and non-blocking. Store enrichment output with source/content version, model/provider provenance, status, and timestamps so stale summaries can be detected and regenerated.

## 8. Non-Functional Requirements
Capture quality and system constraints.

- Performance: Indexed queries and FTS searches should return initial result sets promptly on a history containing at least 100,000 page records. Writes and background enrichment must not visibly delay navigation.
- Reliability: Use transactional migrations, backups or a recoverable import checkpoint, idempotent import markers, integrity checks, and a fallback path until SQLite import is verified.
- Security: Keep the database local by default; prevent SQL injection through parameterized queries; keep page content as inert data; and require explicit consent before any future remote model or sync use.
- Accessibility: Preserve keyboard-accessible history search, result inspection, note editing, and reopening workflows.
- Compatibility: Support Min's packaged Windows, macOS, and Linux builds. Select a maintained Electron-compatible SQLite library with dependable prebuilt/native-module packaging or a suitable bundled alternative.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- User flow: Existing history and the dedicated history page continue to work without an import prompt in the normal case. On a recoverable migration failure, present a clear retry/diagnostic path without deleting IndexedDB data.
- Visual considerations: No redesign is required. Keep the dense history list, note controls, sidebar history icon, and current singleton behavior.
- Edge cases: Handle partial/corrupt IndexedDB records, duplicate URLs, URL canonicalization changes, interrupted import, a database locked by another process, FTS corruption, migration rollback, deleted records represented as sync tombstones, and an LLM unavailable during enrichment.

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- Proposed approach: Use SQLite with WAL mode, foreign keys enabled, explicit migrations, FTS5, and a repository layer in the Electron main process. Renderer code communicates through a narrow IPC API rather than opening the database directly. Prefer a maintained Electron-compatible SQLite binding such as `better-sqlite3` only after confirming Electron 42 and all release packaging targets; otherwise select an equivalent library with prepared statements, FTS5, transactions, and migration support.
- Data model: Use `pages` (stable UUID plus legacy ID mapping), `visits`, `navigation_edges`, `notes`, `page_enrichments`, `history_fts`, `schema_migrations`, `migration_state`, and `sync_changes` tables. Use UUIDs for long-lived cross-device entity identity, retain legacy numeric IDs during migration where practical, and use soft-delete/tombstone columns for syncable entities.
- Migration plan: (1) introduce the repository and SQLite schema behind a feature flag while Dexie remains authoritative; (2) export/read IndexedDB data through the existing places-service context and import it transactionally into SQLite with a persistent checkpoint; (3) validate counts, foreign-key integrity, sampled field equality, and representative search results; (4) dual-read or shadow-query SQLite for diagnostics, without dual-writing long term; (5) switch history reads and writes to SQLite after validation; (6) retain the IndexedDB source for one release as rollback-only, then offer cleanup after successful migration; (7) remove Dexie history persistence and the JavaScript-only full-text/cache path once telemetry-free local validation and automated coverage pass.
- Conversation digest: The personal-history-graph work extended the prior Dexie `places` store with `visits`, `navigationEdges`, and `notes`; added canonical URLs, bounded digests, activity/attention fields, JavaScript relevance ranking, graph-aware LLM results, and a singleton internal history page. A prior assessment identified SQLite as the stronger choice for large history, FTS5, joins, recursive graph queries, and analytics, but deferred it because introducing a native Electron dependency would otherwise create a second persistence backend and packaging complexity. This migration replaces that temporary Dexie extension rather than adding a parallel permanent store.
- Dependencies: An Electron-compatible SQLite package; a migration/import adapter for the existing Dexie data; Node/Electron IPC types; and optional test fixtures representing version 1 and version 2 `browsingData2` data.
- Risks / unknowns: Native module ABI/rebuild and release packaging; durable database location and profile isolation; IndexedDB access from the migration process; migration time for very large histories; FTS tokenizer/language behavior; SQLite file corruption/backup policy; and cloud-sync identity/conflict rules.
- Open questions: Which SQLite library passes all release build targets? What database location, encryption-at-rest policy, and backup policy should Min use? Should extracted text be retained fully or only as a bounded digest plus FTS content? What retention defaults apply at large scale? Which enrichment data, if any, is eligible for future sync?

## 11. Acceptance Criteria
Define how success will be measured.

- [ ] A fresh profile records all new eligible history data in SQLite and does not create or query a Dexie history database.
- [ ] A profile containing legacy version 1 or version 2 `browsingData2` data is imported idempotently with pages, bookmarks, tags, visits, edges, notes, digests, and activity fields preserved or deterministically mapped.
- [ ] Existing direct search, full-text history search, LLM history retrieval, notes, activity ranking, and the internal history page return compatible results from SQLite.
- [ ] FTS5 search finds content from URLs, titles, digests, retained text, and notes, and graph queries return valid connected-page information.
- [ ] Page and full-history deletion maintain referential integrity and FTS/sync-change consistency.
- [ ] The history graph page remains a singleton and remains excluded from stored history, breadcrumbs, and the session sidebar.
- [ ] The local change log records creates, updates, and deletions with tombstones without transmitting data.
- [ ] A verified migration may retire IndexedDB history storage without loss of records or a startup regression.

## 12. Testing / Verification
Describe how the feature will be validated.

- Manual test plan: Exercise fresh and pre-populated profiles; import a large fixture; interrupt and retry migration; compare history-page and prompt/LLM searches before and after cutover; edit/delete notes; inspect navigation relationships; test private/internal exclusion; and confirm the database remains local with networking disabled.
- Automated test coverage: Unit-test schema migrations, record mapping, UUID/legacy-ID mapping, FTS queries, ranking, graph traversal, deletion cascades, enrichment state, and sync-change/tombstone creation. Add integration tests for IPC repository calls and full legacy import/retry/rollback behavior. Add end-to-end coverage for history page search, notes, singleton behavior, sidebar access, and LLM tool retrieval against SQLite fixtures.
- Regression considerations: Verify bookmarks/tags, existing prompt history suggestions, session navigation, private browsing, startup, packaged builds on each supported platform, and data preservation across upgrades and downgrades while the fallback period remains supported.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- Rollout plan: Ship behind a migration flag or staged release path. Create SQLite, import, and verify locally before read/write cutover. Keep IndexedDB rollback data for at least one release, expose local diagnostics without sending telemetry, and remove the legacy database only after a successful verified window.
- Follow-up work: Implement opt-in incremental cloud synchronization using `sync_changes`; add conflict-resolution rules and encrypted transport; evaluate embeddings/vector search as a derived SQLite-linked index; improve LLM research workflows for summarization and note collation; and offer export/import and database maintenance tools.