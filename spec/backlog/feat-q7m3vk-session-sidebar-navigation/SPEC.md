# Feature Specification Template

## 1. Feature Title
- **Feature name:** Session Sidebar Navigation
- **Created on:** 2026-09-05 16:18:13 +02:00
- **Owner:** Jozef Kosik <jozef.kosik@gmail.com>

## 2. Summary
Replace the horizontal tab strip with a session-oriented sidebar that scales to browsing sessions containing more tabs than fit in the window. Promote navigation breadcrumbs into the primary browser chrome, where they provide page location and back/forward traversal.

- **Problem statement:** The current fixed-width horizontal tab bar makes large browsing sessions difficult to scan and consumes the primary chrome region, while navigation controls and breadcrumbs are split across separate UI surfaces.
- **Desired outcome:** A compact primary navigation bar and optional sidebar let users navigate page history and revisit session tabs without relying on a visible horizontal tab strip.

## 3. Background and Context
The existing UI has a horizontal tab bar, a separate breadcrumb bar, and visible back/forward/menu controls. The feature ledger records `nav-breadcrumbs`, `fixed-width-tabs`, and `simplified-browser-controls` as active features. The retired `tasks-ui` feature must not be reintroduced.

- **Current behavior:** Tabs are displayed horizontally; breadcrumbs show the in-tab navigation chain below them; back and forward buttons are rendered with the menu control.
- **Motivation:** Typical browsing sessions can contain more tabs than the available horizontal space. A vertical list supports scanning many previously visited pages and allows the page hierarchy to become the central navigation affordance.
- **Related issues or references:** [Current browser chrome reference](browser-chrome-reference.png) highlights the current tab bar, breadcrumbs, and controls. [Copilot sidebar reference](copilot-sidebar-reference.png) highlights the intended sidebar density and visual direction.

## 4. Goals
- Goal 1: Replace the visible horizontal tab bar with a prominent breadcrumb-based navigation bar that also provides backward and forward navigation.
- Goal 2: Provide an optional sidebar listing the web page tabs visited in the current browsing session.
- Goal 3: Give each sidebar item a concise page description derived from available page URL, title, metadata, and/or extracted content.

## 5. Non-Goals
- Non-goal 1: Reintroducing task or tab-group user interfaces.
- Non-goal 2: Defining an LLM provider, model, or content-extraction implementation for page descriptions in this specification.

## 6. User Stories
- As a person browsing many pages, I want to open a vertically scrollable session sidebar so that I can find and switch to a previously visited page without horizontal tab overflow.
- As a person navigating a page, I want the prominent breadcrumb bar to provide location context and back/forward navigation so that I can move through my history from one consistent surface.

## 7. Functional Requirements
1. The standard horizontal tab bar must not be displayed in the browser chrome.
2. The breadcrumb bar must occupy the primary navigation-bar position and clearly show the active tab's navigable history or location context.
3. The breadcrumb bar must provide backward and forward navigation for the active tab, with unavailable directions visibly disabled or otherwise unavailable for interaction.
4. The dedicated forward and backward buttons in the existing browser controls must be removed; the menu control must remain available.
5. Users must be able to show and hide a session sidebar without closing or changing the active tab.
6. When shown, the sidebar must list tabs previously visited in the current session, including the active tab, in a vertically scrollable layout.
7. Selecting a sidebar item must activate its corresponding tab.
8. Each sidebar item must display a short, human-readable page description. The description must use the best available page information in this priority order: title, URL, page metadata, and extracted page content.
9. Sidebar descriptions must update when better information becomes available and must fall back gracefully when a page has limited or unavailable metadata/content.
10. Existing tab lifecycle behavior, session restore, browser menu access, and keyboard-driven tab navigation must continue to function unless explicitly replaced by this feature.

## 8. Non-Functional Requirements
- Performance: Opening, closing, selecting, and updating tabs must keep the navigation bar responsive; sidebar rendering must remain usable for sessions that exceed viewport height.
- Reliability: The sidebar must tolerate missing titles, malformed URLs, loading pages, and unavailable page metadata/content without blocking tab selection.
- Security: Page-derived descriptions must be rendered as untrusted text and must not expose private-tab data outside its existing privacy boundary.
- Accessibility: Sidebar entries and navigation controls must be keyboard reachable, have accessible names and selected/disabled state, and preserve visible focus indication.
- Compatibility: The layout must respect supported platform window controls, light/dark theme behavior, and existing window sizes.

## 9. UX / UI Notes
- User flow: The browsing surface opens with the prominent breadcrumb navigation bar and no horizontal tab strip. The user invokes the optional session sidebar, scans descriptions, selects a page, and dismisses the sidebar when more content width is needed.
- Visual considerations: Use a restrained, dense vertical list inspired by [Copilot sidebar reference](copilot-sidebar-reference.png), not a task-group UI. The promoted breadcrumb bar replaces the red-outlined tab region in [Current browser chrome reference](browser-chrome-reference.png); backward/forward affordances belong in that bar, while the menu remains as the sole existing chrome control in the blue-outlined region.
- Edge cases: Handle a one-tab session, a sidebar with more entries than viewport height, duplicate or empty titles, in-progress navigation, and entries whose descriptions are still being derived.

## 10. Technical Notes
- Proposed approach: Build on the existing tab state and navigation-history APIs. Separate description derivation from sidebar rendering so that UI updates can use progressively richer page information without changing tab-selection behavior.
- Dependencies: Existing `nav-breadcrumbs`, tab state, webview navigation events, session restore, theming, and menu infrastructure.
- Risks / unknowns: The source, computation cost, storage lifetime, and privacy treatment of content-derived descriptions are undecided. The sidebar invocation mechanism and its default visibility are also undecided.
- Open questions: Should descriptions be deterministic local summaries only, or may an optional configured LLM generate them? Should the sidebar list only live tabs, or retain recently closed/visited pages? Which keyboard shortcut and menu entry should toggle it?

## 11. Acceptance Criteria
- [ ] The horizontal tab bar is absent from the normal browser chrome, and the breadcrumb navigation bar occupies its primary position.
- [ ] The breadcrumb navigation bar displays active-tab context and allows back/forward traversal with correct unavailable-state behavior.
- [ ] Dedicated back and forward controls are absent while the menu control remains usable.
- [ ] Users can toggle a vertically scrollable session sidebar and activate any listed tab.
- [ ] Every sidebar entry has a concise fallback-safe description derived from the available page information.
- [ ] The implementation does not reintroduce task grouping UI and retains existing tab lifecycle and session-restore behavior.

## 12. Testing / Verification
- Manual test plan: Open enough tabs to exceed the window's horizontal capacity, navigate backward and forward within a tab, toggle the sidebar, select several listed entries, and verify descriptions for titled, untitled, loading, and content-limited pages in both light and dark themes.
- Automated test coverage: Add unit coverage for description fallback/normalization and sidebar list state; add integration coverage for tab-state, navigation-history, and toggle behavior; add end-to-end coverage for visual tab-strip removal, sidebar activation, and menu availability.
- Regression considerations: Verify session restore, private-tab handling, focus mode, keyboard tab navigation, and platform-specific window-control spacing.

## 13. Rollout / Follow-up
- Rollout plan: Implement behind a controlled preference or feature flag until large-session usability, accessibility, and description-quality behavior are validated.
- Follow-up work: Decide the description-generation policy, retention scope for historical entries, and any search/filter capability after observing real session sizes.