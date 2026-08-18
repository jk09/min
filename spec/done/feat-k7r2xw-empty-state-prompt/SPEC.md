# Feature Specification

## 1. Feature Title
- **Feature name:** Blank empty state with LLM prompt when no tabs are open
- **Created on:** 2026-08-18 20:52
- **Owner:** Jozef Košík <jozef.kosik@gmail.com>

## 2. Summary
Replace the leftover address-selection UI shown when all tabs are closed with a blank screen that surfaces the LLM prompt instead.

- **Problem statement:** When the last tab is closed, Min falls back to the legacy new-tab/edit-mode UI: an "Search or enter address" input with searchbar plugin results (history, bookmark suggestions, action buttons). This is redundant in a prompt-driven browser and inconsistent with the LLM prompt as the primary entry point.
- **Desired outcome:** Closing all tabs (or opening a new empty tab) shows a clean, blank surface where the LLM prompt is the single, focused way to start a browsing session.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** `browserUI.addTab()` calls `tabEditor.show(tabId)` for new/empty tabs, which opens the searchbar (`js/navbar/tabEditor.js`, `js/searchbar/*`) and sets `document.body.classList.add('is-ntp')` in `switchToTab()`. The LLM prompt overlay explicitly refuses to open in this state (`isOverlayAvailable()` in [js/llmPrompt/promptPanel.js](js/llmPrompt/promptPanel.js) returns `false` when `is-ntp` is set). The result is the leftover UI captured in the screenshot below.
- **Motivation:** Simplicity, consistency with the fork's prompt-driven goals, and removal of redundant code to keep the browser lightweight.
- **Related issues or references:**
  - Screenshot of the current leftover address selector: [leftover-address-selector.png](leftover-address-selector.png)
  - [js/browserUI.js](js/browserUI.js), [js/navbar/tabEditor.js](js/navbar/tabEditor.js), [js/llmPrompt/promptPanel.js](js/llmPrompt/promptPanel.js)

## 4. Goals
- Goal 1: Show a blank (empty) screen instead of the address selector / searchbar results when there are no tabs with a URL.
- Goal 2: Make the LLM prompt available — and preferably auto-focused — in that empty state.
- Goal 3: Remove or bypass the now-redundant new-tab edit-mode code paths so the runtime footprint shrinks.

## 5. Non-Goals
- Non-goal 1: Removing the address bar entirely for tabs that already have a URL (edit mode for existing pages is out of scope for this change).
- Non-goal 2: Redesigning the LLM prompt panel itself, its agents, or its skills.

## 6. User Stories
- As a user who just closed the last tab, I want a calm, blank screen with the prompt ready so that I can immediately state my intent instead of picking from stale suggestions.
- As a user who opens a new tab, I want a consistent prompt-first entry point so that the browser behaves the same way everywhere.

## 7. Functional Requirements
1. Requirement 1: When the selected tab has no URL (including the state after closing the last tab), the browser MUST NOT show the tab editor input, searchbar plugin results, or the new-tab page decorations.
2. Requirement 2: In that state the visible content area MUST be blank, using the current theme background.
3. Requirement 3: The LLM prompt MUST be openable in the empty state; `isOverlayAvailable()` must no longer block on the empty/new-tab condition.
4. Requirement 4: The LLM prompt SHOULD open automatically (input focused) when the empty state is entered, so no extra click is required.
5. Requirement 5: Closing the prompt while in the empty state MUST leave a blank screen, not re-open the address selector.
6. Requirement 6: Existing keyboard shortcuts that previously opened the tab editor for an empty tab SHOULD open the LLM prompt instead, or be removed if redundant.
7. Requirement 7: Code paths that exist solely to render the empty-tab searchbar experience SHOULD be deleted rather than merely hidden.

## 8. Non-Functional Requirements
- Performance: Fewer DOM nodes and no searchbar plugin execution on empty tabs; startup and tab-close paths should be no slower than today.
- Reliability: Session restore and task switching must not leave the browser in a state with neither a page nor a usable prompt.
- Security: No new network requests; removing history/suggestion rendering in the empty state reduces incidental exposure of browsing history.
- Accessibility: The empty state must expose a focusable prompt with an accessible name; focus must not be trapped in an invisible element.
- Compatibility: Behavior must be identical across Windows, macOS, and Linux builds, and in both light and dark themes.

## 9. UX / UI Notes
- User flow: User closes the last tab → tab strip shows a single empty tab → content area is blank → the LLM prompt overlay is shown with the input focused → user types a prompt or a `/` skill and the session continues.
- Visual considerations: Blank background only; no placeholder text, no logo, no suggestion lists. Current UI to be removed is shown in [leftover-address-selector.png](leftover-address-selector.png).
- Edge cases:
  - Private/incognito tabs.
  - Focus mode and modal mode, where overlays are currently suppressed.
  - Session restore that yields zero tabs.
  - Escape pressed while the prompt is open in the empty state.

## 10. Technical Notes
- Proposed approach:
  1. In [js/browserUI.js](js/browserUI.js), stop calling `tabEditor.show()` for empty tabs and instead trigger the LLM prompt panel.
  2. Keep or repurpose the `is-ntp` body class as a pure "blank surface" marker; drop the new-tab page background/image picker chrome if it becomes unused.
  3. Update `isOverlayAvailable()` in [js/llmPrompt/promptPanel.js](js/llmPrompt/promptPanel.js) so the overlay is allowed on the blank surface.
  4. Prune the searchbar/tab-editor entry points that only served the empty-tab case; keep whatever is still needed for editing an existing page's URL.
- Dependencies: `js/navbar/tabEditor.js`, `js/searchbar/*`, `js/newTabPage.js`, `js/llmPrompt/promptPanel.js`, `index.html`, `css/newTabPage.css`.
- Risks / unknowns: The searchbar module is used by other flows (bookmark search, task overlay); removal must be scoped carefully to avoid breaking them.
- Open questions:
  - Should the address/tab editor remain reachable at all for empty tabs (e.g. via an explicit shortcut) as an escape hatch?
  - Should the prompt auto-open, or only be one keystroke away?

## 11. Acceptance Criteria
- [ ] Closing all tabs shows a blank content area with no address input and no suggestion list.
- [ ] The LLM prompt is available and focused in the empty state.
- [ ] Dismissing the prompt in the empty state returns to a blank screen.
- [ ] No regressions in URL editing for tabs that already have a page loaded.
- [ ] Dead new-tab/searchbar code for the empty state is removed from the codebase.

## 12. Testing / Verification
- Manual test plan: Close all tabs; open a new tab; switch tasks; restore a session with no tabs; verify blank surface plus focused prompt in each case, in light and dark themes.
- Automated test coverage: Add or update tests under [test/](test) covering the empty-tab state transition and the prompt overlay availability check.
- Regression considerations: Bookmark search, task overlay search, find-in-page, focus mode, and modal mode must continue to work.

## 13. Rollout / Follow-up
- Rollout plan: Ship as a single change on a feature branch; no setting or migration required.
- Follow-up work: Consider showing lightweight prompt suggestions (recent prompts, skills) on the blank surface once the empty state is stable.
