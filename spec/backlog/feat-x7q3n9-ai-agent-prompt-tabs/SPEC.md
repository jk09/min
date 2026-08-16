# Feature Specification Template

## 1. Feature Title
- **Feature name:** AI agent hand-off from the LLM prompt (`/ai`)
- **Created on:** 2026-08-16
- **Owner:** minbrowser

## 2. Summary
Provide a concise overview of the feature and why it matters.

- **Problem statement:** The LLM prompt currently only routes plain text to the default search engine (via the `search` skill/`search.web` tool) and to a handful of deterministic/LLM skills. There is no way to hand a prompt off to a real, hosted AI agent (ChatGPT, Claude.ai, Perplexity, Copilot), even though wiring the browser to LLM/AI agents is the core rationale for this fork.
- **Desired outcome:** Users can pick a predefined AI agent from a Copilot-chat-style picker in the prompt panel, and can invoke `/ai <prompt>` to open a new tab pointed at that agent's web UI, pre-filled with the prompt and the current page's URL as context. Only Claude.ai has real, working hand-off in this iteration; the other agents are listed as recognizable, safe placeholders for future wiring.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** Typing free text into the LLM prompt panel (`#llm-prompt-input`) is routed by [js/llmPrompt/promptRouter.js](../../../js/llmPrompt/promptRouter.js): `/id args` invokes a registered skill (see [js/llmPrompt/skills/builtinSkills.js](../../../js/llmPrompt/skills/builtinSkills.js)), anything else falls through to `runSearch`, which calls the `search.web` tool and opens the configured search engine's results page in a new tab. Tools are thin, validated wrappers in [js/llmPrompt/tools/browserTools.js](../../../js/llmPrompt/tools/browserTools.js) around existing Min subsystems (`tabs.open`, `search.web`, etc.), all going through a tool registry for auditability. There is currently no concept of a "target AI agent" selectable in the UI, and no skill that opens a hosted agent's chat UI directly.
- **Motivation:** The project goal (see [AGENTS.md](../../../AGENTS.md)) is to make `Min` a browser whose workflow is driven by LLM prompts, "vibe browsing" against real AI agent products, not just local model completions or web search. Opening a known agent's own web chat UI (e.g. `https://claude.ai/new?q=...`) is the lowest-risk way to give users real agentic hand-off today, without the browser embedding API keys or model integrations for third-party agents.
- **Related issues or references:** [spec/backlog/feat-k7v2m8-simplify-browser-controls/SPEC.md](../feat-k7v2m8-simplify-browser-controls/SPEC.md) (sibling backlog spec touching the same prompt surface); Claude.ai new-chat URL convention referenced by the user request: [New chat - Claude](https://claude.ai/new).

## 4. Goals
List the primary outcomes this feature should achieve.

- Goal 1: Add an AI agent picker to the LLM prompt panel, presented in a manner similar to VS Code Copilot Chat's model/agent picker, listing predefined, safe agent choices.
- Goal 2: Support a `/ai <prompt>` skill that opens a new tab to `https://claude.ai/new?q=<encoded prompt + current page URL as context>` when Claude.ai is selected (or by default, since it is the only functional agent).
- Goal 3: Establish an extensible list of predefined agents (OpenAI ChatGPT, Anthropic Claude.ai, Perplexity.ai, Microsoft Copilot) so that wiring additional agents later only requires adding metadata and a hand-off URL builder, not new UI plumbing.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Non-goal 1: Implementing real hand-off, API integration, or authentication for ChatGPT, Perplexity.ai, or Microsoft Copilot in this iteration — they are listed but inert/unsupported until a follow-up spec wires them up.
- Non-goal 2: Changing how local/configured LLM providers (`llmProvider`, `llmModel` settings, [js/llmPrompt/engineClient.js](../../../js/llmPrompt/engineClient.js)) work, or how existing deterministic/LLM skills (`/search`, `/history`, `/summarize`, etc.) are routed.
- Non-goal 3: Passing full page content or browsing history to the external agent — only the prompt text and the current tab's URL are included as context.

## 6. User Stories
Capture the expected user experience.

- As a user who wants a second opinion from a hosted AI agent, I want to type `/ai <question>` in the LLM prompt so that a new tab opens with Claude.ai already primed with my question and the page I'm looking at.
- As a user exploring available agents, I want to see a small selector (styled like the VS Code Copilot Chat agent/model picker) listing ChatGPT, Claude.ai, Perplexity.ai, and Microsoft Copilot so that I understand what's available and what's coming.
- As a user who selects an agent that isn't wired up yet (e.g. ChatGPT), I want a clear, non-destructive message telling me it isn't supported yet, so I'm not confused when nothing (or the wrong thing) happens.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. Requirement 1: The LLM prompt panel exposes an AI agent selector UI listing at least: OpenAI ChatGPT, Anthropic Claude.ai, Perplexity.ai, Microsoft Copilot. Claude.ai is the default selection.
2. Requirement 2: A new built-in skill `ai` is registered with usage `/ai <prompt>` and trigger pattern(s) analogous to existing skills (e.g. `/^ask (claude|the ai)\s+/i` as an optional natural-language trigger, in addition to the explicit `/ai` prefix).
3. Requirement 3: When invoked while Claude.ai is selected (or by default when no other agent is selected), the skill builds the URL `https://claude.ai/new?q=<encoded prompt>` where the encoded query parameter contains the user's prompt text followed by the current tab's URL as context, and opens it via the existing `tabs.open` tool in a new foreground tab.
4. Requirement 4: When invoked while a non-functional agent (ChatGPT, Perplexity.ai, Microsoft Copilot) is selected, the skill returns a clear message (not an error/exception) stating that hand-off for that agent isn't implemented yet, and performs no tab navigation.
5. Requirement 5: If the LLM prompt is invoked with no active tab/URL (e.g. on the new-tab page), the skill still opens Claude.ai with just the prompt text, omitting the missing context gracefully.
6. Requirement 6: The prompt text and constructed context are percent-encoded correctly for use as a URL query parameter, and must not allow injection of additional query parameters or fragments beyond the intended `q` value.
7. Requirement 7: The list of predefined agents and their hand-off capability (functional vs. placeholder) is defined in one place (e.g. a small agent registry module) so it can be extended without touching the UI or router.

## 8. Non-Functional Requirements
Capture quality and system constraints.

- Performance: Opening the agent tab must be as fast as the existing `search.web` tool path; no added network calls before opening the tab.
- Reliability: Selecting a placeholder agent must never throw an unhandled exception or leave the prompt panel in a broken state.
- Security: URL construction must escape user input (`encodeURIComponent`) to prevent query/fragment injection; only the fixed, hardcoded `https://claude.ai/new` origin is used, never a user-supplied origin. The new tab is opened through the existing sandboxed `tabs.open` mutate-scope tool, consistent with other tools' auditability.
- Accessibility: The agent selector must be keyboard-navigable and screen-reader labeled, consistent with the existing prompt panel's ARIA usage (`role="dialog"`, `aria-modal="true"`).
- Compatibility: No new external dependencies; reuse existing tool registry, skill registry, and webview/tab APIs.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- User flow: User opens the LLM prompt panel → picks an agent from the selector (or leaves the Claude.ai default) → types `/ai <prompt>` or plain text after selecting an agent → presses send → a new tab opens with the agent's chat UI pre-filled (Claude.ai) or an inline "not yet supported" message (other agents).
- Visual considerations: The agent selector should sit near the existing engine status indicator (`#llm-prompt-engine-state`) in [index.html](../../../index.html), styled via [css/llmPrompt.css](../../../css/llmPrompt.css), echoing the compact dropdown/list style of VS Code Copilot Chat's model picker (small button that expands to a short list, current selection shown as a label/icon).
- Edge cases: agent selector state should persist across prompt panel open/close within a session; very long prompts should still produce a valid URL (rely on `encodeURIComponent`, no manual truncation unless a real length problem is observed).

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- Proposed approach:
  - Add an `agentRegistry` (e.g. `js/llmPrompt/agents/agentRegistry.js`) listing `{ id, title, hostname, functional, buildURL(prompt, contextURL) }` entries for `chatgpt`, `claude`, `perplexity`, `copilot`.
  - Extend [js/llmPrompt/promptPanel.js](../../../js/llmPrompt/promptPanel.js) state with a `selectedAgent` field and render the selector in the panel, defaulting to `claude`.
  - Add a new built-in skill `ai` in [js/llmPrompt/skills/builtinSkills.js](../../../js/llmPrompt/skills/builtinSkills.js) (or a new `aiAgentSkills.js` module) that reads the selected agent from context/UI state, builds the target URL via the registry, and calls `context.runTool('tabs.open', { url })` for functional agents, or returns a message for placeholder agents.
  - Pass the current tab's URL into skill context (via `context.runTool('tabs.list', {})` and picking the selected tab, mirroring `page.getText`'s `tabs.getSelected()` pattern) to build the `q` parameter as `<prompt>\n\nContext: <currentURL>` (or similar), then `encodeURIComponent` the whole string.
