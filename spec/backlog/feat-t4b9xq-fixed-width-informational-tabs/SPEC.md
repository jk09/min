# Feature Specification

## 1. Feature Title
- **Feature name:** Fixed-width informational tabs with overflow summary
- **Created on:** 2026-08-16 11:26
- **Owner:** Jozef Košík <jozef.kosik@radixal.net>

## 2. Summary
Rework the tab bar so tabs act primarily as compact information markers rather than the main navigation control, and handle the common case where far more tabs are open than can fit on the bar.

- **Problem statement:** Tabs currently stretch/shrink to fill the bar and are optimized for clicking. In an LLM-prompt-first browser a session can easily accumulate dozens or hundreds of tabs, so the bar becomes unreadable, tabs get truncated to unusable widths, and tabs that do not fit are effectively invisible.
- **Desired outcome:** Every visible tab has a predictable, configurable fixed width and a consistent icon + short label. Tabs that do not fit are represented by an interactive continuation label (for example `... 12 more tabs`) that reveals a summary of the hidden pages.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** Tab width is computed dynamically in the tab bar layout; tabs shrink and the title is truncated as more tabs are opened. Tabs already carry a favicon, a title, and a derived background color (see [js/navbar/tabBar.js](js/navbar/tabBar.js), [js/navbar/tabColor.js](js/navbar/tabColor.js), [css/tabBar.css](css/tabBar.css)). There is no indication that additional tabs exist beyond the visible area.
- **Motivation:** The browser's primary interaction surface is the LLM prompt, not the tab strip. Tabs should therefore optimize for at-a-glance information density and stable positions, and gracefully degrade into an aggregate summary once the bar is full.
- **Related issues or references:**
  - [current-tab-bar-variable-width-tabs.png](current-tab-bar-variable-width-tabs.png) — current tab bar with wide, variable-width tabs; the active tab consumes a large share of the bar.
  - [current-tab-bar-overflow-hidden-tabs.png](current-tab-bar-overflow-hidden-tabs.png) — tabs already spilling toward the window controls, with no indication of how many tabs are not fully reachable.
  - Related existing spec work in [spec/](spec/) for browser control simplification.

## 4. Goals
- Goal 1: Give each tab a fixed, configurable width so tab layout is stable and predictable regardless of tab count.
- Goal 2: Present each tab as a compact information unit: favicon plus a short label (abbreviated address, or an LLM-generated page abbreviation when available).
- Goal 3: Color-code tabs from the page's own visual style so tabs are visually groupable at a glance.
- Goal 4: Show an interactive `... N more tabs` continuation label when tabs overflow, exposing MVP statistics about the hidden tabs.

## 5. Non-Goals
- Non-goal 1: Replacing tasks, the task overlay, or the tab editor / searchbar as the primary way to find and switch tabs.
- Non-goal 2: Full-featured overflow analytics (grouping by topic, LLM clustering, filtering, sorting) — the MVP statistics view is intentionally minimal and extended later.
- Non-goal 3: Horizontal tab-strip scrolling, tab pinning, or tab groups as a UI concept.
- Non-goal 4: Building the LLM page-abbreviation pipeline itself; this spec only consumes an abbreviation if one is available.

## 6. User Stories
- As a user with many open tabs, I want every tab to keep the same width so tab positions stay stable and I can recognize tabs by position and color.
- As a user scanning the tab bar, I want a favicon plus a short address or page abbreviation so I can identify a page without reading a truncated title.
- As a user whose tabs no longer fit, I want a `... N more tabs` label so I know how much is hidden.
- As a user, I want to click the continuation label to see basic statistics about the hidden tabs so I can decide whether to switch tasks or close tabs.

## 7. Functional Requirements
1. **Fixed tab width:** Each tab in the tab bar renders at a fixed width taken from a single configurable value (default suggested: ~140 px). The value is configurable in settings and applied without restart.
2. **Tab content:** Each tab renders, in order: the page favicon (or a placeholder when unavailable), then a single-line label. The label is the LLM-generated page abbreviation when present, otherwise an abbreviated address (registrable domain, e.g. `dailymail.com`), otherwise the abbreviated title, otherwise the localized "New Tab" text. Label text is ellipsized, never wrapped.
3. **Color coding:** Each tab receives a background/accent color derived from the page's visual style (existing theme-color / favicon-derived color logic), with a readable foreground color. Tabs without a derived color fall back to the default tab color.
4. **Selection and interaction preserved:** Tabs remain clickable for selection, keep their existing context menu, close affordance, keyboard navigation, audio/activity indicators, and accessible names and roles.
5. **Overflow detection:** The tab bar computes how many fixed-width tabs fit in the available width, reserving space for the continuation label. Tabs beyond that count are not rendered in the bar.
6. **Continuation label:** When one or more tabs overflow, a continuation label is rendered at the right end of the tab bar with the text `... N more tabs` (singular form `... 1 more tab`), localized. The label is hidden when nothing overflows.
7. **Active tab always visible:** If the active tab would fall into the overflow set, the visible window of tabs shifts so the active tab is rendered in the bar; the continuation count reflects all non-rendered tabs.
8. **Overflow statistics (MVP):** Activating the continuation label (click, Enter/Space, or its keyboard shortcut) opens a lightweight panel showing at minimum: total hidden tab count, hidden tabs grouped by domain with per-domain counts, and count of hidden tabs that are still loading or unloaded. Each listed entry can be selected to switch to that tab. The panel dismisses on Escape, outside click, or tab switch.
9. **Dynamic updates:** Overflow count and the visible tab window recompute on window resize, tab open/close/reorder, task switch, and tab-width setting change.

