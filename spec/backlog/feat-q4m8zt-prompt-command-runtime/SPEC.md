# Feature Specification

## 1. Feature Title
- **Feature name:** Prompt-Driven Browser Command Runtime (LLM + Skills MVP)
- **Created on:** 2026-08-15 13:28
- **Owner:** Jozef Košík <jozef.kosik@radixal.net>

## 2. Summary
Provide a concise overview of the feature and why it matters.

- **Problem statement:** The bottom prompt panel exists as a shell, but it cannot actually drive the browser. There is no way to search the web, summarize a page, query history, or rearrange the UI from the prompt, so the fork's "vibe browsing" goal is unrealized.
- **Desired outcome:** The prompt bar becomes the primary control surface of Min. It accepts natural-language queries routed to a configurable LLM, and named skills (built-in or user-created) that execute deterministic browser actions. An MVP demonstrates web search, page summary, history search, and basic UI manipulation.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** [js/llmPrompt/promptPanel.js](js/llmPrompt/promptPanel.js) renders a bottom panel and [js/llmPrompt/engineClient.js](js/llmPrompt/engineClient.js) forwards prompts over IPC to [main/llmEngine.js](main/llmEngine.js), which returns a stub response. A small internal action catalog (`browser.openTab`, `browser.closeTab`, `browser.navigateCurrentTab`, plus read actions) is declared but not wired to a dispatcher.
- **Motivation:** AGENTS.md defines the fork goal as a browser whose workflow is driven by LLM prompts, configurable and extensible by agents and skills instead of built-in plugins. Edge's Copilot sidebar is the closest analogue; Min should offer a more minimal, deeper-integrated equivalent.
- **Related issues or references:** [spec/done/feat-a7k3p9-llm-prompt-panel/SPEC.md](spec/done/feat-a7k3p9-llm-prompt-panel/SPEC.md) (panel shell, engine boundary, capability scopes); [spec/done/feat-x7k2mq-esm-module-refactor](spec/done/feat-x7k2mq-esm-module-refactor) (module conventions); existing subsystems reusable as tools: [js/places/places.js](js/places/places.js), [js/searchbar/searchbar.js](js/searchbar/searchbar.js), [js/readerView.js](js/readerView.js), [js/browserUI.js](js/browserUI.js), [js/tabState](js/tabState), [main/viewManager.js](main/viewManager.js).

## 4. Goals
List the primary outcomes this feature should achieve.

- Goal 1: Define a **tool layer** that exposes Min capabilities (navigation, tabs, tasks, history/places, page content, settings, windows) as a versioned, introspectable catalog with declared scopes (`read` / `mutate`).
- Goal 2: Define a **skill layer** where a skill is a named, parameterized unit of work that is either `deterministic` (pure tool calls, no model round-trip) or `llm` (model-assisted), with built-in and user-provided skills resolved through the same registry.
- Goal 3: Define a **router** that turns raw prompt text into either a skill invocation (explicit `/name` or matched trigger) or a general LLM query carrying the tool/skill catalog as context, and that executes the returned plan through the tool layer.
- Goal 4: Ship an MVP demonstrating at least: web search, current-page summary, history search, and a UI manipulation action (e.g. group/tile tabs or open results in a new task), with both a deterministic and an LLM-backed skill visible in the panel.
- Goal 5: Keep model provider, tool catalog, and skill set independently extensible and configurable without touching the router.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Non-goal 1: Multi-provider orchestration, billing, streaming token UI, or conversation branching.
- Non-goal 2: Full replacement of existing Min UI affordances (tab bar, searchbar) — the prompt augments them in this iteration.
- Non-goal 3: A skill authoring GUI, marketplace, or sandboxed third-party skill execution.
- Non-goal 4: Agentic multi-step autonomy with self-correction loops; the MVP executes a single plan per prompt.

## 6. User Stories
Capture the expected user experience.