- Dependencies: None beyond existing tool/skill registries; no new npm packages.
- Risks / unknowns: Claude.ai's `?q=` query-param hand-off behavior is undocumented/unofficial and could change; the skill should degrade gracefully (still open `https://claude.ai/new` with no/partial query) if the URL is rejected or ignored by the site.
- Open questions: Should the agent selection also affect the plain-text (`runSearch`) fallback path, or remain scoped to the explicit `/ai` skill only? Should placeholder agents show a "coming soon" state in the picker itself, or only when invoked?

## 11. Acceptance Criteria
Define how success will be measured.

- [ ] The LLM prompt panel shows an agent selector with ChatGPT, Claude.ai, Perplexity.ai, and Microsoft Copilot, defaulting to Claude.ai.
- [ ] Typing `/ai <prompt>` with Claude.ai selected opens a new tab to `https://claude.ai/new?q=...` containing the prompt and the current page URL as context.
- [ ] Typing `/ai <prompt>` with a non-Claude agent selected shows a clear "not supported yet" message and opens no tab.
- [ ] Invoking `/ai <prompt>` with no active page still opens Claude.ai with just the prompt.
- [ ] User-supplied prompt text cannot alter the target origin or inject extra URL parameters.
- [ ] The agent list is defined in a single, extensible module referenced by both the UI and the skill.

