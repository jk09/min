# Feature Specification

## 1. Feature Title
- **Feature name:** Restore Previous Session on Browser Startup
- **Created on:** 2026-08-16 09:58
- **Owner:** Jozef Košík <jozef.kosik@radixal.net>

## 2. Summary
Provide a concise overview of the feature and why it matters.

- **Problem statement:** After starting `min`, the user is presented with an empty address bar and a suggestion/history dropdown instead of the content they were last working with. This forces manual clicking and navigation before browsing can continue.
- **Desired outcome:** On startup, `min` restores the previous browsing session (tabs/tasks and their pages) and displays the previously active page immediately, so browsing continues where it left off.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** Startup opens a new empty tab with the search bar focused and the history/suggestion list expanded (see [startup-searchbar-and-history.png](startup-searchbar-and-history.png)). Session data exists, but the previous page is not shown automatically.
- **Motivation:** A minimal, distraction-free browser should reduce the number of interactions required to resume work. Restoring the previous session preserves user context and matches the "stop tab chaos" goal of `min`.
- **Related issues or references:**
  - Screenshot of current startup state: [startup-searchbar-and-history.png](startup-searchbar-and-history.png)
  - Existing session restore logic: [js/sessionRestore.js](../../../js/sessionRestore.js)
  - Task/tab state: [js/tabState](../../../js/tabState)

## 4. Goals
List the primary outcomes this feature should achieve.

- Goal 1: Restore the previous session's tasks and tabs at startup without user interaction.
- Goal 2: Show the previously active page rendered in the viewport instead of the empty search bar with history suggestions.
- Goal 3: Define deterministic fallback behavior when no previous session exists or session data is unusable.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Non-goal 1: Cross-device or cloud session synchronization.
- Non-goal 2: Redesigning the task overlay, tab bar, or history UI.
- Non-goal 3: Restoring in-page state beyond the page URL (form contents, scroll position, media playback) — treated as possible follow-up work.

## 6. User Stories
Capture the expected user experience.

- As a browser user, I want the previous session displayed at startup so that I can smoothly continue from where I left off.
- As a first-time user, I want a sensible default page at startup so that the browser is never blank or confusing.
- As a returning user whose session data is corrupted, I want the browser to start cleanly on a fallback page so that I am never blocked from browsing.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. On startup, if a previous session exists, `min` restores its tasks and tabs and activates the tab that was active when the browser was last closed.
2. The restored active tab loads and displays its page content; the address bar is not auto-focused and the suggestion/history dropdown is not auto-expanded.
3. If no previous session exists (first run), `min` opens a single tab pointing at the configured default search engine's home page.
4. If the default search engine home page cannot be resolved, `min` opens `https://www.bing.com` as a fallback.
5. If session data exists but cannot be parsed or restored, `min` applies the first-run behavior (requirement 3/4) and does not surface an error blocking startup.
6. The existing session-restore error page/flow remains available for recoverable failures (see [pages/sessionRestoreError](../../../pages/sessionRestoreError)).
7. Startup behavior is consistent for both cold start and restart after a crash, subject to existing crash-handling logic.

## 8. Non-Functional Requirements
Capture quality and system constraints.

- Performance: Startup must not regress noticeably; only the active tab's page is loaded eagerly, background tabs stay lazy/unloaded as today.
- Reliability: Malformed or partial session data must never prevent the browser from starting.
- Security: No new network requests beyond loading the restored/default page; no session data is transmitted off-device.
- Accessibility: Initial keyboard focus lands on the page content in a predictable way; the address bar remains reachable via existing shortcuts.
- Compatibility: Behavior identical on Windows, macOS, and Linux builds.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- User flow: Launch `min` → previous tasks/tabs appear in the tab bar → the previously active page renders → user continues browsing without extra clicks.
- Visual considerations: No empty-state search overlay on startup when a session is restored. The current unwanted state is shown in [startup-searchbar-and-history.png](startup-searchbar-and-history.png) (highlighted area).
- Edge cases:
  - First run / no session data → default search engine home page, otherwise `bing.com`.
  - Previous session contained only an empty new tab → keep the new tab page behavior.
  - Previously active tab had an internal page (settings, reader, error) → restore it if safe, otherwise fall back to the new tab page.
  - Session data present but corrupted → fall back to first-run behavior.

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- Proposed approach: Extend the existing restore path in [js/sessionRestore.js](../../../js/sessionRestore.js) so that after restoring task/tab state it also selects and loads the previously active tab, and suppresses the auto-focus of the search bar for that startup path. Fallback URL resolution should read the configured default search engine, with a hard-coded `bing.com` fallback.
- Dependencies: Existing session persistence, [js/tabState](../../../js/tabState), [js/browserUI.js](../../../js/browserUI.js), [js/searchbar](../../../js/searchbar), default search engine settings.
- Risks / unknowns:
  - Interaction with the existing crash-recovery / session-restore-error flow.
  - Whether search bar auto-focus is required by other startup paths (e.g. new window, new tab).
  - Potential impact on startup time when restoring large sessions.
- Open questions:
  - Should the behavior be user-configurable (setting: "restore previous session" vs "open new tab")?
  - Should this apply only to the first window created at launch, or also to subsequently opened windows?

## 11. Acceptance Criteria
Define how success will be measured.

- [ ] Launching `min` with an existing session displays the previously active page, not the empty search bar with history suggestions.
- [ ] Previously open tasks and tabs are present in the tab bar after startup.
- [ ] First launch with no session data opens the default search engine home page.
- [ ] With no resolvable default search engine, first launch opens `bing.com`.
- [ ] Corrupted session data results in fallback startup without blocking the user.
- [ ] No measurable startup performance regression for typical sessions.

## 12. Testing / Verification
Describe how the feature will be validated.

- Manual test plan:
  1. Open several tabs, close `min`, relaunch → verify tabs restored and last active page displayed.
  2. Clear session data, relaunch → verify default search engine page opens.
  3. Remove/blank the default search engine setting, clear session data, relaunch → verify `bing.com` opens.
  4. Corrupt the session file, relaunch → verify graceful fallback.
- Automated test coverage: Unit tests for the startup URL resolution (previous session → default search engine → `bing.com`) and for restore-failure handling.
- Regression considerations: New tab creation, new window creation, focus mode, task overlay, session restore error page, crash recovery.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- Rollout plan: Ship enabled by default; optionally expose a settings toggle if user feedback requests the old behavior.
- Follow-up work: Restore scroll position and per-tab in-page state; restore multiple windows; configurable custom startup page.
