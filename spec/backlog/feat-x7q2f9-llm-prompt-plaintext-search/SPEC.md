# Feature Specification Template

## 1. Feature Title
- **Feature name:** Plain-text LLM prompt input triggers default search engine
- **Created on:** 2026-08-15
- **Owner:** Jozef Košík <jozef.kosik@radixal.net>

## 2. Summary
Provide a concise overview of the feature and why it matters.

- **Problem statement:** Today, any text entered into the LLM prompt panel is routed to a skill (explicit `/id args` invocation, implicit trigger match) or to the general LLM query flow, even when the user simply wants to search the web. There is no deterministic, LLM-independent path for plain-text search, which makes the prompt feel unpredictable compared to a conventional browser address bar.
- **Desired outcome:** Any input to the LLM prompt that does not start with a skill designator (`/<skill-name>`) is deterministically treated as a search query and executed against the user's configured default search engine, with results shown on a new page — mirroring the address-bar search behavior found in mainstream browsers (Chrome, Edge, etc.). Additionally, while typing, the prompt should show an autocomplete/intelli-sense dropdown of matching browsing history entries, similar to the address bar suggestion experience.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** The prompt router ([js/llmPrompt/promptRouter.js](../../../js/llmPrompt/promptRouter.js)) dispatches input in three ways: explicit skill invocation via `/id args`, implicit skill invocation via trigger match, or a general LLM query that returns a JSON plan of tool calls (`PLAN_SYSTEM_PROMPT`). Plain text with no skill designator is currently sent to the LLM for interpretation rather than being handled deterministically. A `search` capability already exists via `browserTools.js`, which uses `util/searchEngine.js` to resolve the current default search engine.
- **Motivation:** Routing plain text through the LLM adds latency, cost, and non-determinism for the most common case (a simple search), and diverges from user expectations set by standard browser address bars.
- **Related issues or references:** [js/llmPrompt/promptRouter.js](../../../js/llmPrompt/promptRouter.js), [js/llmPrompt/tools/browserTools.js](../../../js/llmPrompt/tools/browserTools.js), `util/searchEngine.js`.

## 4. Goals
List the primary outcomes this feature should achieve.

- Goal 1: Deterministically detect whether prompt input starts with a skill designator (`/<skill-name>`) without invoking the LLM.
- Goal 2: When no skill designator is present, treat the input as a search query and open/navigate to a new page showing search results from the user's default search engine.
- Goal 3: While the user types in the LLM prompt, display a dropdown of matching browsing history entries (intelli-sense style), consistent with standard address-bar suggestion UX.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Non-goal 1: Changing how explicit (`/id args`) or implicit (trigger match) skill invocation is parsed or routed.
- Non-goal 2: Redesigning the general LLM query / tool-call plan flow for inputs that are not plain search text.
- Non-goal 3: Building a new search engine selection UI; the existing default search engine configuration (`util/searchEngine.js`) is reused as-is.

## 6. User Stories
Capture the expected user experience.

- As a user of the Min browser, I want any plain text input in the LLM prompt to result in a search with the default search engine, so that the prompt behaves predictably like a normal browser address bar.
- As a user of the Min browser, I want to see my browsing history suggestions appear in a dropdown while typing in the LLM prompt, so that I can quickly navigate to pages I've already visited instead of typing a full query.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. Requirement 1: On prompt submission, the router MUST deterministically check whether the trimmed input starts with a skill designator pattern (`/<skill-name>` followed by optional args) before considering any LLM-based routing.
2. Requirement 2: If the input does not match the skill designator pattern, the router MUST bypass both skill invocation and the general LLM query plan, and MUST directly execute a search using the current default search engine (as resolved by `util/searchEngine.js` / the existing `search` tool in `browserTools.js`).
3. Requirement 3: The search MUST result in a new page (tab) being opened or navigated to, displaying the search results for the given query, consistent with existing "open URL" / "search" tool behavior in the browser.
4. Requirement 4: While the user is typing in the LLM prompt input (before submission), the UI MUST query browsing history and display matching entries in a dropdown list below/near the prompt input, updated as the input changes.
5. Requirement 5: Selecting a history suggestion from the dropdown MUST navigate to that page directly, without triggering a search or LLM call.
6. Requirement 6: If the input starts with a valid skill designator, existing skill-routing behavior MUST remain unchanged.

