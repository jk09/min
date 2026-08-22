# Feature Specification Template

## 1. Feature Title
- **Feature name:** Navigation Breadcrumbs Bar
- **Created on:** 2026-08-22
- **Owner:** Jozef Košík <jozef.kosik@gmail.com>

## 2. Summary
Add an in-tab "breadcrumbs" navigation bar, similar to the path bar used in file explorers, that visually tracks the sequence of pages the user has navigated through within the current tab, and lets the user jump directly to any prior (or previously visited, deeper) page in that sequence.

- **Problem statement:** The only way to retrace navigation within a tab today is the back/forward buttons, which only move one step at a time and give no overview of how deep the user has navigated away from the page originally loaded in the tab.
- **Desired outcome:** Users can see, at a glance, the chain of pages visited in the current tab (from the tab's origin page to the current page) and jump backward or forward to any level in that chain with a single click, without losing the deeper levels they navigated away from.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** `Min` exposes only linear back/forward navigation (see [browserUI.js](../../../js/browserUI.js) and the navbar controls in [js/navbar](../../../js/navbar)). There is no persistent, at-a-glance representation of the navigation depth or path for a tab.
- **Motivation:** File-explorer-style breadcrumb bars (see reference screenshot) let users understand and jump across a navigation hierarchy far more efficiently than incremental back/forward clicks, especially after many in-tab link follows.
- **Related issues or references:**
  - [file-explorer-breadcrumbs-reference.png](file-explorer-breadcrumbs-reference.png) — reference example of a breadcrumb path bar in a file explorer (Windows Explorer address bar).
  - [min-tab-bar-breadcrumbs-placement.png](min-tab-bar-breadcrumbs-placement.png) — annotated screenshot of `Min`'s tab bar showing where the new breadcrumbs bar should be placed (the highlighted area below the tab strip, above the page content).

## 4. Goals
List the primary outcomes this feature should achieve.

- Goal 1: Display a semi-transparent breadcrumbs bar directly below the tab bar, showing the chain of pages navigated within the currently active tab.
- Goal 2: Grow the breadcrumb chain as the user follows links while staying in the same tab, and allow jumping back/forward to any breadcrumb level in one click.
- Goal 3: Preserve "deeper" breadcrumb levels (subdued/greyed out) after navigating backward, so the user can jump forward again without losing that history.
- Goal 4: Gracefully truncate the breadcrumbs bar to fit the available width, always keeping the deepest (most recent) navigation levels visible, while still supporting expansion when space allows or when requested.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Non-goal 1: Replacing or removing the existing back/forward buttons or their keyboard shortcuts.
- Non-goal 2: Cross-tab or cross-session breadcrumb persistence (breadcrumbs reset when a tab is closed or reset to a fresh navigation origin, consistent with existing per-tab history behavior).
- Non-goal 3: Building a general-purpose site-path breadcrumb parser (e.g. inferring a page's URL path hierarchy); this feature only reflects user navigation actions, not URL structure.

## 6. User Stories
Capture the expected user experience.

- As a user who followed several links from a page, I want to see how many pages deep I've navigated so that I don't lose track of where I started.
- As a user who went back a few pages, I want the pages I navigated away from to still be visible (subdued) in the breadcrumb bar so that I can jump forward again without re-navigating manually.
- As a user with many navigation levels, I want the breadcrumb bar to truncate intelligently so that it remains usable and always shows my most recent (deepest) navigation steps.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. A breadcrumbs bar is rendered below the tab bar (per [min-tab-bar-breadcrumbs-placement.png](min-tab-bar-breadcrumbs-placement.png)), with a semi-transparent background, and is only visible for the currently active tab.
2. Each in-tab navigation event (following a link, submitting a form, script-driven navigation, etc. that changes the page within the same tab) appends a new breadcrumb item to the right end of the bar for that tab.
3. Each breadcrumb item displays a short page description (title/short label), styled similarly to but visually smaller than the corresponding tab bar tab label, and reflects live updates if the page title changes.
4. Clicking a breadcrumb item navigates the tab directly to that history entry, without discarding any breadcrumb items beyond it.
5. After jumping backward (either via a breadcrumb click or the existing back button), breadcrumb items representing pages deeper than the current position remain visible but rendered in a visually subdued/dimmed state to indicate they are no longer the active path but are still reachable.
6. Navigating forward again (via a breadcrumb click or the existing forward button) restores the subdued items to their normal active appearance up to the new current position.
7. If a user navigates to a new link from a position that is not at the deepest breadcrumb level, the breadcrumbs beyond the current position are replaced by the new navigation path (matching standard back/forward-then-navigate browser history semantics), while still following the truncation/expansion rules below.
8. When the full breadcrumb chain does not fit in the available width, the bar truncates the oldest (shallowest) items first, always keeping the deepest/most recent items visible.
9. The truncated bar provides a mechanism (e.g. an overflow indicator/menu) to reveal or expand into the hidden shallower items, and truncation must reverse (re-expand) automatically as the window/tab area is resized larger.
10. Per-tab breadcrumb state is independent; switching tabs shows that tab's own breadcrumb chain, and the bar is hidden or collapsed to a single item for tabs with no additional in-tab navigation yet.

## 8. Non-Functional Requirements
Capture quality and system constraints.

- Performance: Breadcrumb updates must not introduce noticeable input or navigation latency; rendering should be incremental (append/update, not full rebuild) where practical.
- Reliability: Breadcrumb state must stay consistent with the tab's actual navigation history (no duplicate, missing, or stale entries after rapid navigation).
- Security: Breadcrumb labels must be derived from trusted page metadata (e.g. document title) and safely escaped/sanitized before rendering to avoid script or markup injection.
- Accessibility: Breadcrumb items must be keyboard-navigable and expose accessible names/roles (e.g. `nav`/`list` semantics) for screen readers.
- Compatibility: Must integrate with the existing tab/webview architecture (see [js/webviews.js](../../../js/webviews.js), [js/tabState](../../../js/tabState), [js/browserUI.js](../../../js/browserUI.js)) without breaking existing back/forward navigation behavior.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- User flow: User opens a page in a tab → follows links → breadcrumb bar grows to the right → user clicks an earlier breadcrumb → page navigates back, later breadcrumbs become subdued but remain clickable → user clicks a subdued breadcrumb → navigates forward again and restores it (and everything up to it) to active styling.
- Visual considerations: Semi-transparent bar background positioned directly beneath the tab bar (see [min-tab-bar-breadcrumbs-placement.png](min-tab-bar-breadcrumbs-placement.png)); breadcrumb item labels use a smaller font size than tab labels; active vs. subdued/forward-available items are visually distinguished (e.g. opacity or color difference), similar in spirit to the folder path styling in [file-explorer-breadcrumbs-reference.png](file-explorer-breadcrumbs-reference.png).
- Edge cases:
  - Single-page tab (no additional navigation yet): breadcrumb bar may be hidden or show only the current page.
  - Very deep navigation chains: truncate from the shallow (left) end; provide an affordance to reach truncated items.
  - Window/tab resize: truncation state must recompute responsively in both directions (truncate further on shrink, expand on grow).
  - Page title changes after load (e.g. async title updates): breadcrumb label should update to match.
  - Tab closed or reloaded to a fresh URL bar entry: breadcrumb chain resets appropriately, consistent with how tab history is otherwise reset.

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- Proposed approach: Introduce a per-tab breadcrumb history model built on top of (or alongside) the existing webview navigation history in [js/tabState](../../../js/tabState) and [js/webviews.js](../../../js/webviews.js); render the bar as a new UI component (e.g. under [js/navbar](../../../js/navbar)) with its own stylesheet (e.g. a new `css/breadcrumbsBar.css`), following the pattern of existing bars like [css/tabBar.css](../../../css/tabBar.css).
- Dependencies: Existing tab/webview navigation events (`did-navigate`, `did-navigate-in-page`, title-updated events) and current tab bar rendering pipeline in [js/browserUI.js](../../../js/browserUI.js).
- Risks / unknowns: Distinguishing "new link followed" navigation from same-page anchor/hash navigation or SPA route changes when deciding whether to append a new breadcrumb; determining a reliable truncation/measurement strategy that stays performant on window resize.
- Open questions: Should breadcrumb history be discarded when the tab's URL bar entry changes to an unrelated address (i.e., manual URL entry treated as a new "origin" breadcrumb), or should it retain prior levels?

## 11. Acceptance Criteria
Define how success will be measured.

- [ ] A semi-transparent breadcrumbs bar appears below the tab bar for the active tab and updates as the user navigates via links within that tab.
- [ ] Clicking any breadcrumb item navigates directly to that page without losing deeper (forward) breadcrumb items.
- [ ] Breadcrumb items beyond the current navigation position are rendered in a visually subdued state and remain clickable to move forward again.
- [ ] The breadcrumbs bar truncates from the shallow end when it does not fit the available width, always keeping the deepest levels visible, and reflows correctly when more space becomes available.
- [ ] Each breadcrumb item shows a short page description in a font smaller than the tab bar's tab labels.

## 12. Testing / Verification
Describe how the feature will be validated.

- Manual test plan: Navigate several links deep in one tab; verify breadcrumb growth, styling, and label accuracy; go back multiple levels and verify subdued breadcrumb rendering; jump forward via breadcrumb click; resize the window narrower/wider and verify truncation/expansion; switch between multiple tabs with different breadcrumb depths and verify per-tab isolation.
- Automated test coverage: Add/extend tests under [test](../../../test) covering breadcrumb state transitions (append, truncate-then-navigate, back/forward restoration) and truncation width calculations, following existing test patterns in the repository.
- Regression considerations: Verify existing back/forward button behavior, tab switching, and tab bar rendering remain unaffected.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- Rollout plan: Ship behind normal feature development flow (no flag required unless review indicates a need for gradual rollout); verify against the existing UI on both light and dark themes.
- Follow-up work: Consider persisting breadcrumb history across session restore ([js/sessionRestore.js](../../../js/sessionRestore.js)) as a future enhancement; consider a settings toggle to hide the breadcrumbs bar for users who prefer the traditional back/forward-only workflow.
