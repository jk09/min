# Feature Specification Template

## 1. Feature Title
- **Feature name:** Secure Chromium-only Chrome Renderer Migration
- **Created on:** 2026-09-06 18:37:29 +02:00
- **Owner:** Jozef Kosik <jozef.kosik@gmail.com>

## 2. Summary
Migrate Min's trusted browser-chrome renderer from direct Node integration and Browserify/CommonJS loading to a Chromium-only renderer with a minimal, typed preload bridge and an esbuild-managed ESM build.

- **Problem statement:** The browser chrome currently has Node integration and disabled context isolation. Renderer modules depend on CommonJS `require()` aliases resolved by Browserify, leaving the renderer with broad access to Node and Electron capabilities.
- **Desired outcome:** Keep Node and Electron privileges in the main process and narrowly scoped preload scripts, while the browser-chrome renderer uses only explicitly exposed APIs and bundled ESM modules.

## 3. Background and Context
- **Current behavior:** `main/windowUtils.js` creates the main `WebContentsView` with `nodeIntegration: true` and `contextIsolation: false`. `index.html` loads `dist/bundle.js`, produced by Browserify from renderer modules that use CommonJS aliases. TypeScript is currently stripped by a custom Browserify transform, while `tsc --noEmit` performs type checking.
- **Motivation:** Removing Node access from the renderer reduces the impact of a renderer compromise, establishes an auditable privilege boundary, and allows a modern ESM/TypeScript build without the legacy Browserify runtime.
- **Related issues or references:** Original Browserify adoption was upstream commit `bc8beb69` (2018-05-12). TypeScript integration began in fork commit `61771079` (2026-09-05). [Feature spec generator instructions](feature-spec-generator-skill.md) were supplied as prompt context. Existing relevant features: `esm-module-refactor`, `typescript-support`, and `prompt-runtime`.

## 4. Goals
- Goal 1: Run the trusted browser-chrome renderer with `nodeIntegration: false` and `contextIsolation: true`.
- Goal 2: Expose only documented, validated renderer capabilities through a minimal preload `contextBridge` API.
- Goal 3: Replace Browserify renderer output with esbuild-generated ESM-compatible production bundles while retaining `tsc --noEmit` as the type-checking authority.

## 5. Non-Goals
- Non-goal 1: Remove Node.js or Electron APIs from the main process or from required preload scripts.
- Non-goal 2: Change the privilege model or implementation of arbitrary web content shown in Min webviews beyond preserving its unprivileged state.

## 6. User Stories
- As a Min user, I want the browser chrome to be isolated from Node.js so that a renderer vulnerability cannot directly access local system capabilities.
- As a Min contributor, I want typed, explicit renderer APIs and modern module imports so that UI code can be changed with clearer boundaries and type checking.

## 7. Functional Requirements
1. The main browser-chrome `WebContentsView` must run with `nodeIntegration: false` and `contextIsolation: true` after the migration is complete.
2. A preload module must expose only the required browser-chrome APIs through `contextBridge`; direct renderer access to Node, Electron `ipcRenderer`, `require`, `process`, and filesystem APIs must not be available.
3. Every bridged action must use allowlisted IPC channels and validate payloads in the main process before performing privileged operations.
4. Renderer code must import internal modules through ESM-compatible paths rather than relying on runtime filesystem resolution of CommonJS aliases.
5. The build must produce the renderer assets consumed by `index.html` and preserve existing output naming or update consuming HTML/configuration atomically.
6. `npm run typecheck` must remain a separate, required compiler validation; build transpilation alone must not be considered type validation.

## 8. Non-Functional Requirements
- Performance: Production renderer builds should minimize startup work and avoid a legacy Browserify module-loader runtime; build/watch feedback should be at least as fast as the current workflow.
- Reliability: Migration must be staged so each converted renderer subsystem remains functional in packaged and development Electron runs.
- Security: No remote or arbitrary web content may gain Node or privileged Min APIs. The bridge must expose the smallest capability surface needed by the chrome renderer.
- Accessibility: Existing keyboard interactions, focus behavior, and accessible chrome controls must remain unchanged.
- Compatibility: Preserve supported Electron platforms and existing Min protocol loading, preload behavior, and packaged-app operation.

## 9. UX / UI Notes
- User flow: This is architectural; normal browser chrome workflows should remain visually and behaviorally unchanged throughout staged migration.
- Visual considerations: Preserve `index.html` structure, styles, layout, and loading behavior unless a bundle-entry change requires an equivalent script declaration.
- Edge cases: Validate startup, window focus and resize IPC, downloads, prompt actions, settings, session restore, and internal pages after each migration stage.

## 10. Technical Notes
- Proposed approach:
  1. Inventory renderer dependencies on Node/Electron globals and direct IPC.
  2. Define a typed, capability-oriented `window.min` bridge in a preload module using `contextBridge`.
  3. Validate allowlisted bridge requests in main-process IPC handlers.
  4. Convert a small renderer subsystem to explicit ESM imports and bridge calls, with no behavioral changes.
  5. Add esbuild beside Browserify and reproduce one renderer bundle, source maps, aliases, and output contract.
  6. Migrate remaining renderer modules incrementally, then disable Browserify and renderer Node integration once all direct dependencies are removed.
- Dependencies: Electron `contextBridge` and IPC APIs; esbuild as a development dependency; existing TypeScript compiler for `--noEmit` validation.
- Risks / unknowns: The current renderer depends on global modules and CommonJS alias resolution. IPC and preload scripts may assume Node integration. Bundle output, source maps, CSP, development reloading, and packaging must be verified across platforms.
- Open questions: Which capability groups should form the initial preload API? Should esbuild emit one bundle or use code splitting for internal pages? Can the existing `min://app` protocol load ESM chunks without additional protocol support?

## 11. Acceptance Criteria
- [ ] The main browser-chrome renderer has Node integration disabled and context isolation enabled.
- [ ] Renderer JavaScript cannot access `require`, Node built-ins, direct Electron APIs, or unrestricted IPC at runtime.
- [ ] Required browser-chrome workflows work through documented, allowlisted preload bridge APIs.
- [ ] Renderer bundles are built by esbuild and loaded successfully by Min in development and packaged builds.
- [ ] `npm run typecheck`, existing linting, and applicable unit/integration tests pass.
- [ ] Webview content remains unprivileged and cannot invoke browser-chrome bridge capabilities.

## 12. Testing / Verification
- Manual test plan: Launch Min in development and packaged modes; exercise startup/session restoration, tab lifecycle, browser navigation, prompt actions, settings, downloads, window controls, internal pages, and focused webview browsing. Confirm from renderer devtools that Node globals and direct Electron APIs are unavailable.
- Automated test coverage: Add unit tests for preload API shape and IPC payload validation; integration tests for representative bridge actions; startup tests that assert secure web preferences; build tests confirming generated renderer assets and source maps.
- Regression considerations: Check all platform-specific window behavior, preload scripts, internal protocols, and existing Browserify alias consumers before removing compatibility paths.

## 13. Rollout / Follow-up
- Rollout plan: Deliver in small, independently shippable stages. Retain the existing Browserify path only until an esbuild equivalent is verified, then remove it in a dedicated cleanup change after security settings are enabled.
- Follow-up work: Expand TypeScript types for bridge contracts, review all Electron `webPreferences`, consider sandboxing where Electron compatibility permits, and document the final renderer trust boundary.
