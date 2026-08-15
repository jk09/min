# Feature Specification

## 1. Feature Title
- **Feature name:** Build commit indicator in the LLM prompt status bar
- **Created on:** 2026-08-15 20:33
- **Owner:** Jozef Košík <jozef.kosik@radixal.net>

## 2. Summary
Show which `git` commit the running browser was built from, directly in the LLM prompt status area.

- **Problem statement:** During rapid iteration on this fork it is impossible to tell, from a running browser window, which source revision the running bundle was built from. Bug reports and manual verification of agentic runs are therefore ambiguous.
- **Desired outcome:** A small, unobtrusive indicator in the LLM prompt status row displays the short commit hash of the build, and reveals fuller build details (full hash, branch, dirty flag, build time) on hover.

## 3. Background and Context

- **Current behavior:** The status row [index.html](index.html#L126-L129) contains `#llm-prompt-engine-state` and `#llm-prompt-result` only. No build provenance is exposed anywhere in the UI. The renderer bundle is produced by [scripts/buildBrowser.js](scripts/buildBrowser.js) via browserify; no build-time metadata is injected.
- **Motivation:** Fast feedback loop for "vibe browsing" development: the developer or agent verifying a feature must be able to confirm the running build matches the commit under test.
- **Related issues or references:**
  - [AGENTS.md](AGENTS.md) - agentic runs commit after each change, so builds change frequently.
  - [css/llmPrompt.css](css/llmPrompt.css#L175-L181) - existing status row styling.

## 4. Goals
- Goal 1: Bake the `git` commit identity of the source tree into the built artifacts at build time.
- Goal 2: Render a compact commit indicator inside the LLM prompt status row.
- Goal 3: Degrade gracefully when `git` metadata is unavailable (e.g. builds from a source tarball).

## 5. Non-Goals
- Non-goal 1: Displaying the full version/update/release information already handled elsewhere (e.g. settings page, about dialog).
- Non-goal 2: Any network lookup of commit metadata (no calls to GitHub or remote APIs).
- Non-goal 3: Runtime shell-out to `git` from the packaged application.

## 6. User Stories
- As a developer of this fork, I want to see the commit hash of the running build in the prompt bar so that I can confirm I am testing the correct revision.
- As an agent verifying a spec implementation, I want a deterministic in-app marker of the build revision so that verification steps can reference it.
- As a regular user, I want the indicator to stay visually minimal so that it does not distract from browsing.

## 7. Functional Requirements
1. The build pipeline generates build metadata containing at minimum: short commit hash (7 chars), full commit hash, branch name, working-tree dirty flag, and build timestamp (ISO 8601).
2. The metadata is embedded into the built renderer bundle at build time; no `git` invocation happens at application runtime.
3. If `git` is not available or the directory is not a repository, the metadata falls back to a placeholder (e.g. short hash `unknown`) and the build must still succeed.
4. The LLM prompt status row renders a new element (e.g. `#llm-prompt-build-info`) showing the short hash, prefixed with a marker such as `#` (e.g. `#a1b2c3d`).
5. When the working tree was dirty at build time, the indicator appends a dirty marker (e.g. `#a1b2c3d*`).
6. The element's `title` (tooltip) contains the full hash, branch, dirty state, and build timestamp.
7. The indicator is present regardless of prompt/engine state and never replaced or cleared by status or result messages.
8. The indicator does not participate in the prompt's `aria-live` announcements (it must not be re-announced as a status change).

## 8. Non-Functional Requirements
- Performance: Zero runtime cost beyond rendering one static text node; no I/O or process spawning at runtime.
- Reliability: Build must not fail when `git` is missing, returns an error, or when building from an exported archive.
- Security: Only commit hash, branch name, dirty flag, and timestamp are embedded. No author identity, remote URL, commit message, paths, or environment values are exposed.
- Accessibility: The indicator is excluded from live-region announcements; the tooltip content is also available via an accessible label.
- Compatibility: Works on Windows, macOS, and Linux builds; consistent in light and dark themes.

## 9. UX / UI Notes
- User flow: User opens the LLM prompt panel; the commit indicator is visible at the trailing edge of the status row and remains static during prompt execution.
- Visual considerations: Reuse the muted styling of `#llm-prompt-engine-state` (small font size, reduced opacity, monospace for the hash). It should not shift layout of `#llm-prompt-result`, which uses `flex: 1` with ellipsis truncation.
- Edge cases:
  - Long status/result text must not push the indicator out of view; the indicator is `flex: none`.
  - Unknown metadata renders a neutral label rather than an empty gap.
  - Very narrow windows: the indicator may be hidden below a minimum width rather than truncated mid-hash.

## 10. Technical Notes
- Proposed approach:
  1. Add a build step (e.g. `scripts/buildInfo.js`) invoked from [scripts/buildBrowser.js](scripts/buildBrowser.js) that resolves `git rev-parse HEAD`, `git rev-parse --abbrev-ref HEAD`, and `git status --porcelain` at build time and writes a generated module (e.g. `dist/buildInfo.build.js`) exposing a frozen `buildInfo` object.
  2. Prepend the generated module to the browserify `fileList` so it is bundled with the renderer, following the existing `dist/localization.build.js` pattern.
  3. Add the markup element to the status row in [index.html](index.html#L126-L129) and styling in [css/llmPrompt.css](css/llmPrompt.css#L175-L181).
  4. Populate the element from a small renderer module under [js/llmPrompt](js/llmPrompt) during prompt panel initialization.
- Dependencies: Node `child_process` at build time only; no new runtime packages.
- Risks / unknowns:
  - Packaging flows that build outside a git checkout must be verified against the fallback path.
  - Whether the same metadata should also be surfaced to the main process (out of scope for now, but the generated module should be reusable).
- Open questions:
  - Should the indicator be clickable to copy the full hash to the clipboard?
  - Should it be hidden in packaged release builds and shown only for local/dev builds?

## 11. Acceptance Criteria
- [ ] A build of the browser embeds the current commit hash without invoking `git` at runtime.
- [ ] The LLM prompt status row shows the short commit hash of the build.
- [ ] The dirty-working-tree marker appears when the build was made from a modified tree.
- [ ] Hovering the indicator reveals full hash, branch, dirty state, and build timestamp.
- [ ] Building in a directory without git metadata succeeds and shows the fallback label.
- [ ] Status and result messages never overwrite or hide the indicator.

## 12. Testing / Verification
- Manual test plan:
  1. Build and launch; compare the displayed short hash with `git rev-parse --short HEAD`.
  2. Modify a tracked file, rebuild, confirm the dirty marker appears.
  3. Run a long prompt producing a long result message; confirm the indicator remains visible and the result truncates.
  4. Toggle light/dark theme and confirm legibility.
- Automated test coverage: Unit test for the build-info generation module covering the success path and the `git`-unavailable fallback; a rendering test asserting the indicator text and `title` from a fixture metadata object.
- Regression considerations: Verify the prompt status `aria-live` region does not produce extra announcements, and that the existing engine-state and result rendering are unchanged.

## 13. Rollout / Follow-up
- Rollout plan: Ship with the next local build; no migration or setting required.
- Follow-up work:
  - Optionally surface the same build metadata on the settings page and in error reports.
  - Consider click-to-copy for the full hash.
