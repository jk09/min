# Feature Specification Template

## 1. Feature Title
- **Feature name:** LLM prompt toolbar: search-engine selector and Model button removal
- **Created on:** 2026-08-16
- **Owner:** Jozef Košík (jozef.kosik@radixal.net)

## 2. Summary
Add a search-engine selector to the LLM prompt toolbar, modeled on the existing AI agent selector, and remove the non-functional `Model` toggle.

- **Problem statement:** The LLM prompt toolbar currently lets a user pick which AI agent (e.g. Claude.ai) receives a prompt, but has no equivalent control for choosing which web search engine is used when the prompt performs a web search. The toolbar also carries a disabled `Model` button that does nothing and is not planned to do anything soon, which adds visual clutter.
- **Desired outcome:** The toolbar shows a search-engine selector button/menu next to the agent selector, following the same interaction pattern (button + dropdown listbox with a badge for not-yet-implemented options). Bing remains the default/functional option; Google, Ecosia, and Startpage appear in the menu as selectable but marked "coming soon". The `Model` button is removed from the toolbar entirely.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** [index.html](../../../index.html) renders the LLM prompt toolbar with an `.llm-prompt-agent-picker` (button `#llm-prompt-mode` + menu `#llm-prompt-agent-menu`) driven by [js/llmPrompt/agents/agentRegistry.js](../../../js/llmPrompt/agents/agentRegistry.js) and rendered/wired in [js/llmPrompt/promptPanel.js](../../../js/llmPrompt/promptPanel.js). A disabled `#llm-prompt-model` button labeled "Model" sits next to it, with the tooltip "Model selection (not configurable yet)". There is currently no UI control for choosing a web search engine; search engine options already exist as data in [js/util/searchEngine.js](../../../js/util/searchEngine.js) (`DuckDuckGo`, `Google`, `Bing`, `Yahoo`, `Baidu`, `StartPage`, `Ecosia`, `Qwant`), and Bing is the current default used by the LLM prompt flow.
- **Motivation:** Give users the same at-a-glance, one-click control over the destination web search engine that they already have over the AI agent, and drop the dead-end `Model` button to reduce toolbar clutter, consistent with the project's minimalistic goals.
- **Related issues or references:** Annotated mockup showing the desired end state (Claude.ai selected as the agent, `Model` crossed out for removal) — see [llm-prompt-toolbar-annotated-mockup.png](./llm-prompt-toolbar-annotated-mockup.png). Related code: [js/llmPrompt/agents/agentRegistry.js](../../../js/llmPrompt/agents/agentRegistry.js), [js/llmPrompt/promptPanel.js](../../../js/llmPrompt/promptPanel.js), [js/util/searchEngine.js](../../../js/util/searchEngine.js), [css/llmPrompt.css](../../../css/llmPrompt.css), [index.html](../../../index.html).

## 4. Goals
List the primary outcomes this feature should achieve.

- Goal 1: Add a search-engine selector control to the LLM prompt toolbar, visually and behaviorally consistent with the existing AI agent selector (button + dropdown listbox, selected-state highlighting, "coming soon" badges for inert options).
- Goal 2: Make Bing the default and only functional search-engine option initially, while listing Google, Ecosia, and Startpage as selectable-but-inert ("to be implemented soon") entries in the same menu.
- Goal 3: Remove the `Model` button (`#llm-prompt-model`) from the toolbar and its related markup/styles/references.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Non-goal 1: Implementing actual routing/execution logic for Google, Ecosia, or Startpage searches — they remain inert placeholders in this iteration.
- Non-goal 2: Changing the browser's global default-search-engine setting (in browser settings/`searchbar`) or any other search entry point outside the LLM prompt toolbar.
- Non-goal 3: Adding a replacement for the removed `Model` button's functionality (model selection stays out of scope).

## 6. User Stories
Capture the expected user experience.

