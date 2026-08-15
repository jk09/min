# Feature Specification Template

## 1. Feature Title
- **Feature name:** Remove Tasks functionality from the Min browser
- **Created on:** 2026-08-15 17:56:18 +02:00
- **Owner:** Jozef Košík

## 2. Summary
Simplify the Min browser interface by removing the Tasks functionality and presenting only the web viewer, the tab bar, and the LLM prompt.

- **Problem statement:** Tasks add UI and workflow complexity that is not needed for the intended minimal, prompt-driven browsing experience.
- **Desired outcome:** Users see a focused browser layout with the tab bar at the top, the web viewer occupying the main window area, and the LLM prompt at the bottom, without task-related controls or behavior.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** The browser includes Tasks functionality and task-related UI for grouping and organizing tabs.
- **Motivation:** Reduce visual and interaction complexity while preserving the core browsing workflow and prompt-driven interaction.
- **Related issues or references:** None provided.

## 4. Goals
List the primary outcomes this feature should achieve.

- Remove the Tasks feature and its user-facing controls from the browser.
- Preserve the web viewer as the main part of the window estate.
- Keep the tab bar at the top and the LLM prompt at the bottom as the primary surrounding UI.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Redesigning the web viewer, tab bar, or LLM prompt beyond changes required to remove Tasks.
- Removing tabs or changing general tab navigation behavior.

## 6. User Stories
Capture the expected user experience.

- As a browser user, I want a focused interface without task controls so that I can concentrate on the current web content.
- As a prompt-driven browsing user, I want the LLM prompt to remain available at the bottom of the window so that I can continue issuing browsing instructions.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. The browser must no longer display task-related controls, overlays, menus, labels, or status indicators.
2. The browser must no longer expose commands or keyboard shortcuts that create, switch, rename, delete, collapse, or otherwise manage Tasks.
3. The tab bar must remain at the top of the window and continue to support the existing tab workflow independently of Tasks.
4. The web viewer must occupy the main portion of the window estate.
5. The LLM prompt must remain visible and usable at the bottom of the window.
6. Existing sessions or persisted state containing Tasks must not cause task UI to reappear or prevent the browser from starting; migration or graceful ignoring of obsolete task data must be handled as needed.

## 8. Non-Functional Requirements
Capture quality and system constraints.

- **Performance:** Removing Tasks must not add measurable overhead to startup, tab switching, or prompt interaction.
- **Reliability:** The browser must start and restore usable tabs when obsolete task state is present.
- **Security:** No change to existing web content isolation, permission handling, or privacy behavior.
- **Accessibility:** The remaining tab bar, web viewer, and LLM prompt must retain accessible focus order and keyboard access.
- **Compatibility:** The simplified layout must work across the platforms and window sizes currently supported by Min.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- **User flow:** The user opens Min, selects or creates tabs from the top tab bar, views content in the main area, and enters prompts in the bottom LLM prompt.
- **Visual considerations:** The layout should contain only the three requested primary surfaces, with no empty reserved region or task-specific affordance left behind.
- **Edge cases:** Existing task data, task-specific deep links, and task-related shortcuts must be ignored, migrated, or removed without blocking normal browsing.

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- **Proposed approach:** Trace the task state, task overlay, task commands, tab/task layout integration, persistence, and related styling; remove or bypass those paths while retaining independent tab, webview, and LLM prompt behavior.
- **Dependencies:** Existing Min UI, session restore, keybinding, menu, and persistence modules.
- **Risks / unknowns:** Tasks may be coupled to tab state, session restoration, keyboard shortcuts, or window layout; those dependencies must be separated without regressing tabs.
- **Open questions:** Should obsolete task data be deleted during migration, or retained but ignored for compatibility?

## 11. Acceptance Criteria
Define how success will be measured.

- [ ] The running browser UI contains only the top tab bar, the main web viewer, and the bottom LLM prompt; no Tasks UI is visible.
- [ ] Task creation, switching, editing, deletion, collapse, and related commands are unavailable.
- [ ] Tabs can still be opened, selected, closed, and restored without Tasks.
- [ ] The web viewer occupies the main window area and the LLM prompt remains usable at the bottom.
- [ ] Startup and session restoration succeed when previously persisted task data exists.
- [ ] Relevant automated tests and platform-specific checks pass.

## 12. Testing / Verification
Describe how the feature will be validated.

- **Manual test plan:** Launch Min, inspect the initial layout, exercise tab creation and navigation, submit an LLM prompt, test relevant keyboard shortcuts and menus, and restore a session containing legacy task data.
- **Automated test coverage:** Add or update tests for task command absence, simplified layout composition, tab behavior without Tasks, and legacy session-state handling.
- **Regression considerations:** Verify session restore, tab persistence, menu rendering, keybindings, window resizing, and LLM prompt interactions on supported platforms.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- **Rollout plan:** Ship as a focused UI and behavior simplification after migration and regression checks pass.
- **Follow-up work:** Remove obsolete task data and dead code after compatibility requirements are confirmed; update user documentation and screenshots where Tasks are referenced.
