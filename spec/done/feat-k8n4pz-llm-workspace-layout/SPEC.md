## 1. Feature Title
- **Feature name:** LLM-First Workspace Layout
- **Created on:** 2026-08-09 14:58:15
- **Owner:** Jozef Košík <jozef.kosik@radixal.net>

## 2. Summary
Provide a concise overview of the feature and why it matters.

- **Problem statement:** The current browser layout is centered on classic multi-tab browsing and Min-specific task grouping, which does not fit an LLM-driven workflow where a user may want to compare several pages, keep one page per task, and move quickly between focused workspaces.
- **Desired outcome:** Replace the tab-centric interface with a single visual work surface made of tiles, where each tile holds a separate web page and the selected task is represented as a visual layout indicator rather than a traditional tab bar.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** Min organizes browsing around tabs and tasks, with a tab bar taking up horizontal space and task switching represented as browser-level navigation state.
- **Motivation:** LLM-driven browsing favors spatial comparison, parallel context, and explicit task boundaries. A tile-based layout is more aligned with prompt-driven workflows than a long tab strip.
- **Related issues or references:** This is a broad UX rework that likely touches tab management, task overlay behavior, window chrome, and layout rendering.

## 4. Goals
List the primary outcomes this feature should achieve.

- Goal 1: Replace the classic tab strip with a tile-oriented visual estate.
- Goal 2: Tie each tiled layout to a task so the browser can present separate prompt-driven workspaces.
- Goal 3: Increase the usable drag handle area for moving the application window.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Non-goal 1: Rebuilding the entire webview or page rendering pipeline.
- Non-goal 2: Implementing a full collaboration or multi-user workspace system.

## 6. User Stories
Capture the expected user experience.

- As a prompt-driven browser user, I want to arrange multiple pages as tiles so that I can compare and act on them within one task-oriented workspace.
- As a user switching between research threads, I want each tile layout to map to a task so that I can keep context separated without relying on many tabs.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. The primary browsing surface must support a tile-based layout that can display multiple web pages within one visible estate.
2. Each tile layout must be associated with a selected task, and switching tasks must restore or activate the corresponding layout.
3. The traditional tab bar must be removed or visually replaced by a task/layout indicator that clearly shows the active task.
4. The application chrome must reserve more space for window dragging so the browser remains easy to reposition even with a denser layout.

## 8. Non-Functional Requirements
Capture quality and system constraints.

- Performance: Tile layout changes should remain responsive and avoid unnecessary page reloads or expensive re-renders.
- Reliability: Switching between tasks and tile arrangements should not lose page state unexpectedly.
- Security: The redesign must preserve existing page isolation, permissions, and browser safety boundaries.
- Accessibility: Task indicators, tile controls, and drag regions must remain keyboard- and assistive-technology friendly.
- Compatibility: The new layout should work across supported desktop platforms and windowing environments.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- User flow: Open a task, arrange one or more pages into tiles, use the task indicator to switch layouts, and drag the window using the expanded chrome region.
- Visual considerations: The layout should feel minimal and spacious, with the active task clearly emphasized and tiles visually distinct without introducing clutter.
- Edge cases: Empty tasks, a single-tile task, and oversized tile counts should all degrade gracefully without exposing a broken or cramped interface.

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- Proposed approach: Introduce a layout manager that treats tasks as the primary container and pages as tile instances, then adapt the existing chrome to surface the active task instead of a tab strip.
- Dependencies: Existing task state, window chrome, and page/webview embedding infrastructure.
- Risks / unknowns: Multi-webview tiling may require significant changes to focus handling, drag behavior, and persisted session state.
- Open questions: How tile layouts are serialized, how many tiles should be supported initially, and whether the task indicator should expose quick actions beyond selection.

## 11. Acceptance Criteria
Define how success will be measured.

- [ ] A user can browse with a tile-based layout instead of a classic tab bar.
- [ ] Each task can own its own tile layout and be switched to without losing the layout association.
- [ ] The window drag region is visibly larger and practical for moving the browser.

## 12. Testing / Verification
Describe how the feature will be validated.

- Manual test plan: Create several tasks, assign different page tiles to each task, switch between them, and verify the active layout and window drag behavior.
- Automated test coverage: Add tests for task-to-layout persistence, tile activation, and any state restoration logic introduced by the layout manager.
- Regression considerations: Confirm existing browsing, focus, and page loading behavior still works when the browser is used in a single-tile or tile-free state.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- Rollout plan: Deliver behind an internal feature branch or hidden setting first, then expand once the task-tile model is stable.
- Follow-up work: Consider richer tile operations such as splitting, merging, reordering, and prompt-specific layout templates.