# Secure Renderer Migration Plan

This plan implements [SPEC.md](SPEC.md) as a sequence of independently reviewable features. Do not enable `nodeIntegration: false` for the main chrome renderer until Stage 8.

## Run Rules

Each stage is a separate agentic run and commit.

1. Read `AGENTS.md`, this plan, and `SPEC.md`.
2. Run `npm run features:context` and read `spec/CONTEXT.md` before editing.
3. Reuse or update the `secure-renderer-architecture` feature ledger entry created in Stage 1. Do not create duplicate active entries.
4. Run `npm run features:docs`, `npm test`, `npm run test:unit`, and `npm run features:restamp -- <affected-feature-ids>` before committing.
5. Do not introduce a compatibility global that exposes unrestricted `ipcRenderer`, Node built-ins, `require`, `process`, `fs`, or Electron APIs to the renderer.

## Stage 1: Establish The Security Boundary

**Goal:** Create the feature-ledger entry and a typed contract for the chrome preload bridge without changing runtime behavior.

**Scope:**
- Add `secure-renderer-architecture` to `spec/FEATURES.json` with this specification as its `specPath`.
- Add TypeScript declarations for a future `window.min` capability API in `types/`.
- Document the allowed capability groups: window controls, view lifecycle, settings, session persistence, downloads, clipboard, file selection, userscripts, password-manager operations, and prompt services.
- Add unit tests that validate the declared bridge API shape or a contract module used by the bridge.

**Do not:** Add generic `send`, `invoke`, or filesystem-path APIs to the bridge.

**Acceptance:**
- No renderer runtime behavior changes.
- The feature ledger lists contract source and test files.
- Type checking and existing tests pass.

**Agent prompt:**
```text
Implement Stage 1 of spec/backlog/feat-k9m2rs-secure-renderer-architecture/IMPLEMENTATION-PLAN.md. Establish a typed, least-privilege window.min bridge contract and feature ledger entry without changing runtime behavior. Follow AGENTS.md, update tests and ledger, verify, restamp, and commit.
```

## Stage 2: Build The Chrome Preload

**Goal:** Produce a dedicated preload artifact for the main browser chrome and expose only inert/read-only bootstrap data initially.

**Scope:**
- Add a `js/preload/browserChrome` entry using `contextBridge`.
- Update the build to emit a distinct `dist/preload-chrome.js` while preserving the existing web-content `dist/preload.js`.
- Expose immutable bootstrap metadata required by the renderer, such as platform, window id, application version, and development mode.
- Wire the main chrome `WebContentsView` to this preload but keep current Node settings unchanged for this stage.
- Add a test that verifies the preload output is built and the expected bridge keys are present.

**Do not:** Expose Electron or Node module objects. Do not change webview preloads.

**Acceptance:**
- `npm run build` produces `dist/preload-chrome.js`.
- Min starts with the chrome preload attached.
- Existing chrome behavior is unchanged.

**Agent prompt:**
```text
Implement Stage 2 of spec/backlog/feat-k9m2rs-secure-renderer-architecture/IMPLEMENTATION-PLAN.md. Build and attach a dedicated contextBridge preload for the main chrome, exposing only typed read-only bootstrap metadata while preserving current runtime behavior. Update tests, feature ledger, verification stamps, and commit.
```

## Stage 3: Harden Chrome IPC

**Goal:** Replace renderer access to raw IPC with named bridge capabilities and validate senders in main-process handlers.

**Scope:**
- Identify all IPC handlers reachable from the main chrome renderer.
- Add a reusable sender guard that confirms requests originate from the active main chrome `WebContents` for that window.
- Add per-capability bridge methods and main-handler payload validation for window controls and clipboard first.
- Convert window controls and clipboard callers to the new bridge methods.
- Remove raw IPC/Electron access from the converted callers.

**Do not:** Provide a generic channel forwarding API or broaden privileges for web-content preloads.