- As a Min user, I want to type `search rust async runtimes` in the prompt bar so that results open without me touching the address bar.
- As a Min user, I want to type `summarize this page` so that I get a short readable summary of the active tab.
- As a Min user, I want to type `history: pages about kubernetes last week` so that matching visited pages are found and opened together.
- As a Min user, I want to type `tile these tabs` or `open yesterday's tabs in a new window` and have the UI rearrange deterministically and instantly.
- As a Min power user, I want to add my own skill definition file so that a phrase I use often maps to a fixed sequence of browser actions.
- As a Min developer, I want to register a new tool without modifying the router or the panel so that capabilities grow incrementally.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. **Tool registry:** A registry exposes tools as `{ id, scope, description, parameters, handler }`. `id` is namespaced (`tabs.open`, `history.search`, `page.getContent`, `ui.tile`, `settings.get`). The registry can be serialized into a compact catalog for LLM context.
2. **Tool execution:** Every tool call goes through a single dispatcher that validates the tool id, validates parameters against the declared schema, enforces the capability scope, and returns a structured `{ ok, result | errorCode, errorMessage }`.
3. **Skill registry:** A skill is `{ id, title, kind: 'deterministic' | 'llm', triggers, parameters, run }`. Built-in skills are loaded from source; user skills are loaded from a user-data skills directory at startup. Duplicate ids resolve with user skills overriding built-ins.
4. **Explicit invocation:** A prompt beginning with `/` invokes a skill by id (`/search rust async`) and bypasses the model entirely for deterministic skills.
5. **Implicit routing:** A prompt without `/` is matched against skill triggers; on a confident match the skill runs, otherwise the prompt is sent to the configured LLM together with the tool + skill catalog.
6. **LLM response contract:** The model must return a structured plan — a short user-facing `message` plus an ordered list of `toolCalls`. Malformed output is rejected with a deterministic error shown in the panel; no free-form output is executed.
7. **Execution feedback:** The panel shows the prompt, the resolved skill or plan (tool ids and arguments, compactly), and the outcome. Failures state which tool failed and why.
8. **Mutation gating:** Tool calls in the `mutate` scope are only executed when the invocation carries mutate capability; the MVP may grant this by default for user-initiated prompts but must route it through the explicit gate.
9. **MVP built-in skills (minimum set):**
   - `search` — deterministic: build a search URL from the configured search engine and open it in a new tab.
   - `summarize` — LLM: extract readable content of the active tab and request a short summary.
   - `history` — deterministic (query) + optional LLM refinement: search places/history and present or open the matches.
   - `tabs.arrange` — deterministic: a basic UI manipulation such as grouping matching tabs into a new task or tiling/opening a set of tabs in a new window.
10. **Configuration:** Provider, model, and API credentials are read from settings and environment, consistent with the existing `llmProvider` / `llmModel` settings keys. With no provider configured, deterministic skills must still work and LLM paths must fail with clear guidance.
11. **Discoverability:** Typing `/` or an empty submit lists available skills with one-line descriptions.

## 8. Non-Functional Requirements
Capture quality and system constraints.

