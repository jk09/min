# Feature Specification Template

## 1. Feature Title
- **Feature name:** `/b` command debug mode with a dedicated debug tab
- **Created on:** 2026-08-16
- **Owner:** Jozef Košík (jozef.kosik@radixal.net)

## 2. Summary
Add a `Debug` switch to the LLM prompt toolbar that, when enabled, opens a dedicated internal tab for every `/b <command>` run showing the full model exchange (system prompt, instruction, raw model response, parsed plan) and the internal browser-API tool-call trace, so `/b`'s natural-language-to-browser-action pipeline (see [feat-h4qz2r-nl-browser-commands/SPEC.md](../feat-h4qz2r-nl-browser-commands/SPEC.md)) is debuggable end to end.

- **Problem statement:** `/b` currently reports only a short, single-line summary in the prompt's result area ([js/llmPrompt/promptPanel.js](../../../js/llmPrompt/promptPanel.js)'s `renderResult`/`describeTrace`), which is enough for normal use but makes it hard to diagnose why a plan was rejected, why the model chose (or failed to choose) certain tool calls, or what arguments a tool actually received, especially while iterating on the tool catalog or trying different own-model providers.
- **Desired outcome:** With `Debug` on, each `/b` run's full context - the system prompt built from the tool catalog, the user's instruction, the model's raw JSON response, the parsed plan, and the ordered tool-call trace (id, args, ok/error, result) - is captured and shown in a separate, readable tab, without ever exposing API keys/credentials, and without changing `/b`'s behavior when `Debug` is off.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** `/b` is implemented as an `id: 'b'`, `kind: 'llm'` skill in [js/llmPrompt/skills/builtinSkills.js](../../../js/llmPrompt/skills/builtinSkills.js): it builds a system prompt from `toolRegistry.getCatalog()` via [js/llmPrompt/planningSkill.js](../../../js/llmPrompt/planningSkill.js), calls the configured model through `context.llm.complete` (bridged to [main/llmEngine.js](../../../main/llmEngine.js)'s `llmEngine:complete` IPC handler via [js/llmPrompt/engineClient.js](../../../js/llmPrompt/engineClient.js)), validates the response with [js/llmPrompt/planParser.js](../../../js/llmPrompt/planParser.js), and executes it with `context.runPlan`, which is implemented in [js/llmPrompt/promptRouter.js](../../../js/llmPrompt/promptRouter.js)'s `createContext` and appends `{ tool, args, ok }` entries to an in-memory `trace` array as each tool call runs through [js/llmPrompt/tools/toolRegistry.js](../../../js/llmPrompt/tools/toolRegistry.js). Today, only `result.trace`, `result.message`, and `result.detail` reach the UI, rendered as one line by `promptPanel.js`'s `renderResult`/`describeTrace` - the system prompt, the raw model output, and full tool arguments/results are discarded once the run completes. The LLM prompt toolbar already has a proven pattern for toggle-like/selector controls (the AI-agent, search-engine, and own-model pickers in `promptPanel.js` + [index.html](../../../index.html) + [css/llmPrompt.css](../../../css/llmPrompt.css)), and Min already has a mechanism for dedicated internal tabs served from the app bundle (`min://app/...`, resolved from a short `min:name` form in [js/util/urlParser.js](../../../js/util/urlParser.js), e.g. the existing `pages/settings`, `pages/newtab`, `pages/error` pages, each with matching main-process wiring).
- **Motivation:** Debugging an LLM-driven plan (wrong tool chosen, malformed JSON, unexpected arguments, a tool that fails) currently requires re-running with a modified `console.log` or attaching devtools to the renderer; a structured, per-run debug tab makes this a normal, user-facing capability instead of a developer-only workaround, which fits this fork's goal of an LLM-driven, inspectable "vibe browsing" workflow.
- **Related issues or references:** [feat-h4qz2r-nl-browser-commands/SPEC.md](../feat-h4qz2r-nl-browser-commands/SPEC.md) (the `/b` feature this extends), [js/llmPrompt/skills/builtinSkills.js](../../../js/llmPrompt/skills/builtinSkills.js), [js/llmPrompt/planningSkill.js](../../../js/llmPrompt/planningSkill.js), [js/llmPrompt/promptRouter.js](../../../js/llmPrompt/promptRouter.js), [js/llmPrompt/promptPanel.js](../../../js/llmPrompt/promptPanel.js), [js/llmPrompt/tools/toolRegistry.js](../../../js/llmPrompt/tools/toolRegistry.js), [main/llmEngine.js](../../../main/llmEngine.js), [js/util/urlParser.js](../../../js/util/urlParser.js), existing internal pages under [pages/](../../../pages/).

## 4. Goals
List the primary outcomes this feature should achieve.

- Goal 1: Add a `Debug` toggle to the LLM prompt toolbar, off by default, that does not otherwise change `/b`'s (or any other skill's) behavior when left off.
- Goal 2: When `Debug` is on, capture a structured record of every `/b` run: the instruction, the selected own model, the system prompt sent to the model, the model's raw response, the parsed plan (`message` + `toolCalls`), and the ordered tool-call trace (tool id, args, `ok`, and either the tool's `result` or `errorMessage`).
- Goal 3: Surface that record in a dedicated tab per run (or a single reused debug tab updated per run - see [Open Questions](#10-technical-notes)), rendered in a structured, readable layout rather than raw JSON dumped into the normal result line.
- Goal 4: Guarantee the debug record never includes secrets (`llmApiKey`, any `Authorization` header value, or other credential material), even though the underlying request in `main/llmEngine.js` does use them.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Non-goal 1: A general-purpose devtools/inspector for every skill; this spec covers `/b` only (the one skill that performs model-driven planning today). Extending the same capture to `/summarize` or future `llm`-kind skills is a possible follow-up, not part of this spec.
- Non-goal 2: Persisting debug records to disk or across app restarts. Records are in-memory only, scoped to the current session, and are lost on quit/reload.
- Non-goal 3: A full request/response network inspector (headers, timing waterfall, retries). The debug tab shows the same structured data the runtime already computes (system prompt, output, plan, trace), not a raw HTTP capture.
- Non-goal 4: Redacting or logging debug records anywhere else (files, telemetry, statistics). This is a local, in-memory, UI-only feature.

## 6. User Stories
Capture the expected user experience.

- As a user iterating on `/b` instructions, I want to flip on `Debug` and immediately see why my last `/b` command didn't do what I expected, so that I can fix my instruction or realize a tool is missing.
- As a user comparing own-model options, I want the debug tab to show which own model handled the run and the exact system prompt it received, so that I can judge whether a different provider/model would plan better.
- As a privacy-conscious user, I want to be certain that turning on `Debug` never reveals my API key or other credentials in a tab I might screen-share or leave open, so that I can debug safely.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. The LLM prompt toolbar shows a `Debug` toggle (e.g. `#llm-prompt-debug`), off by default each time the app starts, alongside the existing agent/search-engine/own-model selectors; its state is not persisted to settings.
2. When `Debug` is off, `/b` behaves exactly as it does today: only `result.message`/`result.detail`/`result.trace` reach the status-bar result line, and no additional tab is opened.
3. When `Debug` is on and `/b` runs, the runtime captures a debug record containing: the instruction text, the selected own-model id, the system prompt built by `planningSkill.buildSystemPrompt`, the model's raw response text, the parsed `{ message, toolCalls }` plan (or the parse error code/message if parsing failed), and the full ordered tool-call trace (`{ tool, args, ok, result | errorMessage }` per step).
4. The debug record is delivered to a dedicated internal tab (`min://` internal page, following the existing `pages/*` + `min://app/...` convention) opened via the existing tab-opening path; if a debug tab from an earlier run in the same session is still open, the new run's record replaces its content instead of opening another tab (avoids tab pile-up across repeated `/b` runs).
5. The debug tab renders the record in clearly labeled sections (Instruction, Own model, System prompt, Model response, Parsed plan, Tool-call trace with per-step status), not as an undifferentiated JSON blob.
6. If `/b` fails before or during the model call (e.g. `provider_not_configured`, `provider_error`, `timeout`), the debug tab still opens/updates (when `Debug` is on) and shows whatever partial record exists (instruction, own model, and the failure reason), rather than silently producing no debug output.
7. The debug record construction and rendering never include `llmApiKey`, `Authorization` header values, or `MIN_LLM_API_KEY`; only non-secret identifiers (`provider`, `model`) are included, matching what `llmEngine.js`'s existing `getEngineStatus()` already exposes safely.
8. Toggling `Debug` off at any point stops new debug tabs/updates for subsequent runs; it does not close or clear a debug tab that is already open.

## 8. Non-Functional Requirements
Capture quality and system constraints.

- Performance: Capturing the debug record adds negligible overhead (string/object bookkeeping already computed during a normal `/b` run); it must not add a second model round-trip or measurably slow down runs when `Debug` is off (zero overhead in that case).
- Reliability: A failure while rendering the debug tab (e.g. an internal page bug) must never break `/b`'s normal result reporting in the prompt panel - debug rendering is best-effort and additive.
- Security: No secrets in the debug record or rendered tab (see Functional Requirement 7); the debug tab is an internal `min://app/...` page, not a webview loading remote/third-party content, so no external network exposure of the captured data.
- Accessibility: The debug tab follows the same base page conventions as other internal pages (e.g. [pages/pagebase.css](../../../pages/pagebase.css)), with readable text sections and no reliance on color alone to convey step success/failure (e.g. pair color with a "✓"/"✗" or "ok"/"failed" label).
- Compatibility: Works identically regardless of which own-model/provider is selected, since the captured fields (system prompt, raw output, plan, trace) are already provider-agnostic values the runtime computes today.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- User flow: User opens the LLM prompt → toggles `Debug` on (button changes to a visibly "active" state, mirroring the toolbar's existing button styling) → runs `/b <instruction>` → the debug tab opens (or updates, if already open) alongside the normal status-bar result → user switches to that tab to inspect the run.
- Visual considerations: Reuses `.llm-prompt-toolbar-button` styling for the toggle, with an "on" state class (e.g. `.llm-prompt-toolbar-button.active`) rather than introducing a new control paradigm; the debug tab's internal page follows the same minimal visual style as other `pages/*` internal pages rather than introducing a new design language.
- Edge cases: Rapidly re-running `/b` while `Debug` is on should update the same debug tab without flicker or duplicate tabs; closing the debug tab manually and then running `/b` again (still with `Debug` on) should open a fresh debug tab rather than erroring because the previous tab id is gone.

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- **Proposed approach:** Add `state.debugEnabled` (default `false`) and a toolbar toggle button in [js/llmPrompt/promptPanel.js](../../../js/llmPrompt/promptPanel.js)/[index.html](../../../index.html)/[css/llmPrompt.css](../../../css/llmPrompt.css), following the existing button-styling conventions (no new picker/menu needed - this is a simple on/off toggle, unlike the agent/search-engine/own-model pickers). Thread a `debug: state.debugEnabled` flag through `promptRouter.handlePrompt`'s `options` (alongside the existing `agentId`/`ownModelId`) into the `/b` skill's `context`. Inside the `/b` skill in `builtinSkills.js`, when `context.debug` is true, assemble the debug record described in Functional Requirement 3 as the run proceeds (the system prompt, raw `answer.output`, `parsed`/`parsed.plan`, and `planResult.steps` are already available locally in the skill's `run` function) and hand it off to a small new module, e.g. `js/llmPrompt/debugTab.js`, responsible for getting it into a tab.
- **Delivery to a separate tab:** Because a tab's webview is an isolated renderer context (not the same JS context as the main window's `promptPanel.js`), the debug record cannot be handed over as an in-memory JS reference the way `promptPanel.js` shares state with itself. The simplest approach consistent with Min's existing architecture: keep the latest debug record in a small main-process-held store (e.g. an IPC handler in a new `main/llmDebugStore.js`, analogous in spirit to `main/llmEngine.js`) exposed via `ipc.handle('llmDebug:get')`/`ipc.handle('llmDebug:set', record)`; add a new internal page `pages/llmPromptDebug/index.html` (+ `.js`) that reads the record over IPC (via a small preload script, matching how other internal pages like `pages/settings` already bridge to `ipcRenderer`) and re-fetches/re-renders whenever notified of an update (e.g. via `ipcRenderer.on('llmDebug:updated', ...)`, pushed from the main process when `llmDebug:set` is called). The tab itself is opened/reused with the existing `tabs.open`-style mechanism at a fixed internal URL (e.g. `min://llmPromptDebug`, resolved the same way other short `min:name` URLs are in [js/util/urlParser.js](../../../js/util/urlParser.js)); "reuse the existing tab if still open" can be implemented by checking `tabs.get()` for a tab whose URL already matches that internal URL before opening a new one.
- **Dependencies:** Existing `/b` skill and its already-computed intermediate values (system prompt, raw model output, parsed plan, `runPlan` steps); Min's `min://app/...` internal-page and preload/IPC conventions; `toolRegistry`/`promptRouter` (no changes needed to their core behavior, only threading an extra `debug` flag through).
- **Risks / unknowns:** Tool `args`/`result` values could themselves be large (e.g. `page.getText`'s truncated page text) - the debug tab should truncate/collapse long values for readability rather than rendering unbounded text. Multiple prompt-panel-driven `/b` runs in quick succession (e.g. from a declarative/user skill reusing the same plan/execute path in the future) could race on updating the single debug tab; a simple "latest write wins" IPC store is acceptable for v1 given `/b` is single-shot and not concurrent by design.
- **Open questions:** Should there be exactly one reused debug tab across the whole session, or one debug tab per `/b` run (with the user manually closing old ones)? This spec recommends "one reused tab" (Functional Requirement 4) for minimalism, but a "pin/keep history" option could be a follow-up. Should `Debug` state be remembered per session only (this spec's recommendation) or ever promoted to a persisted setting once the feature has proven useful?

## 11. Acceptance Criteria
Define how success will be measured.

- [ ] A `Debug` toggle exists in the LLM prompt toolbar, defaults to off, and does not persist across app restarts.
- [ ] With `Debug` off, running `/b` produces exactly the same result-line behavior as today, with no extra tab opened.
- [ ] With `Debug` on, running a `/b` command that maps to tool calls opens (or updates) a debug tab showing the instruction, own model, system prompt, raw model response, parsed plan, and the full tool-call trace with per-step status.
- [ ] With `Debug` on, a `/b` run that fails before executing any tool call (e.g. no provider configured, malformed plan) still opens/updates the debug tab with the available partial record and the failure reason.
- [ ] The debug tab never displays `llmApiKey`/`Authorization`/`MIN_LLM_API_KEY` values under any provider configuration.
- [ ] Re-running `/b` with `Debug` on while the debug tab from a previous run is still open updates that same tab instead of opening a new one.

## 12. Testing / Verification
Describe how the feature will be validated.

- Manual test plan: With a configured model (e.g. local Ollama per [feat-h4qz2r-nl-browser-commands/SPEC.md](../feat-h4qz2r-nl-browser-commands/SPEC.md)'s setup), toggle `Debug` on and run a `/b` command that succeeds, one that the model can't map to a tool, and one with no provider configured; confirm the debug tab's content matches each scenario and that toggling `Debug` off stops new tabs/updates from appearing. Inspect the debug tab's rendered HTML/DOM to confirm no API key value appears anywhere.
- Automated test coverage: Add unit tests (mirroring the existing style in [test/promptRuntime.test.js](../../../test/promptRuntime.test.js)) for the debug-record-building logic in the `/b` skill (e.g. extracted into a small pure helper similar to `planningSkill.js`) covering: the record's shape for a successful plan, for a parse failure, and for a `provider_error`/`provider_not_configured` failure; and a test asserting the record-building helper never includes a `llmApiKey`/`Authorization` field even if such a field were present on inputs.
- Regression considerations: Verify existing `/b`, `/search`, `/history`, `/tabs`, `/summarize`, `/ai` behavior and their existing tests are unaffected when `Debug` is off (the default), and that adding the `debug` flag to `context`/`handlePrompt` options does not change behavior for skills that ignore it.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- Rollout plan: Ship as part of the LLM prompt UI, gated only by the `Debug` toggle itself; no separate feature flag needed.
- Follow-up work: Extend the same debug capture to other `llm`-kind skills (`/summarize`, and any future model-driven skill); consider an optional "keep history" mode that lists multiple past runs instead of only the latest; consider promoting `Debug` to a persisted setting if usage shows users want it to survive restarts.
