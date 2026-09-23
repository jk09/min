# Secure Renderer Migration Handoff

## Status

**All nine stages of `IMPLEMENTATION-PLAN.md` are implemented.** The chrome
renderer runs with `nodeIntegration: false`, `nodeIntegrationInWorker: false`,
`contextIsolation: true` and `sandbox: true`, is built by esbuild, and reaches
every privileged operation through named `window.min` capabilities.

The final boundary and the rules for extending it are documented in
[docs/renderer-trust-boundary.md](../../../docs/renderer-trust-boundary.md).
This file is kept as the migration record; start from the boundary doc instead
when adding a capability.

**Closed out on 2026-09-23** and merged into `jk-main-2` from
`feat/k9m2rs-secure-renderer-architecture-stage-9-cleanup`. The spec moved from
`spec/backlog/` to `spec/done/`; see [Close-out](#close-out) below.

The work is a cascade of the following committed checkpoints. Only the
stage-2, stage-3, stage-6-password-manager and stage-9 checkpoint branches (and
the root `feat/k9m2rs-secure-renderer-architecture`) were pushed; the other
branch names below were local-only, but every listed commit is in the history of
the stage-9 branch.

| Stage | Branch | Commits | Result |
| --- | --- | --- | --- |
| 1: Contract | `feat/k9m2rs-secure-renderer-architecture-stage-1-boundary` | `542f7d1c` | Typed least-privilege `window.min` contract and feature ledger entry. |
| 2: Preload | `feat/k9m2rs-secure-renderer-architecture-stage-2-preload` | `3b4ba452` | Dedicated `dist/preload-chrome.js`, chrome preload attachment, and `contextIsolation: true`. |
| 3: Window and clipboard | `feat/k9m2rs-secure-renderer-architecture-stage-3-ipc` | `20d186ba` | Named, sender-validated window-control and clipboard capabilities. |
| 4: Views and IPC | `feat/k9m2rs-secure-renderer-architecture-stage-4-views` | `0e44a032`, `b15d460b` | Named bridge capabilities for views, menus, downloads, and prompt streaming; restamped affected features. |
| 5: Persistent data | `feat/k9m2rs-secure-renderer-architecture-stage-5-data` | `0da83569`, `d925082a` | Main-owned settings/session persistence capabilities; async browser initialization. |
| 6a: Userscripts | `feat/k9m2rs-secure-renderer-architecture-stage-6-privileges` | `a59f44d2` | Main-owned userscript directory service and safe dropped-file URL conversion. |
| 6b: Password manager | `feat/k9m2rs-secure-renderer-architecture-stage-6-password-manager` | `b081f82f`, `1cafb00b` | Main-owned, allowlisted password-manager operations and final feature restamps. |
| 6c: Renderer audit | `feat/k9m2rs-secure-renderer-architecture-stage-6-renderer-audit` | `48daafbe` | Completed the prerequisite audit: every remaining renderer Node/Electron dependency moved behind named capabilities, and the context-isolated renderer made to start again. |
| 8: Hardening | `feat/k9m2rs-secure-renderer-architecture-stage-8-hardening` | `53cda6ee` | `nodeIntegration: false`, `nodeIntegrationInWorker: false`, `sandbox: true`, and the renderer trust-boundary regression test. |
| 7: Esbuild | `feat/k9m2rs-secure-renderer-architecture-stage-7-esbuild` | `4d2846e9` | esbuild renderer bundle with a build-time alias map and a build that fails on any Node dependency. |
| 9: Cleanup | `feat/k9m2rs-secure-renderer-architecture-stage-9-cleanup` | `a4777ed4` | Sender guards and payload validation for view creation, removal of dead ungated handlers and Browserify scaffolding, trust-boundary documentation. |

Stage 8 was done before Stage 7: the Stage 6c audit was what actually blocked
it, and landing the security settings first gave the esbuild work a hardened
target to build against.

## Implemented Security Boundary

The main chrome renderer currently has:

- `nodeIntegration: false`, `nodeIntegrationInWorker: false`, `contextIsolation: true`, `sandbox: true`, and `dist/preload-chrome.js` attached in `main/windowUtils.js`.
- A `window.min` bridge defined by `js/preload/browserChrome.js`, with typed declarations in `types/globals.d.ts` and a capability inventory in `js/preload/chromeBridgeContract.ts`.

Note for anyone reading the earlier checkpoints: because `contextIsolation: true` was enabled in Stage 2 while `js/default.js` still read `process.argv` and `require('electron')`, the chrome renderer threw `process is not defined` on startup and never finished booting from Stage 2 through Stage 6b. Stage 6c removed those globals and the renderer starts again. Verify startup with `npx electron . --development-mode --startup-diagnostics --enable-logging` after any further change; a crash in the chrome bundle does not fail any test suite.

The bridge exposes named capabilities only. It must never expose a generic `ipcRenderer`, `send`, `invoke`, `require`, Node module, Electron module, filesystem object, arbitrary path operation, process launcher, or shell facade.

Implemented capability groups include:

- Bootstrap metadata (platform, window id, app name/version, development mode, initial task/window)
- Window control and window-state subscription, including focus and full-screen transitions
- Clipboard text and bookmark writes
- Tab/view lifecycle and navigation operations
- Remote menu actions and event subscriptions
- Download operations
- Prompt completion/progress operations
- Settings and session persistence
- Userscript listing, watching, and reveal
- Dropped-file URL conversion
- Password-manager executable checks, operations, and CSV import/export selection
- Application actions: quit, window title, secondary menu, save dialog, focus-mode dialog, spell-checker word, macOS handoff
- Allowlisted main-process command subscriptions (`app.onCommand`) and `before-input-event`
- Permission grants and permission-state subscription
- Cross-window tab-state sync
- History requests
- Hosts-file lookup and bookmarks-backup write, both with paths owned by the main process

Every new privileged handler must validate that its sender is the owning main chrome `WebContents`, validate payloads, and keep filesystem paths/executables allowlisted in the main process.

## Important Source Locations

- Chrome preload: `js/preload/browserChrome.js`
- Capability contract: `js/preload/chromeBridgeContract.ts`
- Chrome sender guard: `main/chromeCapabilities.js`
- Window/clipboard handlers: `main/remoteActions.js`
- View handlers: `main/viewManager.js`
- Menu handlers: `main/remoteMenu.js`
- Session persistence: `main/sessionPersistence.js`
- Userscript service: `main/userscriptService.js`
- Password-manager service: `main/passwordManagerService.js`
- Application/tab-state/hosts/bookmarks service: `main/chromeAppService.js`
- Permission grant handler: `main/permissionManager.js`
- History handler: `main/historyService.js`
- Renderer bootstrap and async initialization: `js/default.js`
- Renderer event emitter (replaces Node `events`): `js/util/eventBus.js`
- Renderer bundle and globals policy: `scripts/buildBrowser.js` (esbuild `nodePaths`, `define`, `external`)
- View payload validation: `main/viewPreferences.js`
- Trust-boundary probe: `main/windowUtils.js`, asserted by `test/rendererTrustBoundary.test.js`
- Boundary documentation: `docs/renderer-trust-boundary.md`
- Feature ledger: `spec/FEATURES.json`, feature id `secure-renderer-architecture`

## Validation Baseline

At the Stage 9 checkpoint:

- `npm run build` passed.
- `npm run typecheck` passed.
- `npm run verify:features` passed with 15 existing coverage warnings.
- `npm run test:unit` passed with 99 tests.
- A development Electron startup run reached `did-finish-load` for `min://app/index.html`, restored the previous session, and produced no errors from `dist/bundle.js`.
- Focused bridge/service tests cover sender guards, preload contents, the app-command allowlist, session/settings validation, userscript filename/path restrictions, password-manager allowlists, hosts/bookmarks path ownership, and the renderer event bus.

`npm test` remains blocked by pre-existing JavaScript Standard violations in legacy files, including `main/llmEngine.js`, `js/llmPrompt/skills/skillRegistry.js`, and related existing modules. Do not reformat these files except as a separate, deliberate lint cleanup change.

## Close-out

Verified on Linux on 2026-09-23, after which the branch was merged into
`jk-main-2`:

- `npm run build`, `npm run typecheck` and `npm run verify:features` pass (15
  existing coverage warnings).
- All 99 unit tests pass, including `test/rendererTrustBoundary.test.js`. On
  Linux it must run as a non-root user: Chromium refuses to start as root
  without `--no-sandbox`, and adding that flag would defeat the `sandbox: true`
  check.
- Development and packaged (Linux x64 `dir` target) startups both reach
  `did-finish-load` with the Chromium-only preferences, an initialised
  renderer, all 16 bridge groups, no bridge leaks and no Node/Electron globals.
  This is the automated equivalent of the devtools check in Stage 8.

Close-out changes:

- `scripts/featureLedger.js` now hashes source files with CRLF normalised to LF.
  Hashes stamped on a Windows checkout never matched a Linux checkout, so 17
  features reported as stale on a clean clone. Every feature was restamped.
- `scripts/createPackage.js` no longer excludes `main/`, a leftover from the
  `main.build.js` era that made packaging fail since the esm-module-refactor.
- Deleted `js/taskOverlay/`. It still required `electron` for raw
  `ipcRenderer`, but nothing imported it since the Tasks UI was removed.

## Remaining Work

The nine planned stages are complete. What is left is follow-up rather than
migration, and none of it blocks anything:

- **The legacy history export window.** `main/main.js` still creates a hidden
  `BrowserWindow` with `nodeIntegration: true` and `contextIsolation: false` to
  migrate history out of the old IndexedDB store, and the ungated
  `history:request` channel exists to serve it. It belongs to
  `history-sqlite-migration`, not to this spec. Retiring the window would let
  the ungated channel go with it.
- **Prompt and translation channels.** `main/prompt.js` (`show-prompt`,
  `open-prompt`, `close-prompt`, `prompt`) and `page-translation-session-create`
  in `main/main.js` have no chrome sender check, because they serve the prompt
  window and the web-content preload rather than the chrome renderer. They are
  narrow, but they are not sender-validated.
- **`clearStorageData` was removed, not migrated.** It was an ungated handler
  with no caller anywhere - the UI that used to invoke it is gone from this
  fork. If a "clear browsing data" feature comes back, it needs a new
  sender-validated capability rather than a revert.
- **Dead task-overlay styles.** `css/taskOverlay.css` and the
  `task-overlay-is-shown` selectors in `css/downloadManager.css` and
  `css/windowControls.css` have no markup left to style. They are harmless and
  belong to the earlier Tasks UI removal, not to this spec.
- **Lint debt.** `npm test` is still blocked by pre-existing JavaScript
  Standard violations in legacy files. The count dropped from 848 to 830 across
  this migration purely by deleting code; no file was reformatted.

## Checklist For Extending The Boundary

1. Branch from `jk-main-2` only after confirming `git status --short` is clean; read `docs/renderer-trust-boundary.md` first.
2. Read `AGENTS.md`, `SPEC.md`, `IMPLEMENTATION-PLAN.md`, and this file.
3. Run `npm run features:context` and read `spec/CONTEXT.md`.
4. Work on one named capability group or build step at a time.
5. Run focused tests immediately after the first edit, then `npm run build`, `npm run typecheck`, `npm run features:docs`, `npm test`, and `npm run test:unit`.
6. Restamp all affected feature ids with `npm run features:restamp -- <ids>` after validation, then rerun the official suites if they initially stopped at stale feature hashes.
7. Start the app before committing. No test suite loads the chrome bundle in a browser, so a renderer that throws on startup still shows a green run:

   ```sh
   ELECTRON_RUN_AS_NODE= npx electron . --development-mode --startup-diagnostics --enable-logging
   ```

   Confirm `did-finish-load` for `min://app/index.html` and no `source: min://app/dist/bundle.js` errors. On Windows, unset `ELECTRON_RUN_AS_NODE` first or Electron runs `main.js` as plain Node and `app` is undefined.
8. Commit using `.copilot-commit-message-instructions.md` with `feat-k9m2rs-secure-renderer-architecture\SPEC.md` in the body.
