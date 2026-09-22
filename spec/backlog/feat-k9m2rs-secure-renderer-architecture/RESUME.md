# Secure Renderer Migration Resume Handoff

## Current Checkpoint

Resume from branch `feat/k9m2rs-secure-renderer-architecture-stage-6-renderer-audit`.

This branch is a cascade built from the following committed checkpoints:

| Stage | Branch | Commits | Result |
| --- | --- | --- | --- |
| 1: Contract | `feat/k9m2rs-secure-renderer-architecture-stage-1-boundary` | `542f7d1c` | Typed least-privilege `window.min` contract and feature ledger entry. |
| 2: Preload | `feat/k9m2rs-secure-renderer-architecture-stage-2-preload` | `3b4ba452` | Dedicated `dist/preload-chrome.js`, chrome preload attachment, and `contextIsolation: true`. |
| 3: Window and clipboard | `feat/k9m2rs-secure-renderer-architecture-stage-3-ipc` | `20d186ba` | Named, sender-validated window-control and clipboard capabilities. |
| 4: Views and IPC | `feat/k9m2rs-secure-renderer-architecture-stage-4-views` | `0e44a032`, `b15d460b` | Named bridge capabilities for views, menus, downloads, and prompt streaming; restamped affected features. |
| 5: Persistent data | `feat/k9m2rs-secure-renderer-architecture-stage-5-data` | `0da83569`, `d925082a` | Main-owned settings/session persistence capabilities; async browser initialization. |
| 6a: Userscripts | `feat/k9m2rs-secure-renderer-architecture-stage-6-privileges` | `a59f44d2` | Main-owned userscript directory service and safe dropped-file URL conversion. |
| 6b: Password manager | `feat/k9m2rs-secure-renderer-architecture-stage-6-password-manager` | `b081f82f`, `1cafb00b` | Main-owned, allowlisted password-manager operations and final feature restamps. |
| 6c: Renderer audit | `feat/k9m2rs-secure-renderer-architecture-stage-6-renderer-audit` | this run | Completed the prerequisite audit: every remaining renderer Node/Electron dependency moved behind named capabilities, and the context-isolated renderer made to start again. |

## Implemented Security Boundary

The main chrome renderer currently has:

- `contextIsolation: true` and `dist/preload-chrome.js` attached in `main/windowUtils.js`.
- `nodeIntegration: true` and `nodeIntegrationInWorker: true` still enabled, but no bundled renderer module depends on them any more. Stage 8 can now turn both off.
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
- Renderer bundle globals policy: `scripts/buildBrowser.js` (`insertGlobalVars`)
- Feature ledger: `spec/FEATURES.json`, feature id `secure-renderer-architecture`

## Validation Baseline

At the Stage 6c checkpoint:

- `npm run build` passed.
- `npm run typecheck` passed.
- `npm run verify:features` passed with 15 existing coverage warnings.
- `npm run test:unit` passed with 86 tests.
- A development Electron startup run reached `did-finish-load` for `min://app/index.html`, restored the previous session, and produced no errors from `dist/bundle.js`.
- Focused bridge/service tests cover sender guards, preload contents, the app-command allowlist, session/settings validation, userscript filename/path restrictions, password-manager allowlists, hosts/bookmarks path ownership, and the renderer event bus.

`npm test` remains blocked by pre-existing JavaScript Standard indentation violations in legacy files, including `main/llmEngine.js`, `js/llmPrompt/skills/skillRegistry.js`, and related existing modules. Do not reformat these files as part of future migration stages unless explicitly making a separate lint cleanup change.

## Remaining Work

### Prerequisite Audit — done in Stage 6c

No module in the chrome bundle requires `electron`, `fs`, `path`, `child_process` or `events`, and none reads `process.*`, `globalArgs`, `window.electron`, `window.fs` or a raw `ipc.*`. Re-run the audit against the modules the bundle actually contains, not all of `js/` — several files under `js/` are main-process or other-page code and legitimately keep Node access:

```sh
node -e "const fs=require('fs');const c=fs.readFileSync('dist/bundle.js','utf8');const m='//# sourceMappingURL=data:application/json;charset=utf-8;base64,';const i=c.lastIndexOf(m);console.log(JSON.parse(Buffer.from(c.slice(i+m.length).trim(),'base64').toString()).sources.filter(s=>s.startsWith('js/')).join('\n'))"
```

Files under `js/` that are *not* in the bundle and must keep Node access: `js/util/settings/settingsMain.js`, `js/util/proxy.js`, `js/util/process.js`, `js/util/processWorker.js`, `js/places/legacyHistoryExport.js`, `js/taskOverlay/taskOverlay.js`, `js/util/settings/settingsPreload.js`, `js/llmPrompt/llmDebugPreload.js`, and everything in `js/preload/`.

### Stage 7: Esbuild

Use `IMPLEMENTATION-PLAN.md` Stage 7. Create a child branch from the current checkpoint, for example `feat/k9m2rs-secure-renderer-architecture-stage-7-esbuild`.

- Add esbuild beside Browserify first.
- Preserve existing `dist/bundle.js` and source-map behavior while validating equivalent startup behavior.
- Replace Browserify alias resolution with explicit imports or a documented build-time alias map; never depend on runtime Node module resolution in renderer code.
- Keep `npm run typecheck` separate from build transpilation.
- Carry over the globals policy: `scripts/buildBrowser.js` now passes browserify `insertGlobalVars` that defines `global` as `globalThis` and deliberately leaves `process`, `Buffer`, `setImmediate`, `clearImmediate`, `__filename` and `__dirname` undefined. The esbuild equivalent is `define: { global: 'globalThis' }` with no Node polyfills. Bundled browser libraries (dragula → crossvent → custom-event, ticky) depend on this.
- Update feature ledger sources/tests and restamp every feature whose listed source files changed.

### Stage 8: Final Chrome Hardening

Only after the audit and Stage 7 are complete:

- Change main chrome web preferences to `nodeIntegration: false`.
- Disable `nodeIntegrationInWorker` unless a reviewed bridge-backed need remains.
- Keep `contextIsolation: true`.
- Consider `sandbox: true` only after validating preload compatibility.
- Add security regression coverage proving renderer globals such as `require`, `process`, direct Electron APIs, raw IPC, and Node built-ins are unavailable.
- Run a development Electron startup test and manual core-workflow check before committing.

### Stage 9: Cleanup

Remove Browserify, its transforms, aliases, transitional globals, and obsolete compatibility code only after the Chromium-only renderer runs successfully. Update the feature ledger and documentation to remove stale references.

Known cleanup targets left in place on purpose, because removing them is not part of a capability migration:

- `main/remoteActions.js` still registers ungated `ipc.handle` channels that no longer have a chrome-renderer caller: `minimize`, `maximize`, `unmaximize`, `close`, `setFullScreen`, `showSaveDialog`, `addWordToSpellCheckerDictionary`, `showFocusModeDialog2`, `showOpenDialog`, `showItemInFolder`, `startFileDrag`, `clearStorageData`, and `newWindow`. Each accepts any sender, so they should be deleted or given `getChromeWindow` guards. Keep the exported `showFocusModeDialog1`/`showFocusModeDialog2` functions, which `main/menu.js` calls directly.
- `main/historyService.js` keeps the ungated `history:request` channel for `js/places/legacyHistoryExport.js`, which still runs in a `nodeIntegration: true` hidden window. Retire that window or scope the channel to it.
- `main/download.js` keeps `cancelDownload` alongside the guarded `chrome:downloads:cancel`.

## Future Agent Run Checklist

1. Start from the latest committed checkpoint branch; create a new child branch only after confirming `git status --short` is clean.
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
