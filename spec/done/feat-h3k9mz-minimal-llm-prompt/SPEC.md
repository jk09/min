# Feature Specification Template

## 1. Feature Title
- **Feature name:** Minimalistic LLM Prompt (remove accumulated history panel)
- **Created on:** 2026-08-15 19:47
- **Owner:** Jozef Košík <jozef.kosik@radixal.net>

## 2. Summary
Simplify the LLM prompt panel by removing the scrolled history area that accumulates above the prompt input, and streamline the panel into a compact, single-line input experience positioned conceptually between a mainstream browser address bar and a VS Code Copilot chat prompt.

- **Problem statement:** The current LLM prompt panel (`js/llmPrompt/promptPanel.js`, `pages/prompt/`) renders a growing history/response area above the input box. This history accumulates over the session, consumes vertical space, pushes webview content margins around as it grows, and adds visual noise that conflicts with `Min`'s distraction-free browsing goals.
- **Desired outcome:** The prompt panel is reduced to a minimal, single input surface (plus a compact status/guidance affordance) with no persistent, growing history view. Prior turns are not displayed inline in a scrolling log; the panel keeps a small, fixed footprint regardless of how many prompts have been issued.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** `promptPanel.js` appends every request/trace/answer/detail into `#llm-prompt-response` via `appendEntry`, without ever clearing prior entries, so the log grows for the lifetime of the panel and only scrolls internally. This is distinct from `#llm-prompt-history`, which is a URL-suggestion dropdown (like address-bar autocomplete) unrelated to prompt/response history and out of scope for this change.
- **Motivation:** Aligns with `Min`'s core goal of a focused, uncluttered browsing surface (see [AGENTS.md](../../../AGENTS.md)) and avoids the prompt panel behaving like a full chat transcript UI, which is out of scope for a minimalistic browser.
- **Related issues or references:** [spec/done/feat-x7q2f9-llm-prompt-plaintext-search/SPEC.md](../../done/feat-x7q2f9-llm-prompt-plaintext-search/SPEC.md) (prior related prompt work); [js/llmPrompt/promptPanel.js](../../../js/llmPrompt/promptPanel.js); [css/llmPrompt.css](../../../css/llmPrompt.css); [pages/prompt/](../../../pages/prompt/). See the annotated screenshot below showing the accumulated history area to be removed: [history-panel-example.png](history-panel-example.png).

## 4. Goals
List the primary outcomes this feature should achieve.

- Goal 1: Remove the persistent, scrolling history/response log that accumulates above the LLM prompt input.
- Goal 2: Reduce the prompt panel to a minimal, fixed-height bar resembling a browser address bar, with an optional lightweight inline affordance for the most recent result/status (similar in spirit to a single-turn Copilot chat prompt, not a full transcript).
- Goal 3: Ensure webview content margins are computed from a fixed, minimal panel height instead of a height that grows with accumulated history.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Non-goal 1: Building a persistent chat/transcript UI or multi-turn conversation view.
- Non-goal 2: Changing the underlying skills/engine routing logic in [promptRouter.js](../../../js/llmPrompt/promptRouter.js) or [engineClient.js](../../../js/llmPrompt/engineClient.js).
- Non-goal 3: Adding new positioning options beyond the existing `top`/`bottom`/`left`/`right` panel placements.

## 6. User Stories
Capture the expected user experience.

- As a `Min` user, I want the LLM prompt bar to stay small and out of the way so that it doesn't clutter my browsing view the way an accumulating history list would.
- As a `Min` user, I want to see only the latest response/status near the prompt so that the experience feels like typing into an address bar or a quick chat prompt, not scrolling through a log.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. Requirement 1: The `#llm-prompt-response` log element (and `appendEntry`/multi-entry accumulation logic) is removed from the prompt panel markup and script; `#llm-prompt-history` (URL autocomplete) is unaffected.
2. Requirement 2: Submitting a prompt replaces any previously shown result/status with the current one, rather than appending to a growing list.
3. Requirement 3: `getTargetMargins`/`syncWebviewMargins` compute the panel's occupied space using only the current fixed-height panel bounds, no longer factoring in a history element's height.
4. Requirement 4: The panel retains its existing configurable positions (`top`, `bottom`, `left`, `right`) and skill-listing behavior (`/` to list skills), unaffected by the history removal.

## 8. Non-Functional Requirements
Capture quality and system constraints.

- Performance: Panel layout and margin recalculation must remain O(1) relative to number of prompts issued (no growth with usage history).
- Reliability: Removing history state must not break existing skill invocation, search, or engine status flows.
- Security: No change to data handling; no new persistence of prompt/response history should be introduced.
- Accessibility: The single-line input and compact status area must remain keyboard accessible and screen-reader friendly.
- Compatibility: Changes apply across all supported panel positions and both light/dark themes.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- User flow: User types into the input, submits, and sees the latest result/status inline near the input (e.g., a single status line or compact result area) instead of a scrolling history log.
- Visual considerations: Panel height should stay close to a single input row plus a thin status line, similar to a browser address bar height, and should not visually resemble a chat transcript.
- Edge cases: Long-running or multi-line results should truncate or be compactly summarized rather than expanding the panel indefinitely; rapid repeated submissions should not cause layout thrashing.

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- Proposed approach: Replace `#llm-prompt-response` and `#llm-prompt-guidance` with a single-line `#llm-prompt-status` row (`#llm-prompt-engine-state` + `#llm-prompt-result`) in [pages markup](../../../index.html). `sendPrompt`/`renderResult` in [promptPanel.js](../../../js/llmPrompt/promptPanel.js) set `#llm-prompt-result` text directly instead of appending entries, so each submission replaces the prior one. Shrink `--llm-panel-height` in [css/llmPrompt.css](../../../css/llmPrompt.css) to match the smaller markup. `#llm-prompt-history` (URL suggestions) is left as-is.
- Dependencies: [js/llmPrompt/promptPanel.js](../../../js/llmPrompt/promptPanel.js), [index.html](../../../index.html), [css/llmPrompt.css](../../../css/llmPrompt.css).
- Risks / unknowns: Need to confirm no other module reads `#llm-prompt-history` or the `historySuggestions`/`selectedHistorySuggestion` state before removal.
- Open questions: Should the compact status/result line auto-hide after a timeout, or persist until the next submission?

## 11. Acceptance Criteria
Define how success will be measured.

- [ ] The prompt panel no longer contains a scrolling/accumulating history element in markup or script.
- [ ] Submitting multiple prompts in sequence does not increase the panel's footprint or the webview content margin over time.
- [ ] The panel visually resembles a compact single-line input bar with a minimal status/result affordance.
- [ ] Existing skill listing (`/`), search, and engine status behaviors continue to work unchanged.

## 12. Testing / Verification
Describe how the feature will be validated.

- Manual test plan: Open the prompt panel in each supported position (`top`, `bottom`, `left`, `right`); submit several prompts/skills in a row and confirm the panel height and webview margins remain constant; verify the latest result/status replaces the previous one.
- Automated test coverage: Add/update any existing tests under [test/](../../../test/) that reference the prompt panel or its history behavior, if present.
- Regression considerations: Verify dark mode styling and panel repositioning still behave correctly after markup/style simplification.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- Rollout plan: Implement directly on this fork's working branch; no feature flag needed given the minimalistic scope of the change.
- Follow-up work: Consider whether a future, opt-in "history" view (e.g., accessible via a keyboard shortcut or separate panel) is desired without cluttering the default minimal prompt bar.