- As a user of the LLM prompt, I want to see and change which search engine will be used, so that I understand and control where my web searches are sent.
- As a user of the LLM prompt, I want the toolbar to stay uncluttered, so that a non-functional `Model` button isn't taking up space or attention.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. The LLM prompt toolbar displays a search-engine selector button (e.g. `#llm-prompt-search-engine`) showing the currently selected engine's short name (default: `Bing`), placed in the same toolbar group as the agent selector.
2. Clicking the search-engine button opens a dropdown listbox (e.g. `#llm-prompt-search-engine-menu`) listing all configured options: `Bing` (functional, selected by default), `Google`, `Ecosia`, `Startpage` (all marked with a "coming soon" badge, mirroring the agent menu's badge treatment for non-functional agents).
3. Selecting `Bing` updates the button label/selection state and closes the menu, matching the agent selector's selection behavior (`aria-selected`, `selected` class, focus return to the button).
4. Selecting a non-functional engine (`Google`, `Ecosia`, `Startpage`) updates the visual selection state consistent with how the agent menu treats non-functional agent selection, without breaking existing prompt flows (no runtime error), and any downstream skill/tool using the search engine continues to safely fall back to Bing when a non-functional engine is selected.
5. The `Model` button (`#llm-prompt-model`) and its dedicated markup, styles, and JS references are removed from the toolbar.
6. Keyboard/click-outside/menu-toggle behavior for the new selector mirrors the existing agent menu (`Escape` closes it, clicking outside closes it, `aria-expanded` is kept in sync).

## 8. Non-Functional Requirements
Capture quality and system constraints.

- Performance: No measurable impact; this is a small, static UI addition reusing existing menu patterns.
- Reliability: Selecting an inert search engine must not throw errors or break prompt submission.
- Security: No new external requests are introduced by this spec; only the existing `searchEngine.js` definitions are referenced.
- Accessibility: New selector must use appropriate ARIA roles/attributes (`role="listbox"`, `aria-haspopup`, `aria-expanded`, `aria-selected`) matching the agent selector's existing accessibility treatment.
- Compatibility: Must work within Min's existing Electron/Chromium renderer and current CSS theme (light/dark mode) conventions used by `.llm-prompt-agent-menu`.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- User flow: User opens the LLM prompt → sees agent selector (e.g. "Claude.ai") and search-engine selector (e.g. "Bing") side by side in the toolbar → clicks the search-engine button → menu opens showing Bing (selected) and Google/Ecosia/Startpage (each with a "coming soon" badge) → user picks an option → button label updates, menu closes.
- Visual considerations: Reuse `.llm-prompt-agent-picker`, `.llm-prompt-agent-menu`, `.llm-prompt-agent-item`, and `.llm-prompt-agent-badge` CSS patterns (renamed/generalized or duplicated with a `search-engine` naming scheme) from [css/llmPrompt.css](../../../css/llmPrompt.css) so the two selectors look consistent. See the annotated mockup: [llm-prompt-toolbar-annotated-mockup.png](./llm-prompt-toolbar-annotated-mockup.png) (circles the agent selector, crosses out the `Model` button to be deleted).
- Edge cases: Menu should close if the prompt panel itself closes; only one of the agent menu / search-engine menu should be open at a time (opening one closes the other, mirroring typical toolbar dropdown behavior).

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- Proposed approach: Introduce a small search-engine registry (or reuse/wrap a subset of [js/util/searchEngine.js](../../../js/util/searchEngine.js)) exposing `id`, `title`, `shortTitle`, and `functional` fields analogous to [js/llmPrompt/agents/agentRegistry.js](../../../js/llmPrompt/agents/agentRegistry.js), with `Bing` as `functional: true` and `Google`, `Ecosia`, `Startpage` as `functional: false`. Wire it into [js/llmPrompt/promptPanel.js](../../../js/llmPrompt/promptPanel.js) alongside the existing agent-menu wiring (open/close/select/render functions), add corresponding markup in [index.html](../../../index.html), and add corresponding styles in [css/llmPrompt.css](../../../css/llmPrompt.css). Remove the `#llm-prompt-model` button and any dedicated references to it.
- Dependencies: Existing agent-selector implementation as the pattern to mirror; existing `searchEngine.js` data for engine URLs/names.
- Risks / unknowns: Whether the LLM prompt's web-search skill(s) already read a hard-coded Bing URL and need a selection hook wired in, versus this spec only covering the UI shell with the state stored for future wiring.
- Open questions: Should the selected (non-functional) search engine persist across prompt-panel sessions the same way the selected agent does, or reset each time?

## 11. Acceptance Criteria
Define how success will be measured.

- [ ] LLM prompt toolbar shows a search-engine selector next to the agent selector, defaulting to `Bing`.
- [ ] The search-engine menu lists `Bing`, `Google`, `Ecosia`, and `Startpage`, with the latter three visually marked as not yet implemented.
- [ ] Selecting any search engine updates the button label and closes the menu without errors.
- [ ] The `Model` button and its markup/styles/JS references are fully removed from the toolbar.
- [ ] Keyboard and click-outside interactions for the new menu match the existing agent menu's behavior.

## 12. Testing / Verification
Describe how the feature will be validated.

- Manual test plan: Open the LLM prompt overlay; verify the agent selector and new search-engine selector render side by side and the `Model` button is gone; open the search-engine menu, verify Bing is selected by default and the other three show a "coming soon" badge; select each option and confirm the button label updates and the menu closes; verify `Escape` and click-outside close the menu; verify opening the agent menu closes the search-engine menu and vice versa.
- Automated test coverage: Extend existing `promptPanel`-related unit/UI tests (if present under [test/](../../../test/)) to cover rendering of the search-engine menu, default selection, and selection-change behavior, following the same test patterns used for the agent selector.
- Regression considerations: Ensure removing the `Model` button does not break toolbar layout/spacing or any keyboard navigation order within `.llm-prompt-toolbar-group`.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- Rollout plan: Ship as part of the current feature branch alongside other LLM prompt UI work; no feature flag needed since this only affects the LLM prompt panel UI.
- Follow-up work: Wire the selected search engine into the actual web-search skill/tool execution path so choosing `Google`, `Ecosia`, or `Startpage` becomes functional; consider persisting the selection similarly to the agent selection.
