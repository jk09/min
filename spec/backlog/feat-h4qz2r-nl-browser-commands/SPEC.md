# Feature Specification Template

## 1. Feature Title
- **Feature name:** Natural-language browser commands via `/b <command>`
- **Created on:** 2026-08-16
- **Owner:** Jozef Košík (jozef.kosik@radixal.net)

## 2. Summary
Let users type `/b <free-form instruction>` in the LLM prompt to drive browser capabilities (open pages, search history, manage tabs/windows, change settings) through natural language, instead of the existing `/ai` command, which only hands a prompt off to an external AI agent's own web UI.

- **Problem statement:** The prompt runtime already supports fixed, single-purpose skills (`/search`, `/history`, `/tabs`, `/summarize`, `/ai`, …) and a generic tool registry that can act on the browser (open/close tabs, search history, read a page, read/write a small allow-list of settings), but there is no way to express a compound or loosely-phrased instruction — e.g. "open these three links", "close all tabs that were only used for a search", "put all tabs about dotnet news into their own window" — and have it translated into the right sequence of tool calls.
- **Desired outcome:** A `/b <instruction>` skill sends the instruction, together with the catalog of available browser tools, to the already-configured LLM; the model returns a small, structured plan (a JSON list of tool calls, using the same shape already defined in [js/llmPrompt/planParser.js](../../../js/llmPrompt/planParser.js)); the runtime validates and executes the plan through the existing [js/llmPrompt/tools/toolRegistry.js](../../../js/llmPrompt/tools/toolRegistry.js), and reports back what it did (or why it refused).

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** The LLM prompt runtime ([js/llmPrompt/promptRouter.js](../../../js/llmPrompt/promptRouter.js)) resolves prompt text to either an explicit `/id args` skill, an implicit trigger match, or a plain web search. Skills are defined in [js/llmPrompt/skills/builtinSkills.js](../../../js/llmPrompt/skills/builtinSkills.js) and run through a `context.runTool` / `context.runPlan` helper that calls into [js/llmPrompt/tools/browserTools.js](../../../js/llmPrompt/tools/browserTools.js) (`tabs.list`, `tabs.open`, `tabs.close`, `search.web`, `history.search`, `history.searchFullText`, `page.getText`, `settings.get`, `settings.set`). Every existing `kind: 'llm'` skill (only `/summarize` today) calls the model for content generation, not for deciding *which* tools to call. A model-authored plan format already exists and is unit-tested ([js/llmPrompt/planParser.js](../../../js/llmPrompt/planParser.js), [test/promptRuntime.test.js](../../../test/promptRuntime.test.js)) — it parses `{ message, toolCalls: [{ tool, args }] }` out of a model response and validates tool names against a known-tools list — but nothing in the runtime currently constructs the prompt sent to the model or invokes this parser; it is dead code today. The `/ai` skill and [js/llmPrompt/agents/agentRegistry.js](../../../js/llmPrompt/agents/agentRegistry.js) instead hand the raw prompt off to an external agent's own hosted web UI (e.g. `claude.ai/new?q=...`) and never execute browser actions on the model's behalf. Model access itself goes through [main/llmEngine.js](../../../main/llmEngine.js) (`llmEngine:complete` IPC handler), which calls whatever OpenAI-compatible provider/model the user has configured (`llmProvider`, `llmModel`, `llmBaseURL`, `llmApiKey`, or `MIN_LLM_*` env vars) — there is no model bundled with Min today, and no training pipeline in this repository.
- **Motivation:** Users want a single, memorable entry point (`/b ...`) for arbitrary, compound browser actions phrased in plain language, matching the project's goal of an LLM-driven, "vibe browsing" workflow, without needing to memorize the exact `/id` syntax of each narrow built-in skill.
- **Related issues or references:** [js/llmPrompt/promptRouter.js](../../../js/llmPrompt/promptRouter.js), [js/llmPrompt/planParser.js](../../../js/llmPrompt/planParser.js), [js/llmPrompt/tools/browserTools.js](../../../js/llmPrompt/tools/browserTools.js), [js/llmPrompt/tools/toolRegistry.js](../../../js/llmPrompt/tools/toolRegistry.js), [js/llmPrompt/skills/builtinSkills.js](../../../js/llmPrompt/skills/builtinSkills.js), [js/llmPrompt/skills/skillRegistry.js](../../../js/llmPrompt/skills/skillRegistry.js), [js/llmPrompt/agents/agentRegistry.js](../../../js/llmPrompt/agents/agentRegistry.js), [main/llmEngine.js](../../../main/llmEngine.js), [test/promptRuntime.test.js](../../../test/promptRuntime.test.js).

