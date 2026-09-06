# Secure Renderer Migration Resume Handoff

## Current Checkpoint

Resume from branch `feat/k9m2rs-secure-renderer-architecture-stage-6-password-manager` at commit `1cafb00b`.

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

## Implemented Security Boundary

The main chrome renderer currently has:

- `contextIsolation: true` and `dist/preload-chrome.js` attached in `main/windowUtils.js`.
- `nodeIntegration: true` and `nodeIntegrationInWorker: true` still enabled. Do not disable either until the Stage 8 audit proves no renderer dependency remains.
- A `window.min` bridge defined by `js/preload/browserChrome.js`, with typed declarations in `types/globals.d.ts` and a capability inventory in `js/preload/chromeBridgeContract.ts`.

The bridge exposes named capabilities only. It must never expose a generic `ipcRenderer`, `send`, `invoke`, `require`, Node module, Electron module, filesystem object, arbitrary path operation, process launcher, or shell facade.

Implemented capability groups include:

- Bootstrap metadata
- Window control and window-state subscription
- Clipboard text write
- Tab/view lifecycle and navigation operations
- Remote menu actions and event subscriptions
- Download operations
- Prompt completion/progress operations
- Settings and session persistence
- Userscript listing, watching, and reveal
- Dropped-file URL conversion
- Password-manager executable checks, operations, and CSV import/export selection

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
- Renderer bootstrap and async initialization: `js/default.js`
- Feature ledger: `spec/FEATURES.json`, feature id `secure-renderer-architecture`

## Validation Baseline

At the Stage 6 checkpoint:

- `npm run build` passed.
- `npm run typecheck` passed.
- `npm run verify:features` passed with 15 existing coverage warnings.
- `npm run test:unit` passed with 75 tests.
- Focused bridge/service tests cover sender guards, preload contents, session/settings validation, userscript filename/path restrictions, and password-manager manager/operation allowlists.

`npm test` remains blocked by pre-existing JavaScript Standard indentation violations in legacy files, including `main/llmEngine.js`, `js/llmPrompt/skills/skillRegistry.js`, and related existing modules. Do not reformat these files as part of future migration stages unless explicitly making a separate lint cleanup change.

## Remaining Work

### Prerequisite Audit

Before Stage 7 or Stage 8, search renderer files outside `js/preload/` for direct use of:

- `require('electron')`, `require('fs')`, `require('path')`, `require('child_process')`, or `require('events')`
- `electron.*`, `fs.*`, `process.*`, `window.electron`, `window.fs`, and raw `ipc.*`

Migrate every remaining legitimate dependency behind a named `window.min` method. Do not assume the Stage 6 commits eliminated all direct Node use; the renderer bootstrap still needs a final audit and cleanup.

### Stage 7: Esbuild

Use `IMPLEMENTATION-PLAN.md` Stage 7. Create a child branch from the current checkpoint, for example `feat/k9m2rs-secure-renderer-architecture-stage-7-esbuild`.

- Add esbuild beside Browserify first.
- Preserve existing `dist/bundle.js` and source-map behavior while validating equivalent startup behavior.
- Replace Browserify alias resolution with explicit imports or a documented build-time alias map; never depend on runtime Node module resolution in renderer code.
- Keep `npm run typecheck` separate from build transpilation.
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

## Future Agent Run Checklist

1. Start from the latest committed checkpoint branch; create a new child branch only after confirming `git status --short` is clean.
2. Read `AGENTS.md`, `SPEC.md`, `IMPLEMENTATION-PLAN.md`, and this file.
3. Run `npm run features:context` and read `spec/CONTEXT.md`.
4. Work on one named capability group or build step at a time.
5. Run focused tests immediately after the first edit, then `npm run build`, `npm run typecheck`, `npm run features:docs`, `npm test`, and `npm run test:unit`.
6. Restamp all affected feature ids with `npm run features:restamp -- <ids>` after validation, then rerun the official suites if they initially stopped at stale feature hashes.
7. Commit using `.copilot-commit-message-instructions.md` with `feat-k9m2rs-secure-renderer-architecture\SPEC.md` in the body.