**Acceptance:**
- Window controls and clipboard work through named bridge methods.
- Untrusted view senders are rejected by guarded chrome-only handlers.
- Tests cover allowed sender, rejected sender, and invalid payload behavior.

**Agent prompt:**
```text
Implement Stage 3 of spec/backlog/feat-k9m2rs-secure-renderer-architecture/IMPLEMENTATION-PLAN.md. Add sender-validated, payload-validated named bridge capabilities for chrome window controls and clipboard, then migrate their renderer callers. Do not expose generic IPC. Update tests, ledger, verify, restamp, and commit.
```

## Stage 4: Migrate Renderer State And View Operations

**Goal:** Move tab, webview, menu, and prompt IPC operations behind explicit capability groups.

**Scope:**
- Define named APIs for tab/view lifecycle operations, navigation history, context menus, download events, prompt progress, and renderer event subscriptions.
- Replace direct `ipc` use in the relevant renderer modules with these APIs.
- Ensure event subscription callbacks receive only data, never Electron event objects.
- Ensure bridge listeners can be unsubscribed and do not leak across window teardown.

**Do not:** Send arbitrary renderer-provided channel names or arbitrary method names to the main process.

**Acceptance:**
- Chrome tab navigation, view creation/destruction, context menus, downloads, and prompt streaming work through explicit APIs.
- Tests verify channel allowlisting, listener cleanup, and sender validation.

**Agent prompt:**
```text
Implement Stage 4 of spec/backlog/feat-k9m2rs-secure-renderer-architecture/IMPLEMENTATION-PLAN.md. Replace direct renderer IPC for tab/view, menu, download, and prompt operations with explicit contextBridge capabilities. Preserve behavior, prevent arbitrary channels or Electron event exposure, test listener cleanup, update ledger, verify, restamp, and commit.
```

## Stage 5: Migrate Persistent Data Capabilities

**Goal:** Remove direct renderer filesystem access for settings, sessions, bookmarks, userscripts, and password import/export.

**Scope:**
- Move each file operation into a main-process service with a capability-specific API.
- Keep path construction and allowlisting in the main process; the renderer must never submit an arbitrary path.
- Convert synchronous renderer initialization reads to asynchronous initialization with explicit loading/failure states where needed.
- Replace stream copying with a main-process operation that accepts validated file selections or opaque file handles.

**Do not:** Expose `fs`, arbitrary paths, directory enumeration outside owned data directories, or generic read/write methods.

**Acceptance:**
- Renderer no longer imports or receives `fs` or `path` for persistent data workflows.
- Settings/session restore, bookmarks, userscripts, and password manager import/export work after restart.
- Tests reject out-of-scope paths and malformed requests.

**Agent prompt:**
```text
Implement Stage 5 of spec/backlog/feat-k9m2rs-secure-renderer-architecture/IMPLEMENTATION-PLAN.md. Move renderer filesystem workflows to narrow, validated main-process capabilities. Do not expose arbitrary paths or an fs facade. Preserve settings, session, bookmarks, userscripts, and password workflows; add tests, update ledger, verify, restamp, and commit.
```

## Stage 6: Move Process And Remaining Electron Privileges

**Goal:** Remove renderer access to process spawning, shell, web utilities, and remaining Electron modules.

**Scope:**
- Move password-manager executable checks and process launching into main-process allowlisted services.
- Add named capabilities for revealing permitted downloaded/user-data files and for approved file-selection flows.
- Replace `electron.webUtils`, `electron.shell`, and direct clipboard usages that remain.
- Replace renderer Node `EventEmitter` use with a local browser-side event utility or explicit bridge event subscriptions, depending on ownership.

**Do not:** Expose `child_process`, `process.env`, `shell`, `webUtils`, or generic executable/path arguments.

**Acceptance:**
- Renderer source has no `require('electron')`, `require('child_process')`, or Node process access.
- Password manager and download workflows remain functional.
- Tests cover executable/path allowlisting and rejected operations.