## 4. Goals
List the primary outcomes this feature should achieve.

- Goal 1: Add a `/b <instruction>` skill that turns a free-form instruction into a validated sequence of existing (or newly added) browser tool calls, executed via the existing tool registry, and reports a concise summary of what happened.
- Goal 2: Wire the already-written `planParser` into a real model round-trip: build a system prompt from the live tool catalog (id, scope, description, parameters), send the user's instruction to `llmEngine`/`engineClient`, parse the response, and reject/ask-again on malformed or out-of-catalog plans.
- Goal 3: Document and settle the "should we train a bespoke mini-model" question raised by the request, with a recommendation grounded in the runtime that already exists, so implementation work is not duplicated or misdirected.
- Goal 4: Extend `browserTools.js` only as far as needed to cover the example commands (e.g. bulk tab open, window placement/grouping, theme setting) that have no existing tool today, while keeping every new tool small, scoped (`read`/`mutate`), and validated the same way as existing tools.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Non-goal 1: Training, fine-tuning, distilling, or bundling any custom/local model with Min. This spec evaluates that idea and recommends against it for the initial version (see [Technical Notes](#10-technical-notes)).
- Non-goal 2: Building a general-purpose autonomous agent loop (multi-turn tool use with the model observing tool results and re-planning). The first version is a single-shot "plan, validate, execute" flow, matching the `MAX_TOOL_CALLS` cap already defined in `planParser.js`.
- Non-goal 3: Changing `/ai`, `agentRegistry.js`, or the external-agent hand-off flow.
- Non-goal 4: A visual plan-preview/confirmation UI beyond a plain-text summary of the steps taken (may be a follow-up).

## 6. User Stories
Capture the expected user experience.

- As a user of Min, I want to type `/b open all of the following links: www.google.com, www.bing.com` so that all of the links open in tabs without me clicking through each one.
- As a user of Min, I want to type `/b find all tabs in the history dealing with tax return forms` so that I get a short list of matching pages without composing a manual search query.
- As a user of Min, I want to type `/b change the browser's theme to dark` so that a simple settings change happens through the same prompt I already use for search and AI hand-off.
- As a user of Min, I want the prompt to tell me plainly when it can't safely do what I asked (e.g. a command needs a tool that doesn't exist yet), so that I'm not left guessing whether it silently failed.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. `/b <instruction>` is recognized by [skillRegistry.js](../../../js/llmPrompt/skills/skillRegistry.js)'s existing `/id args` explicit-invocation syntax, alongside the current built-in skills; an empty instruction returns a usage error, matching the pattern used by `/search`, `/history`, etc.
2. On invocation, the skill builds a system prompt listing the current tool catalog (`toolRegistry` entries' `id`, `scope`, `description`, and `parameters`) and asks the model to return only `{ message, toolCalls: [...] }` as defined by `planParser.js`'s expected shape; the user's instruction is sent as the user message.
3. The model response is parsed with `planParser.parsePlan(raw, knownToolIds)`. If parsing fails (`malformed_plan`, `unknown_tool`, `plan_too_long`, `empty_plan`), the skill returns that message to the user without executing anything.
4. If parsing succeeds, the resulting `toolCalls` are executed in order via `context.runPlan`, which already stops and reports on the first tool failure (existing behavior of `promptRouter.js`'s `runPlan`).
5. Tool calls whose `scope` is `mutate` only run when the prompt was invoked with mutate capability (existing `options.scope` gate in `handlePrompt`); `/b` run from a read-only caller (if any exists) only allows read-scoped tools to execute, consistent with how other skills already behave.
6. After execution, the skill returns a concise, human-readable summary combining the model's `message` with the count/kind of tool calls performed (e.g. "Opened 3 tabs.", "Found 4 pages matching 'tax return forms'.").
7. `/b` appears in the skill catalog (`/` help listing and `/skills`) with a usage string `/b <instruction>` and a description explaining it plans and runs a browser action.
8. New browser tools added to satisfy the example commands (bulk open, tab-to-window grouping, theme setting) follow the existing `browserTools.js` conventions: an `id`, a `scope`, a `description`, declared `parameters`, and a `handler` that validates its inputs and throws a plain `Error` on invalid input (matching `tabs.close`'s existing validation style).

## 8. Non-Functional Requirements
Capture quality and system constraints.

- Performance: A `/b` call costs exactly one model round-trip (via the existing `llmEngine:complete` timeout of 60s) plus the deterministic execution of at most `MAX_TOOL_CALLS` (5) tool calls; no polling or multi-turn loop.
- Reliability: Any malformed, oversized, or out-of-catalog plan must fail closed (no partial or best-effort execution of a plan the runtime doesn't fully understand), reusing `planParser`'s existing error codes.
- Security: The model never executes code or receives raw handler implementations — only the declarative tool catalog (ids/descriptions/parameter schemas) is sent to it, and every model-proposed tool call is re-validated against `toolRegistry`'s real parameter definitions before running, exactly as `toolRegistry.run` already does for other skills. `mutate`-scoped tools remain gated by the existing `scope` option threaded through `handlePrompt`. Settings tools remain restricted to the existing `READABLE_SETTINGS`/`WRITABLE_SETTINGS` allow-lists (no `/b` bypass of those lists is permitted).
- Accessibility: No new UI surface beyond the existing prompt result text; the `/b` output follows the same text rendering path as other skill results.
- Compatibility: Works with any OpenAI-compatible provider already supported by `llmEngine.js` (OpenAI, OpenRouter, local Ollama/LM Studio); degrades to the existing "no model configured" error message when `providerConfigured` is false.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- User flow: User types `/b <instruction>` in the LLM prompt → prompt shows a brief "thinking" state while the model call is in flight (same as `/summarize` today) → result area shows either the summarized outcome or a plain-language refusal/error.
- Visual considerations: Reuses the existing prompt result rendering; no new toolbar controls are required for the initial version (the existing agent/search-engine selectors are unrelated to `/b`).
- Edge cases: Instruction requests an action with no matching tool (e.g. "translate this page to French" when no such tool exists) — the model should be instructed, via the system prompt, to say so in `message` and return an empty `toolCalls` list rather than inventing a tool name; the runtime's `unknown_tool` handling exists as the last line of defense either way. Very long link lists (e.g. "open all of the following links: ...") may exceed `MAX_TOOL_CALLS` (5); the user-facing error should suggest splitting the request, and this cap is worth revisiting once real usage is observed.

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- **Proposed approach:** Do not train or bundle a custom model. Add a `plan`-kind (or reuse `'llm'` `kind`) skill, e.g. `id: 'b'`, in `builtinSkills.js` that: (1) reads `toolRegistry.list()`-equivalent metadata (an export may need to be added to [toolRegistry.js](../../../js/llmPrompt/tools/toolRegistry.js) if it doesn't already expose the full catalog) to build a compact system prompt describing every tool's id/scope/description/parameters; (2) calls `context.llm.complete({ system, prompt: input.argsText, responseFormat: 'json' })` (the `responseFormat: 'json'` option already exists in `llmEngine.js`'s `requestCompletion`); (3) parses the result with `planParser.parsePlan(answer.output, knownToolIds)`; (4) executes the plan with `context.runPlan(plan.toolCalls)`; (5) returns a message combining `plan.message` with a short summary derived from `steps`. Extend `browserTools.js` with the minimal new tools the example commands need (e.g. `tabs.openMany`, `tabs.groupIntoWindow` or similar, `settings.set` already covers a `theme` key if `theme` is added to `WRITABLE_SETTINGS`) — keep each addition small and reviewed like the existing tools, not a bulk API surface.
- **Viability of a bespoke/trained mini-model (as requested by the prompt): assessment.**
  - *Why a custom-trained model is not recommended for v1:* Modern general-purpose instruction-following LLMs (including small ones, 3–8B parameters, run locally via Ollama/LM Studio, both already supported providers in `llmEngine.js`) are already reliable at the narrow task this feature needs — mapping a short instruction to a handful of calls against a small, well-documented tool catalog (structured "function calling"/JSON-mode, which `llmEngine.js` already requests via `response_format: 'json_object'`). This is a solved, well-trodden pattern (the same approach used by tool-calling in OpenAI/Anthropic/Ollama APis) and does not require domain-specific training; correctness instead comes from (a) a good system prompt / tool schema and (b) strict server-side validation of the plan (already implemented in `planParser.js`), not from model weights.
  - *Cost of training a bespoke model:* Producing a small model that reliably outputs valid tool-call JSON for an evolving, project-specific tool catalog would require: a labeled dataset of instruction→plan pairs (hundreds to low thousands of examples per tool, regenerated every time the tool catalog changes), a fine-tuning or distillation pipeline (compute, versioning, evaluation harness), and a packaging/runtime story to ship model weights with every Min release (multi-hundred-MB-to-multi-GB artifacts, platform-specific runtimes such as ONNX/llama.cpp, and update/versioning concerns) — none of which exist in this repository today (`scripts/` has no ML tooling). This is a large, ongoing maintenance burden for a browser project whose stated goal is to stay minimalistic and use widely supported dependencies.
  - *Recommendation:* Use the user's already-configured external/local model (existing `llmProvider`/`llmModel`/`llmBaseURL` settings) as the planner via the already-built `planParser.js` contract; do not embed or train a model in this repository. Revisit a bundled small local model only if/when: users frequently have no model configured, and product research shows a bundled model materially improves the out-of-the-box experience — at that point, a pre-trained, already-instruction-tuned small open model (not one trained from scratch) run through `llama.cpp`/Ollama would be the pragmatic option, still using the same `planParser`/tool-catalog contract rather than a browser-specific fine-tune.
- **Dependencies:** A configured LLM provider (`llmProvider`/`llmModel`/`llmBaseURL`/`llmApiKey` or `MIN_LLM_*` env vars) via `main/llmEngine.js`; the existing tool/skill registries; `planParser.js`.
- **Risks / unknowns:** Model reliability varies by provider/model choice — a small local model may produce malformed plans more often than a larger hosted one; the `unknown_tool`/`malformed_plan` failure paths need to feel like a normal, non-alarming response rather than a crash. Prompt-injection risk from web page content is out of scope here since `/b` plans are built from the user's typed instruction only, not from page contents (unlike `/summarize`, which does feed page text to the model) — this should be kept true as the feature evolves (do not silently splice page text into the `/b` planning prompt).
- **Open questions:** Should `/b` reuse the `'llm'` skill `kind`, or does the plan/execute pattern warrant a third `kind` (e.g. `'plan'`) in `skillRegistry.js` for clearer intent and future reuse by declarative user skills? Should the result message list every executed step (from `context.runPlan`'s `steps` trace) or stay as a short summary, given the toolbar's minimalistic goals? Should there be a per-call confirmation step for `mutate`-scoped plans (e.g. closing many tabs) before execution, or is the existing single-shot `runPlan` behavior (matching other mutate skills today) acceptable?

## 11. Acceptance Criteria
Define how success will be measured.

- [ ] `/b <instruction>` is resolvable as an explicit skill and appears in `/` and `/skills` output with a usage string.
- [ ] A `/b` instruction that maps cleanly onto existing tools (e.g. "open www.example.com in a new tab") results in the correct tool call(s) being executed and a clear success message.
- [ ] A `/b` instruction that the model cannot map to any known tool returns a clear, non-crashing message instead of executing an invalid or partial plan.
- [ ] A malformed or oversized model response (bad JSON, unknown tool id, more than `MAX_TOOL_CALLS` steps) is rejected by `planParser` and surfaced as a plain-language error, with no tool executed.
- [ ] `mutate`-scoped tool calls proposed by a plan only execute when the invoking context's scope allows mutation, matching existing skill behavior.
- [ ] The spec's recommendation against training/bundling a custom model is reflected in the implementation (no new model training pipeline or bundled model artifact is introduced).

## 12. Testing / Verification
Describe how the feature will be validated.

- Manual test plan: Configure a local model (e.g. via Ollama) and a hosted one (e.g. OpenAI); run each example command from the request (open multiple links, search history for a topic, close tabs, change theme, group tabs into a window) and confirm the outcome matches the instruction; try an instruction with no matching tool and confirm a graceful refusal message; try with no model configured and confirm the existing `provider_not_configured` message surfaces through `/b`.
- Automated test coverage: Extend [test/promptRuntime.test.js](../../../test/promptRuntime.test.js) with unit tests for the new `/b` skill using a stubbed `context.llm.complete` (mirroring existing test patterns for `planParser`), covering: a well-formed plan executes the expected tool calls; a malformed/oversized/unknown-tool plan is rejected without executing anything; scope gating still applies to plans containing `mutate` tool calls.
- Regression considerations: Ensure new browser tools added to `browserTools.js` are covered by the same validation conventions as existing tools (thrown `Error` on bad input) so `toolRegistry.run`'s existing error-wrapping behavior stays consistent; verify existing skills (`/search`, `/history`, `/tabs`, `/summarize`, `/ai`) are unaffected.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- Rollout plan: Ship behind no special flag (consistent with other prompt skills), gated only by whether the user has a model configured, same as `/summarize` today.
- Follow-up work: Consider a lightweight confirmation/preview UI for `mutate` plans before execution; consider raising or making configurable the `MAX_TOOL_CALLS` cap once real usage patterns (e.g. "open N links") are observed; revisit the bundled-small-local-model question if hosted/external model configuration proves to be a significant adoption barrier; consider allowing declarative user skills (`compileDeclarativeSkill`) to opt into the same plan/execute flow for user-authored natural-language macros.
