# Feature Specification Template

## 1. Feature Title
- **Feature name:** Migrate main-process build to native ES modules
- **Created on:** 2026-08-15
- **Owner:** Jozef Košík <jozef.kosik@radixal.net>

## 2. Summary
Provide a concise overview of the feature and why it matters.

- **Problem statement:** The main process is currently assembled by [scripts/buildMain.js](../../../scripts/buildMain.js), which reads a hardcoded list of scripts (e.g. `main/main.js`, `main/menu.js`, `main/llmEngine.js`, etc.) and concatenates them with `;\n` separators into a single global-scope file, [main.build.js](../../../main.build.js). This "squashing" approach relies on implicit load order and shared global scope instead of explicit imports/exports, which is a legacy pattern from older Node.js/Electron versions that lacked stable ESM support in the main process.
- **Desired outcome:** The application's main process (and shared main-process utility modules under `main/` and relevant `js/util/` files) should use standard JavaScript module imports (`import`/`export`) instead of relying on script concatenation and implicit globals. The build should either remove the concatenation step entirely (loading `main/main.js` directly as the entry point) or replace it with a minimal bundling/transpilation step that consumes ES module syntax, aligned with the Node.js version already required by the project (`engines.node >= 22.12.0` per [package.json](../../../package.json)) and the bundled Electron version (`42.6.0`).

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** [scripts/buildMain.js](../../../scripts/buildMain.js) defines an ordered `modules` array of CommonJS-style scripts under `main/` and `js/util/`, reads each file synchronously, and concatenates their raw contents into `main.build.js`, which is declared as the Electron app's `main` entry point in [package.json](../../../package.json). Individual files under `main/` (e.g. [main/main.js](../../../main/main.js), [main/menu.js](../../../main/menu.js), [main/llmEngine.js](../../../main/llmEngine.js)) are not self-contained modules — they depend on being executed in a specific order within a shared scope, and cross-file references rely on global variables/functions rather than explicit `require`/`import` statements.
- **Motivation:** Modern Node.js (22.x, as already required by this repo) and current Electron main processes have mature, stable support for ES modules (`import`/`export`, `"type": "module"`, or `.mjs`). Concatenation-based bundling is harder to statically analyze, breaks standard tooling (linters, bundlers, IDE "go to definition"), obscures real module dependencies, and increases the risk of subtle bugs from load-order changes. Moving to explicit imports improves maintainability, testability, and aligns the codebase with current JavaScript/Node.js conventions.
- **Related issues or references:** [scripts/buildMain.js](../../../scripts/buildMain.js), [main.build.js](../../../main.build.js), [package.json](../../../package.json) (`main`, `engines` fields), [AGENTS.md](../../../AGENTS.md) development conventions ("prefer small, testable components with clear responsibilities").

## 4. Goals
List the primary outcomes this feature should achieve.

- Goal 1: Replace implicit global-scope sharing between main-process files with explicit `import`/`export` (or Node.js-compatible `require`/`module.exports` if full ESM migration is staged) module boundaries.
- Goal 2: Eliminate or significantly simplify the `main.build.js` concatenation step so the app's entry point is a real module graph rather than a single generated flat-file bundle.
- Goal 3: Keep the build/packaging pipeline (`scripts/buildMain.js`, `scripts/buildBrowser.js`, and related Electron packaging scripts) functioning for all supported target platforms (Windows, macOS, Linux/AppImage/Debian/Redhat) after the refactor.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Non-goal 1: Rewriting renderer-process (`js/`) code or its bundling strategy; this spec is scoped to the main process build represented by `main.build.js` and its source modules.
- Non-goal 2: Introducing a new general-purpose bundler (e.g. Webpack/Rollup/esbuild) as a large new dependency unless a minimal, justified choice is required to preserve packaging compatibility — dependencies should stay minimal per [AGENTS.md](../../../AGENTS.md).
- Non-goal 3: Changing browser-facing features, UI, or user-visible behavior of Min.

## 6. User Stories
Capture the expected user experience.

