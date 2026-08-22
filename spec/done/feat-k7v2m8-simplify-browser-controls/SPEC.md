# Feature Specification

## 1. Feature Title
- **Feature name:** Simplify browser controls for prompt-first browsing
- **Created on:** 2026-08-16 10:53:17 +02:00
- **Owner:** Jozef Košík <jozef.kosik@radixal.net>

## 2. Summary
Remove conventional browser UI controls that do not align with Min's LLM-prompt-first workflow: the tab-click dropdown and the visible new-tab (`+`) control.

- **Problem statement:** The current tab UI exposes conventional navigation and tab-creation affordances that compete with the intended prompt-driven browser workflow.
- **Desired outcome:** The browser surface is less distracting and better focused on LLM-driven actions, without changing unrelated browsing behavior.

## 3. Background and Context
The attached reference image identifies two controls to remove: the expanded dropdown shown after clicking a tab, and the `+` button that opens the new-tab creation page. This fork's stated direction is a minimal browser whose workflow is driven by LLM prompts.

- **Current behavior:** Clicking a tab opens a dropdown with suggestions and tab actions. The `+` button is visible in the tab bar and opens a page for creating a new tab.
- **Motivation:** These conventional controls are superfluous for the intended prompt-first interaction model and add visual and interaction complexity.
- **Related issues or references:** [Annotated browser controls reference](browser-controls-to-remove.png).

## 4. Goals
- Goal 1: Remove the dropdown that appears when a tab is clicked.
- Goal 2: Remove the visible `+` button used to open the new-tab creation page.
- Goal 3: Preserve the minimal, prompt-first browser surface without unrelated UI changes.

## 5. Non-Goals
- Non-goal 1: Redesigning the remainder of the tab bar, address bar, or window controls.
- Non-goal 2: Defining a replacement UI or prompt command for creating tabs in this work item.

## 6. User Stories
- As a prompt-first browser user, I want tab selection not to open a conventional dropdown so that the browser remains focused on my active browsing context.
- As a prompt-first browser user, I want the visible new-tab button removed so that conventional tab creation does not compete with LLM-driven workflows.

## 7. Functional Requirements
1. Clicking or selecting a tab must not display the dropdown identified in the reference image.
2. The tab bar must not display the `+` button that opens the new-tab creation page.
3. Removing these controls must not introduce an alternative conventional UI control for the same actions.

## 8. Non-Functional Requirements
- Performance: Removing the controls must not add observable delay to tab selection or browser startup.
- Reliability: Tab selection must continue to activate the selected tab without errors.
- Security: This change must not broaden page, prompt, or renderer permissions.
- Accessibility: Removed controls must no longer be reachable through pointer or keyboard focus.
- Compatibility: The change must work on all platforms supported by the browser.

## 9. UX / UI Notes
- User flow: Selecting a tab activates it directly. The tab bar contains no visible `+` control for opening the new-tab creation page.
- Visual considerations: Remove the controls cleanly, without leaving unused spacing, focus outlines, or empty interactive regions.
- Edge cases: Verify behavior with a single tab, multiple tabs, restored sessions, and focus-mode/tab-bar variants.

## 10. Technical Notes
- Proposed approach: Identify the event handlers and rendering paths that create the tab-click dropdown and the visible new-tab button, then remove or disable those paths while retaining normal tab activation.
- Dependencies: No new dependencies are expected.
- Risks / unknowns: Existing keyboard shortcuts, menu items, and internal APIs may create tabs or expose related state. Their intended future role in the prompt-first workflow is not defined by this specification.
- Open questions: Should prompt commands replace any affected tab-creation workflows in a separate feature?

## 11. Acceptance Criteria
- [ ] Clicking or selecting a tab no longer opens the dropdown shown in the reference image.
- [ ] The `+` control is absent from the tab bar and cannot open the new-tab creation page.
- [ ] Normal tab activation remains functional.
- [ ] No empty visual gap or focusable removed control remains in the tab bar.

## 12. Testing / Verification
- Manual test plan: Launch the browser; select tabs in a multi-tab session; confirm no dropdown appears; inspect the tab bar for the missing `+` control; verify normal tab activation in a restored session and focus-mode variant if available.
- Automated test coverage: Add or update focused UI tests for tab selection and the absence of the new-tab control where the existing test framework supports them.
- Regression considerations: Check keyboard navigation and existing non-UI tab creation paths for unintended regressions without expanding their scope.

## 13. Rollout / Follow-up
- Rollout plan: Ship as part of the prompt-first browser UI simplification after targeted UI verification.
- Follow-up work: Specify prompt-based tab creation or navigation workflows separately, if needed.