## 8. Non-Functional Requirements
Capture quality and system constraints.

- Performance: Plain-text search detection and dispatch must be effectively instantaneous (no network/LLM round-trip) since it is a deterministic string check.
- Reliability: Skill-designator detection must not produce false positives/negatives that misroute legitimate search queries containing a leading `/` character that isn't a real skill id.
- Security: Search queries must be safely encoded when constructing the destination URL; history suggestions must not leak sensitive data beyond what is already exposed by existing history/autocomplete features.
- Accessibility: The history suggestion dropdown must be keyboard-navigable (arrow keys, Enter, Escape) consistent with existing searchbar dropdown patterns in the browser.
- Compatibility: Should reuse existing history search/autocomplete infrastructure (e.g. `js/searchbar/`) where possible instead of introducing a parallel implementation.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- User flow: User types plain text in the LLM prompt → history suggestions appear live in a dropdown → user either selects a suggestion (navigates directly) or presses Enter/submits without selecting (input is searched via default search engine, results shown in a new page).
- Visual considerations: Dropdown styling should be consistent with existing prompt panel styles ([css/llmPrompt.css](../../../css/llmPrompt.css)) and the existing searchbar dropdown ([css/searchbar.css](../../../css/searchbar.css)).
- Edge cases: Empty input, whitespace-only input, input that looks like a URL, input starting with `/` but not matching any registered skill id, and very long queries should all be handled gracefully.

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- Proposed approach: Add a deterministic pre-check in [js/llmPrompt/promptRouter.js](../../../js/llmPrompt/promptRouter.js) (e.g. a regex/string check for `/^\/[\w-]+/`) that short-circuits routing to a direct call of the existing `search` tool in [js/llmPrompt/tools/browserTools.js](../../../js/llmPrompt/tools/browserTools.js) when no skill designator is found. For the history dropdown, investigate reusing components under [js/searchbar/](../../../js/searchbar/) and [js/places/](../../../js/places/) that already power address-bar-style history autocomplete.
- Dependencies: `util/searchEngine.js`, `js/llmPrompt/tools/browserTools.js`, existing history/places data access, existing searchbar autocomplete UI components.
- Risks / unknowns: Ensuring the skill-designator regex matches exactly the parsing already used elsewhere for `/id args` invocation to avoid divergent behavior; UI real estate constraints in the (compact) LLM prompt panel for showing a dropdown.
- Open questions: Should the history dropdown also suggest matching skill ids when the input starts with `/`? Should search results open in a new tab or replace the current one, and does this align with how other prompt-triggered navigations behave today?

## 11. Acceptance Criteria
Define how success will be measured.

- [ ] Plain text input (no leading `/<skill-name>`) submitted in the LLM prompt opens a new page with search results from the configured default search engine, without any LLM call being made.
- [ ] Input starting with a valid `/<skill-name>` designator continues to invoke the corresponding skill exactly as before.
- [ ] Typing in the LLM prompt shows a live-updating dropdown of matching browsing history entries.
- [ ] Selecting a history suggestion navigates directly to that page.
- [ ] Keyboard navigation (arrows, Enter, Escape) works in the history dropdown.

## 12. Testing / Verification
Describe how the feature will be validated.

- Manual test plan: Type various plain-text queries and confirm a search results page opens using the default engine; type `/`-prefixed valid and invalid skill ids and confirm correct routing; type partial history matches and confirm dropdown suggestions and keyboard navigation work.
- Automated test coverage: Add/extend tests under [test/](../../../test/) for `promptRouter.js` covering skill-designator detection and default-search fallback; add UI/unit tests for the history dropdown component if feasible.
- Regression considerations: Verify existing skill invocation (explicit and implicit trigger match) and general LLM query flows are unaffected for inputs that are not plain search text.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- Rollout plan: Ship behind normal release process; no feature flag anticipated since behavior aligns with user expectations and existing search tooling.
- Follow-up work: Consider extending suggestions to include matching skill ids or bookmarks; consider surfacing search-engine selection directly from the prompt.
