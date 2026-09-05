# Feature Specification Template

## 1. Feature Title
- **Feature name:** Personal browsing history graph
- **Created on:** 2026-09-05 17:17:08 +02:00
- **Owner:** Jozef Košík <jozef.kosik@gmail.com>

## 2. Summary
Provide a durable, local-first record of visited pages that supports direct and LLM-assisted retrieval, personal notes, and relevance ranking based on the user's browsing activity. The record forms a graph of pages and the navigation relationships between them.

- **Problem statement:** Current history storage does not define a rich, queryable, tool-addressable model for the user's visited pages, their content, their notes, their attention, and how navigation connects them.
- **Desired outcome:** Min maintains a private, searchable graph of visited pages and exposes an on-demand history page for people to browse, search, and open that knowledge.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** Min advertises full-text search for visited pages and its prompt runtime can route natural-language commands to browser tools, but this feature requires a specific, durable data model for rich history and page-to-page relationships.
- **Motivation:** A locally owned representation of browsing and attention can help people recover useful material, understand research paths, and let browser tools or the embedded LLM find relevant prior pages without sending their history to a remote service.
- **Related issues or references:** [Feature spec generator instructions](feature-spec-generator-skill.md). Existing `prompt-runtime` and `prompt-plaintext-search` features are relevant consumers; this feature must not reintroduce the removed task-grouping UI.

## 4. Goals
List the primary outcomes this feature should achieve.

- Goal 1: Persist each visited page locally with its canonical URL, captured metadata, searchable content digest, optional user notes, and accumulated activity statistics.
- Goal 2: Model navigation as addressable graph nodes and directed edges so pages and browser tools can refer to a stable history entry and its relationships.
- Goal 3: Provide fast direct search and a structured retrieval interface suitable for local LLM-assisted search, with relevance informed by text match and personal activity.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Non-goal 1: Syncing history, notes, page content, embeddings, or activity data to a cloud service or between devices in the initial release.
- Non-goal 2: Replacing Min's prompt runtime, building a generalized social network, or restoring task-grouping UI.

## 6. User Stories
Capture the expected user experience.

- As a researcher, I want to search pages I have visited by URL, title, topics, digest, and my notes so that I can quickly return to useful material.
- As a person using Min's local LLM, I want the browser to retrieve relevant prior pages and their provenance so that answers and browsing actions can build on my own history.
- As a privacy-conscious person, I want my browsing graph and attention data to remain in a local database so that the browser can learn from my use without exporting it.
- As a person reviewing history, I want an on-demand browser page that lets me inspect, search, and reopen recorded pages and navigation paths.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. Record a history entry for each eligible page visit, retaining the originally visited URL and a normalized/canonical URL where available, title and available page metadata, timestamps, and a stable local page-entry identifier.
2. Capture a bounded, searchable content digest for recorded pages. Background enrichment may use the configured local LLM to derive a summary, topics, keywords, or other structured metadata without blocking navigation; it must leave the entry usable when the LLM is unavailable or fails.
3. Allow a user to create, read, update, and delete personal notes attached to a history entry, and include notes in direct search and retrieval subject to user privacy settings.
4. Accumulate page statistics including visit count, first and last visit time, active dwell time, and an attention signal derived from observable browser activity. Define the attention calculation and ensure inactive or background tabs do not inflate it.
5. Create directed navigation-edge records when Min can determine that a visit followed another recorded page. Each edge must reference stable source and destination entry identifiers and retain enough event context to distinguish repeated navigation.
6. Provide a local query API for direct full-text/fielded history search and structured retrieval for browser tools and the embedded LLM. Results must include stable identifiers, relevant metadata, score components or explainable ranking fields, and navigation provenance when available.
7. Rank results using text relevance plus configurable or documented signals derived from recency, frequency, dwell time, attention, and notes, without making ranking depend on a remote service.
8. Provide a separate internal browser history page that can be opened on demand, search and filter recorded entries, inspect entry metadata/notes/statistics/relationships, and reopen a selected URL.
9. Define retention, deletion, and database-reset behavior so people can remove a single entry, its notes and associated edges as appropriate, or all recorded history.

## 8. Non-Functional Requirements
Capture quality and system constraints.