- Performance: Deterministic skills must feel like native UI actions — no network round-trip, perceptible latency comparable to clicking the equivalent control. LLM paths must not block the renderer.
- Reliability: A failing tool, skill, or provider must never leave the browser in a partially applied UI state without an error message; plan execution stops at the first failure and reports it.
- Security: Only registry-declared tools are callable; model output is treated as untrusted data and never evaluated as code. User skill files are declarative (no arbitrary code execution) or explicitly documented as trusted local code. Page content sent to a provider must be limited and disclosed.
- Accessibility: Prompt input, skill list, and result output are keyboard-navigable with accessible labels and visible focus.
- Compatibility: Works on all supported Min desktop platforms; no regression to existing searchbar, tasks, focus mode, or keybindings.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- User flow: Focus prompt bar → type a phrase or `/skill args` → submit → panel shows a compact activity line (skill/tool trace) → browser acts (tab opens, tabs regroup) and/or the panel renders a short answer.
- Visual considerations: Stay minimal — single-line activity entries, no chat avatars or heavy chrome. The browser viewport remains the primary surface; the panel is a thin command strip that can expand for longer answers.
- Edge cases: Empty prompt; unknown skill id; ambiguous trigger match; no active tab; page with no extractable content; provider unconfigured, timing out, or rate-limited; very long page content; history query with zero results; narrow window widths.

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- Proposed approach: Four layers with one-way dependencies — `promptPanel` (UI) → `router` (intent resolution) → `skills` (registry) → `tools` (capability dispatcher) → existing Min subsystems. `engineClient`/`llmEngine` become a provider adapter used only by the LLM paths, not by deterministic skills.
  - Renderer-side additions under `js/llmPrompt/`: `router.js`, `skills/registry.js`, `skills/builtin/*.js`, `tools/registry.js`, `tools/*.js`.
  - Main-process additions under `main/`: provider call implementation in `llmEngine.js`, user skill file loading, and any tools that must run in main (window management, settings).
  - Tools wrap existing modules rather than reimplementing them: `browserUI` for tabs/tasks, `places` for history, reader/readability extraction for page content, `settings` for configuration, `viewManager`/window management for layout.
- Dependencies: Existing renderer/main IPC bridge; existing search engine setting; existing places database; readability extraction already bundled in `ext/readability-master`; an HTTP call to the configured LLM provider (no heavyweight SDK preferred).
- Risks / unknowns: Reliability of model-produced plans without a formal function-calling API; latency of page content extraction on large pages; scope creep of the tool catalog; how much browser state to include as context per prompt; privacy expectations when page content leaves the device.
- Open questions: Which provider is the reference implementation for the MVP? Where do user skills live on disk and in what format (JSON/YAML/JS)? Should trigger matching be lexical only, or model-assisted with a cache? Does the prompt replace or coexist with the existing searchbar long-term?

## 11. Acceptance Criteria
Define how success will be measured.

- [ ] Criterion 1: Typing a web-search prompt in the bottom prompt bar opens search results in a tab, with no LLM provider configured.
- [ ] Criterion 2: At least one UI manipulation skill (grouping/tiling/opening a tab set) is invocable from the prompt and executes deterministically.
- [ ] Criterion 3: A history-search prompt returns matching visited pages and can open them.
- [ ] Criterion 4: With a provider configured, a general query and a page-summary prompt produce an answer, and any resulting actions are executed only via registered tools.
- [ ] Criterion 5: Tools and skills are discoverable at runtime (`/` lists skills) and a new tool or skill can be added by adding one module plus a registry entry, with no router or panel changes.
- [ ] Criterion 6: Invalid or malformed model output produces a clear panel error and performs no browser action.

## 12. Testing / Verification
Describe how the feature will be validated.

- Manual test plan: Run each MVP skill with and without a provider configured; verify unknown skill, empty prompt, ambiguous trigger, provider timeout, and zero-result history query; confirm tab bar, tasks, focus mode, and keybindings are unaffected.
- Automated test coverage: Unit tests for the tool dispatcher (schema validation, scope enforcement, error shapes), the skill registry (loading, override precedence), the router (explicit vs implicit vs LLM routing), and the plan parser (valid, malformed, unknown tool id).
- Regression considerations: Existing searchbar behavior, session restore, task overlay, window layout, and prompt panel visibility must be unchanged.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- Rollout plan: Land behind the existing prompt panel; keep LLM paths inert until a provider is configured so the default experience is deterministic and fast.
- Follow-up work: Streaming responses and tool-call visualization; multi-step agentic plans with confirmation for destructive actions; user skill authoring UX; per-skill permission scopes; local/offline model support; richer context packs (open tabs, selection, task state); trigger matching improvements.