- As a maintainer, I want main-process files to declare their dependencies via `import`/`require` statements so that I can trace and reason about module relationships without reading a generated concatenated file.
- As a contributor, I want to add or modify a main-process module without needing to manually register it in a hardcoded build script list.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. Requirement 1: Each file under `main/` (and any shared `js/util/` files it depends on) exports its public API explicitly (via `module.exports`/`exports` or ES `export`) instead of relying on variables implicitly available in a shared global scope.
2. Requirement 2: Cross-module references are updated to use explicit `require(...)`/`import ... from ...` statements instead of assuming prior concatenation order.
3. Requirement 3: `package.json`'s `main` field and/or the build scripts are updated so Electron loads the refactored entry point correctly, with `scripts/buildMain.js` either removed or reduced to only what is still necessary (e.g. localization data generation).
4. Requirement 4: The existing localization build step (currently folded into `buildMain.js` via `require('./buildLocalization.js')()`) continues to produce the data needed by [localization/localizationHelpers.js](../../../localization/localizationHelpers.js) after the refactor.

## 8. Non-Functional Requirements
Capture quality and system constraints.

- Performance: Application startup time should not regress noticeably compared to the current concatenated-bundle approach.
- Reliability: All existing main-process functionality (window management, menus, downloads, filtering, permissions, LLM engine integration, etc.) must continue to work identically after the migration.
- Security: Module boundaries must not introduce new attack surface (e.g. avoid dynamic `require`/`import` of user-controlled paths); preserve existing Electron security settings (context isolation, sandboxing) untouched.
- Accessibility: Not applicable (no UI change expected).
- Compatibility: Must work with the Node.js version already pinned in `engines` (>=22.12.0) and Electron 42.6.0, and across all packaging targets in `scripts/build*.js`.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- User flow: No end-user-facing change; this is an internal build/architecture refactor.
- Visual considerations: None.
- Edge cases: Ensure packaged builds (Windows installer, macOS app, AppImage, Debian, Redhat) still bundle the correct set of files if the flat `main.build.js` is replaced by multiple module files that must be copied/packaged individually.

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- Proposed approach: Incrementally convert `main/*.js` files (and their `js/util/` dependencies) to use explicit `require`/`module.exports` first (safe, no build-step change needed since Node.js supports CommonJS natively), validating each module boundary; then evaluate switching to native ESM (`import`/`export`, `"type": "module"` or `.mjs`) once dependency ordering is explicit. Update or retire [scripts/buildMain.js](../../../scripts/buildMain.js) accordingly, and adjust `package.json`'s `main` entry to point at the real entry module.
- Dependencies: Electron's main-process ESM support and any packaging script assumptions in `scripts/buildWindows.js`, `scripts/buildMac.js`, `scripts/buildAppImage.js`, `scripts/buildDebian.js`, `scripts/buildRedhat.js` that currently assume a single `main.build.js` file.
- Risks / unknowns: Some `main/*.js` files may currently rely on load-order side effects (e.g. globals set by an earlier concatenated file) that are not obvious until each module is isolated; localization data injection (`languages` global) needs an explicit import path once decoupled from concatenation.
- Open questions: Should the project fully adopt native ESM (`"type": "module"`) or is CommonJS with explicit `require`/`module.exports` sufficient to meet the "no more squashing" goal while minimizing packaging risk?

## 11. Acceptance Criteria
Define how success will be measured.

- [ ] No main-process source file relies on implicit global scope sharing from concatenation; all cross-file references use explicit imports/exports.
- [ ] `main.build.js` is either removed or reduced to a minimal, clearly-scoped generated artifact (e.g. only localization data), with `package.json` updated accordingly.
- [ ] The application starts and all existing main-process features (windows, menus, downloads, filtering, permissions, LLM engine, keychain, themes) work as before on at least one supported platform.
- [ ] All packaging scripts (`npm run build`/platform-specific build scripts) succeed without manual intervention.

## 12. Testing / Verification
Describe how the feature will be validated.

- Manual test plan: Run the app in development mode and exercise core flows (open/close windows, menu actions, downloads, LLM prompt usage, theme switching) to confirm no regressions from the module refactor.
- Automated test coverage: Add/extend unit tests around individual `main/` modules where feasible now that they have explicit, testable exports.
- Regression considerations: Verify packaged builds for each supported OS still launch correctly, since the build pipeline's output layout changes.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- Rollout plan: Land the refactor incrementally per module (or small groups of related modules) on a feature branch off `jk-main`, verifying build and manual smoke tests after each step, per [AGENTS.md](../../../AGENTS.md) conventions.
- Follow-up work: Consider applying the same explicit-module approach to renderer-process (`js/`) bundling in a separate future spec.
