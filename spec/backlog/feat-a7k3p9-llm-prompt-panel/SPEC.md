# Feature Specification Template

## 1. Feature Title
- **Feature name:** LLM Prompt Panel for Browser Control
- **Created on:** 2026-08-08 20:35:24 +02:00
- **Owner:** Jozef Košík <jozef.kosik@radixal.net>

## 2. Summary
Provide a concise overview of the feature and why it matters.

- **Problem statement:** Min does not yet provide an embedded, first-class prompt surface for LLM-driven browsing workflows and browser-internal actions.
- **Desired outcome:** Introduce a bottom-panel prompt UI (similar to VS Code Copilot Chat / Claude Desktop input experience) that can later be repositioned to any window side and connected to an engine that can access both external LLM models and Min internals.

## 3. Background and Context
Describe the context, current limitations, and any related work.

- **Current behavior:** Browser interactions are primarily traditional UI-driven; there is no dedicated in-window prompt panel for agentic workflows.
- **Motivation:** The fork goal is LLM-driven browsing with minimal UI disruption and agent-like workflows.
- **Related issues or references:** AGENTS.md project goals and conventions; prompt UX patterns in VS Code Copilot Chat and Claude Desktop.

## 4. Goals
List the primary outcomes this feature should achieve.

- Goal 1: Add a prompt panel anchored at the bottom of the main browser window with chat-style composition UX.
- Goal 2: Architect panel layout so it can be repositioned to left/right/top/bottom in future without major rewrites.
- Goal 3: Define engine integration boundaries for external LLM access plus safe manipulation hooks into Min internals.

## 5. Non-Goals
List what is explicitly out of scope for this feature.

- Non-goal 1: Full implementation of draggable/dockable UI behavior for all sides in this iteration.
- Non-goal 2: Final production policy enforcement, billing, and provider-specific orchestration logic.

## 6. User Stories
Capture the expected user experience.

- As a Min power user, I want a familiar chat prompt panel inside the browser so that I can drive browsing tasks without leaving the window.
- As a Min developer, I want the panel architecture to be side-positionable so that future layout variants can be enabled with minimal refactoring.

## 7. Functional Requirements
Define the expected behavior in clear, testable terms.

1. Requirement 1: The browser main window includes a bottom prompt panel with a multiline text input and send action, visually resembling modern chat inputs.
2. Requirement 2: The panel container exposes a position configuration model (`bottom`, `left`, `right`, `top`) even if only `bottom` is rendered initially.
3. Requirement 3: Submitting a prompt routes the request through a dedicated engine interface that abstracts external LLM provider calls and Min internal action APIs.
4. Requirement 4: The engine interface must support read-only and mutation-capable internal actions as separate capability scopes.
5. Requirement 5: Initial state must degrade gracefully if no LLM provider is configured (clear disabled state and guidance text).

## 8. Non-Functional Requirements
Capture quality and system constraints.

- Performance: Panel rendering and typing must remain responsive and must not noticeably impact tab interaction latency.
- Reliability: Prompt submission failures must surface deterministic error states without crashing the browser UI.
- Security: Internal browser manipulations must pass through explicit capability gates and audit-friendly command boundaries.
- Accessibility: Input and controls must be keyboard-navigable with visible focus states and accessible labels.
- Compatibility: Feature should work across supported Min desktop platforms without platform-specific UI regressions.

## 9. UX / UI Notes
Describe any interface expectations or user interaction details.

- User flow: User opens/expands prompt panel, writes prompt, submits, sees request/response timeline in panel context.
- Visual considerations: Keep Min minimalism; adopt familiar assistant composer affordances (rounded input, attachment/tool affordance placeholders, clear send CTA) without copying proprietary branding.
- Edge cases: Very long prompts, empty prompt submission, provider timeout, unavailable engine, narrow window widths.

## 10. Technical Notes
Capture implementation guidance, architecture, and dependencies.

- Proposed approach: Introduce panel shell UI in renderer; define engine bridge contract between renderer and main process; keep provider implementation injectable.
- Dependencies: Existing Min renderer/main IPC architecture; optional external LLM SDK(s) to be selected later.
- Risks / unknowns: Capability model complexity for safe internal actions; cross-process prompt streaming ergonomics; UI consistency across task/focus modes.
- Open questions: Which providers to support first; how to expose per-prompt permissions; where to persist conversation state and instruction presets.

## 11. Acceptance Criteria
Define how success will be measured.

- [ ] Criterion 1: A bottom prompt panel is visible in the main browser window and accepts multiline input.
- [ ] Criterion 2: Prompt submissions invoke a documented engine interface rather than direct ad-hoc calls.
- [ ] Criterion 3: Position model includes all four sides and can be switched via configuration flag, even if non-bottom placements are placeholders.

## 12. Testing / Verification
Describe how the feature will be validated.

- Manual test plan: Verify panel visibility, keyboard interaction, prompt submit behavior, error states without provider, and no regressions in tab/task UI.
- Automated test coverage: Add renderer unit tests for panel state transitions and main/renderer contract tests for engine request routing.
- Regression considerations: Ensure no breakage to existing keyboard shortcuts, task overlay rendering, and window layout calculations.

## 13. Rollout / Follow-up
Note any rollout considerations or future enhancements.

- Rollout plan: Ship behind a feature flag or hidden setting in early iterations for iterative validation.
- Follow-up work: Implement movable docking UI, response streaming, tool-call visualization, provider selection, and permission prompts for mutating actions.