## 12. Testing / Verification
Describe how the feature will be validated.

- Manual test plan: Open the LLM prompt panel; verify the agent selector renders and defaults to Claude.ai; run `/ai What is this page about?` on a real page and confirm the new tab's URL contains the encoded prompt and page URL; switch to ChatGPT/Perplexity/Copilot and confirm the "not supported yet" message with no tab opened; run `/ai` from the new-tab page (no active URL) and confirm graceful behavior.
- Automated test coverage: Unit tests for the `agentRegistry` URL builder (encoding correctness, no-context fallback) and for the `ai` skill's routing between functional/placeholder agents, following existing patterns in [test/](../../../test/) if a comparable skill/tool test exists.
- Regression considerations: Ensure the existing `/search`, `/history`, `/tabs`, `/summarize`, `/skills` skills and the plain-text `runSearch` fallback are unaffected by the new skill and UI addition.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- Rollout plan: Ship behind no additional flag; the agent selector and `/ai` skill are additive to the existing prompt panel and safe by default (placeholder agents are inert).
- Follow-up work: Wire up real hand-off for ChatGPT, Perplexity.ai, and Microsoft Copilot once their supported URL/hand-off conventions are confirmed; consider persisting the selected agent in settings; consider letting declarative user skills (`llmSkills` setting) reference agents from the registry.
