# Feature Specification

## 1. Feature Title
- **Feature name:** Draggable empty area in the tab bar
- **Created on:** 2026-08-16 12:29
- **Owner:** Jozef Košík <jozef.kosik@radixal.net>

## 2. Summary
Make the empty horizontal space in the tab bar - between the last visible tab and the tab-overflow indicator ("… more tabs") - act as a window drag handle, so users can move the window by grabbing it.

- **Problem statement:** The only reliable drag target for moving the window is a very narrow strip (about 12px) above the tabstrip. Hitting it requires precise mouse aim and is not user-friendly.
- **Desired outcome:** The unused space inside the tab bar behaves like a titlebar: pressing and dragging it moves the window, while clicks on tabs, buttons and the overflow indicator keep their current behavior.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:**
  - `#navbar` is marked with the `windowDragHandle` class in [index.html](index.html#L73), but that class is only used for click-suppression logic in [js/default.js](js/default.js#L123), not for actual OS window dragging.
  - Real dragging is provided by `.window-drag-area`, a fixed 12px-high strip above the tabstrip on Windows/Linux and a 7px strip on macOS - see [css/windowControls.css](css/windowControls.css#L18-L37).
  - The empty region left of the overflow label inside `#tabs` has no `-webkit-app-region: drag`, so mouse presses there do nothing.
- **Motivation:** Window movement is a basic OS interaction; requiring a pixel-precise strip contradicts the minimal, low-friction character of Min.
- **Related issues or references:**
  - Screenshot with the affected area circled in red: [tabbar-empty-drag-area-reference.png](spec/backlog/feat-p4x9qw-draggable-tabbar-empty-area/tabbar-empty-drag-area-reference.png)
  - Existing drag-region styles: [css/windowControls.css](css/windowControls.css)
  - Tab bar layout: [css/tabBar.css](css/tabBar.css)
  - Overflow indicator: [js/navbar/tabOverflowPanel.js](js/navbar/tabOverflowPanel.js)

## 4. Goals
- Goal 1: Allow the user to drag the browser window by pressing and moving the pointer in the empty part of the tab bar.
- Goal 2: Preserve all existing interactions of tabs, the menu button, navigation buttons and the tab-overflow label.
- Goal 3: Keep the existing narrow drag strip working so no current workflow regresses.

## 5. Non-Goals
- Non-goal 1: Redesigning the tab bar layout, tab sizing, or the overflow indicator.
- Non-goal 2: Adding a full custom titlebar or changing window control buttons.
- Non-goal 3: Making tabs themselves draggable to move the window.

## 6. User Stories
- As a desktop user, I want to grab the empty space in the tab bar so that I can reposition the window without aiming at a thin strip.
- As a user with a large number of tabs, I want the small gap before "… more tabs" to still be draggable so that the behavior is predictable regardless of tab count.
- As a user, I want double-clicking that empty area to maximize/restore the window so that it matches native titlebar conventions.

## 7. Functional Requirements
1. The empty area of the tab bar (the region of `#tabs` not covered by a tab, and any spare space before the tab-overflow label) is a window drag region.
2. Interactive children remain non-draggable: individual tabs, `#menu-button`, `#toolbar-navigation-buttons`, `#tab-editor`, `#tab-overflow-label`, and the Windows caption buttons must keep `-webkit-app-region: no-drag`.
3. Double-clicking the draggable empty area toggles maximize/restore where the platform supports it.
4. When no empty space exists (tab bar fully filled), the behavior is unchanged and no interactive element is blocked.
5. The existing `.window-drag-area` strip continues to work as today.
6. Right-clicking the empty area does not lose any existing context-menu behavior.

## 8. Non-Functional Requirements
- Performance: CSS-only or minimal-JS solution; no measurable impact on tab bar rendering or resize handling.
- Reliability: Drag behavior must be stable across maximized, restored, fullscreen and separate-titlebar modes.
- Security: No new IPC surface; if window-move actions are needed, reuse existing trusted main-process channels.
- Accessibility: Keyboard focus order and screen-reader semantics of the tab bar must not change; drag regions must not become focus traps.
- Compatibility: Verified on Windows, Linux and macOS; must respect `body.maximized`, `body.fullscreen` and `body.separate-titlebar` states.

## 9. UX / UI Notes
- User flow: Press the left mouse button on the empty tab bar area → move the pointer → the window follows → release to drop.
- Visual considerations: No visual change is expected; the area stays visually identical to today. See the circled region in [tabbar-empty-drag-area-reference.png](spec/backlog/feat-p4x9qw-draggable-tabbar-empty-area/tabbar-empty-drag-area-reference.png).
- Edge cases:
  - On Windows, `-webkit-app-region: drag` elements are not clickable; ensure the change does not swallow clicks intended for the overflow label or tabs.
  - Tab drag-and-drop reordering and drag-to-detach must still work.
  - Small residual gaps (a few pixels) between tabs should not become drag regions if that would break tab clicking.

## 10. Technical Notes
- Proposed approach: Apply `-webkit-app-region: drag` to the tab bar background container (`#navbar` and/or `#tabs`) and explicitly set `-webkit-app-region: no-drag` on every interactive descendant, following the pattern already used in [css/tabEditor.css](css/tabEditor.css#L25).
- Dependencies: Electron app-region behavior; existing styles in [css/windowControls.css](css/windowControls.css) and [css/tabBar.css](css/tabBar.css).
- Risks / unknowns:
  - Over-broad drag regions on Windows can make child elements unclickable.
  - Interaction with the click-suppression logic in [js/default.js](js/default.js#L110-L138).
  - Whether `#tabs-inner` horizontal scrolling by drag conflicts with window dragging.
- Open questions:
  - Should the whole `#navbar` background be draggable, or only the space after the last tab?
  - Should double-click-to-maximize be included in the first iteration?

## 11. Acceptance Criteria
- [ ] Pressing and dragging the empty tab bar area moves the window on Windows, Linux and macOS.
- [ ] Tabs, menu button, navigation buttons, tab editor and the tab-overflow label remain fully clickable.
- [ ] Tab reordering / drag-and-drop still works.
- [ ] The existing narrow drag strip still moves the window.
- [ ] No visual regression in the tab bar in normal, maximized and fullscreen modes.

## 12. Testing / Verification
- Manual test plan:
  1. Open Min with few tabs; drag the wide empty area - window moves.
  2. Open enough tabs to show "… more tabs"; drag the narrow gap before the label - window moves; click the label - overflow panel opens.
  3. Click each tab, the menu button and navigation buttons - all respond normally.
  4. Reorder tabs by dragging - order changes, window does not move.
  5. Repeat in maximized and fullscreen modes and with a separate titlebar.
- Automated test coverage: Add a smoke assertion in [test](test) that interactive tab bar elements are still clickable after the style change, if the harness supports it.
- Regression considerations: Tab click handling, tab drag-and-drop, tab-overflow panel, focus mode, and the mac drag area.

## 13. Rollout / Follow-up
- Rollout plan: Ship as part of a normal build; no flag needed if manual verification passes on all three platforms.
- Follow-up work: Consider removing or shrinking the legacy `.window-drag-area` strip once the tab bar drag region proves reliable.