## 8. Non-Functional Requirements
- **Performance:** Layout and overflow computation must be O(number of tabs) with no per-tab DOM measurement; the tab bar must remain responsive with 500 open tabs, and resize handling must be throttled/debounced to avoid layout thrash.
- **Reliability:** Overflow count must always equal `total tabs in task − rendered tabs`; no tab may become unreachable through both the bar and the statistics panel.
- **Security:** Page-derived values (title, abbreviation, favicon, colors) are untrusted input and must be inserted as text / sanitized values only — never as HTML or unvalidated CSS.
- **Accessibility:** Tabs and the continuation label are keyboard reachable with visible focus; the label exposes an accessible name including the hidden count; colors keep a readable contrast ratio against the label text; behavior is sane in high-contrast and reduced-motion modes.
- **Compatibility:** Works on Windows, macOS, and Linux window-control layouts, in focus mode, and with the existing task/tab-state model.

## 9. UX / UI Notes
- **User flow:** User opens many tabs → tab bar fills with equal-width tabs → once full, a `... N more tabs` label appears at the right → user activates it → MVP statistics panel opens below the label → user picks an entry to switch to that tab, or dismisses the panel.
- **Visual considerations:**
  - Tabs are visually quiet: small favicon, small single-line label, subtle color tint rather than saturated fills.
  - The active tab is distinguished by emphasis (border/elevation) but keeps the same width as other tabs.
  - The continuation label is styled as secondary text, aligned right, and never overlaps window controls (see [current-tab-bar-overflow-hidden-tabs.png](current-tab-bar-overflow-hidden-tabs.png)).
  - Compare with [current-tab-bar-variable-width-tabs.png](current-tab-bar-variable-width-tabs.png), where the active tab dominates the bar; this is what the fixed width removes.
- **Edge cases:**
  - Very narrow window: zero tabs fit → render only the active tab plus the continuation label.
  - Single tab: no continuation label.
  - Missing favicon, missing title, `about:blank` / internal pages, very long domains, RTL labels.
  - Tab-width setting set to an extreme value → clamp to a sane min/max range.

## 10. Technical Notes
- **Proposed approach:**
  - Replace dynamic width calculation in [js/navbar/tabBar.js](js/navbar/tabBar.js) with a CSS custom property (e.g. `--tab-width`) set from the configured value, consumed by [css/tabBar.css](css/tabBar.css).
  - Add a small overflow module that, given the container width, tab width, and label width, returns the visible tab slice and hidden tab list; the tab bar renders from that result.
  - Reuse and extend [js/navbar/tabColor.js](js/navbar/tabColor.js) for color coding; reuse existing favicon handling.
  - Derive the abbreviated address with the existing public-suffix data in [ext/publicSuffixes/](ext/publicSuffixes/); read an LLM abbreviation from tab state when present, with graceful fallback.
  - Implement the statistics panel as a small, self-contained view that consumes tab state read-only and emits a "switch to tab" action.
- **Dependencies:** Existing tab state ([js/tabState/](js/tabState/)), tab bar rendering, settings storage, localization strings.
- **Risks / unknowns:** Where the LLM page abbreviation is produced and cached; interaction with focus mode and task switching; perceived regression for users who rely on wide, readable tab titles.
- **Open questions:**
  - Default fixed tab width and allowed min/max range?
  - Should the continuation label count tabs in other tasks, or only the current task? (Assumed: current task only.)
  - Should the statistics panel reuse the task overlay styling or introduce its own popover?

## 11. Acceptance Criteria
- [ ] All tabs render at the same configurable fixed width; changing the setting updates the bar live.
- [ ] Each tab shows a favicon plus a short label using the abbreviation → domain → title → default fallback chain.
- [ ] Tabs are color-coded from page style with readable label contrast, with a defined default fallback.
- [ ] Clicking a tab still selects it; context menu, close, keyboard navigation, and indicators still work.
- [ ] When tabs overflow, a `... N more tabs` (or `... 1 more tab`) label appears at the right and the count is correct.
- [ ] The active tab is always rendered in the bar.
- [ ] Activating the label opens an MVP statistics panel with total hidden count, per-domain counts, and loading/unloaded counts; entries switch tabs; Escape and outside click dismiss it.
- [ ] Overflow state recomputes correctly on resize, tab open/close/reorder, and task switch.

## 12. Testing / Verification
- **Manual test plan:** Open 1, 5, 50, and 200 tabs; resize the window from maximized to minimum width; toggle focus mode; switch tasks; change the tab-width setting; verify counts, active-tab visibility, label text and pluralization, and panel behavior with keyboard only.
- **Automated test coverage:** Unit tests for the overflow calculation (visible slice and hidden list for varying widths and tab counts), for the label-text fallback chain, and for domain abbreviation; a smoke test asserting the continuation label appears with the expected count.
- **Regression considerations:** Tab drag/reorder, tab close behavior, tab editor/searchbar activation, task overlay, session restore, and window-control spacing on all platforms.

## 13. Rollout / Follow-up
- **Rollout plan:** Ship behind the tab-width setting with sensible defaults; no migration required since tab state is unchanged.
- **Follow-up work:**
  - Richer overflow statistics (LLM clustering by topic, memory/CPU usage, last-visited times, bulk close actions).
  - Search/filter inside the statistics panel.
  - Feeding the LLM-generated page abbreviation pipeline and caching it in tab state.