**Agent prompt:**
```text
Implement Stage 6 of spec/backlog/feat-k9m2rs-secure-renderer-architecture/IMPLEMENTATION-PLAN.md. Remove the remaining renderer Electron and Node process privileges through narrow main-process services. Preserve password manager and download flows, forbid generic process/path APIs, add tests, update ledger, verify, restamp, and commit.
```

## Stage 7: Replace Browserify With Esbuild

**Goal:** Build the browser chrome with esbuild while retaining the current runtime behavior and type-check command.

**Scope:**
- Add esbuild and an explicit renderer build entry.
- Convert renderer module resolution from Browserify aliases to explicit relative ESM-compatible imports or a documented build-time alias map.
- Produce the bundle and source maps consumed by `index.html`.
- Preserve `npm run typecheck` as the separate type-validation command.
- Initially run Browserify and esbuild in parallel only if needed for output comparison; remove Browserify only after equivalent output is verified.

**Do not:** Rely on runtime Node resolution in the renderer or silently weaken CSP/source map behavior.

**Acceptance:**
- `npm run build` generates the renderer bundle using esbuild.
- Development startup, source maps, and packaged loading work.
- Browserify is removed only when it has no remaining consumers.

**Agent prompt:**
```text
Implement Stage 7 of spec/backlog/feat-k9m2rs-secure-renderer-architecture/IMPLEMENTATION-PLAN.md. Replace the Browserify chrome bundle with an esbuild build that supports the existing renderer graph without runtime Node resolution. Preserve source maps and tsc --noEmit validation. Add build tests, update ledger, verify, restamp, and commit.
```

## Stage 8: Enforce Chromium-Only Chrome Renderer

**Goal:** Enable the final Electron security settings after all renderer dependencies are migrated.

**Scope:**
- Set `nodeIntegration: false` and `contextIsolation: true` for the main chrome `WebContentsView`.
- Disable renderer worker Node integration unless a specific reviewed requirement remains.
- Confirm no main-chrome renderer source depends on Node globals or raw Electron APIs.
- Consider `sandbox: true` only after validating every preload dependency under Electron's sandbox restrictions.

**Do not:** Reintroduce compatibility globals for Node, Electron, raw IPC, or filesystem access to make tests pass.

**Acceptance:**
- Renderer devtools confirm `require`, `process`, `Buffer`, Node built-ins, direct Electron APIs, and raw IPC are unavailable.
- All bridge-backed chrome workflows pass manual and automated verification.
- Untrusted webview content cannot invoke chrome bridge methods or guarded IPC handlers.

**Agent prompt:**
```text
Implement Stage 8 of spec/backlog/feat-k9m2rs-secure-renderer-architecture/IMPLEMENTATION-PLAN.md. Enable nodeIntegration:false and contextIsolation:true for the main chrome only after proving all renderer dependencies use typed bridge capabilities. Do not add compatibility globals. Add security regression tests, update ledger, verify development and packaged startup, restamp, and commit.
```

## Stage 9: Security Review And Cleanup

**Goal:** Verify the completed boundary and remove migration scaffolding.

**Scope:**
- Audit all `webPreferences`, preload entries, and IPC handlers.
- Remove obsolete Browserify scripts, transforms, aliases, globals, and transitional code.
- Confirm no active feature ledger entries reference removed files.
- Document the final bridge capability surface and ownership rules.

**Acceptance:**
- Searches find no renderer Node/Electron imports or direct raw IPC outside preloads.
- Security-focused tests cover sender checks, payload validation, and bridge exposure.
- Build, typecheck, unit tests, and feature verification pass.

**Agent prompt:**
```text
Implement Stage 9 of spec/backlog/feat-k9m2rs-secure-renderer-architecture/IMPLEMENTATION-PLAN.md. Audit the final renderer trust boundary, remove migration scaffolding, and verify no renderer Node/Electron or raw IPC access remains outside preloads. Update the ledger and documentation, run all required checks, restamp, and commit.
```