- Performance: Direct search over a large local history should return initial results promptly without loading full page bodies into the UI; ingestion and enrichment must not noticeably delay navigation.
- Reliability: Database migrations, corruption handling, and interrupted enrichment must preserve access to existing history and avoid blocking the browser startup path.
- Security: Keep data local by default, avoid executing captured page content, validate all history-page rendering, and require an explicit user choice before any future remote model or synchronization use.
- Accessibility: The history page must support keyboard navigation, semantic controls, visible focus, and screen-reader labels.
- Compatibility: Work across Min's supported Electron platforms and with no configured LLM; LLM enrichment must use the existing configured provider path when enabled.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- User flow: A person opens a dedicated internal history page, searches or filters the graph, views an entry and its connected pages, optionally edits notes, then reopens a page or uses the entry in a browser-tool workflow.
- Visual considerations: Preserve Min's minimal interface. Start with a dense, searchable history list and entry detail; graph visualization is optional and must complement rather than replace useful list/search workflows.
- Edge cases: Clearly represent unavailable metadata, failed or pending enrichment, redirect/canonical URL changes, private/incognito exclusions if supported, deleted entries, duplicate visits, and pages with no referrer relationship.

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- Proposed approach: Use a local SQLite database as the initial store. SQLite is suitable because history data is structured, locally scoped, durable, transactional, portable with Electron, and can scale to large collections with indexed tables and FTS5. Model page entries, visits, navigation edges, notes, enrichment state, and aggregate statistics as normalized relational tables; use FTS5 for URL/title/digest/note search and indexed edge queries for graph traversal. Evaluate a dedicated graph database only if measured traversal workloads exceed SQLite's indexed recursive-query capabilities.
- Dependencies: Select a maintained Electron-compatible SQLite binding or bundled database layer with migration support and FTS5 availability. Reuse the existing LLM engine/configuration interface for optional background enrichment; keep it injectable for tests.
- Risks / unknowns: Database binding packaging across supported platforms; storage growth and retention defaults; canonicalization and redirect identity; extracting safe, useful content; attention semantics; schema migration; LLM latency, cost, and privacy; and the right graph visualization scope.
- Open questions: What pages should be excluded from recording? Should related URLs share one page node or remain separate entries? What retention limit and user controls are appropriate? Which content fields may leave the device when a non-local LLM provider is configured? How should page deletion affect incoming and outgoing edges?

## 11. Acceptance Criteria
Define how success will be measured.

- [ ] Visiting an eligible page creates or updates a local, stable history entry with URL, available metadata, timestamps, and activity statistics.
- [ ] A direct query can find entries by URL, metadata, digest, and personal notes, and returns ranked results without requiring an LLM.
- [ ] Navigation between recorded pages creates queryable directed relationships that identify source and destination entries.
- [ ] Background LLM enrichment is optional, does not block browsing, persists successful output, and degrades gracefully when unavailable.
- [ ] Browser tools can retrieve structured, relevant history records and their stable identifiers through a local API.
- [ ] An internal history page supports search, entry inspection, note editing, relationship inspection, reopening pages, and documented deletion/reset controls.
- [ ] All recorded history and derived enrichment remain local by default.

## 12. Testing / Verification
Describe how the feature will be validated.

- Manual test plan: Visit linked pages, allow and deny enrichment, edit notes, create repeated visits and background tabs, search from the history page and LLM prompt, inspect relationships and ranking, restart Min, then test entry and full-history deletion.
- Automated test coverage: Unit-test URL identity, schema migrations, statistics and attention aggregation, ranking, note operations, full-text search, and graph-edge creation. Add integration tests for visit ingestion, background enrichment failure/success, browser-tool retrieval, and deletion. Add end-to-end coverage for the internal history page's essential search, inspection, note, reopen, and deletion workflows.
- Regression considerations: Verify existing visited-page search, prompt routing, session restoration, private browsing behavior where applicable, and startup performance remain functional.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- Rollout plan: Introduce behind a feature flag or an explicit history-data migration with a transparent local-storage notice; begin with direct search and list/detail history UI before optional visual graph exploration.
- Follow-up work: Evaluate embeddings/vector retrieval, user-configurable enrichment and retention policies, topic clusters and learning-path views, export/import, cross-device sync with explicit consent, and graph visualizations after baseline query performance and privacy controls are validated.