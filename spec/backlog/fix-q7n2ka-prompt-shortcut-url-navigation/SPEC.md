# Feature Specification

## 1. Feature Title
- **Feature name:** LLM Prompt Shortcut and URL Navigation
- **Created on:** 2026-08-18 20:27:24 +02:00
- **Owner:** Jozef Košík <jozef.kosik@gmail.com>

## 2. Summary
Align the LLM prompt keyboard shortcut with slash-based skill invocation and let the prompt retain address-bar behavior for URL input.

- **Problem statement:** The LLM prompt currently opens with `Ctrl+J`, which is inconsistent with the `/` prefix used to invoke skills. It also treats valid URLs entered without a slash command as LLM input instead of opening the address in a new tab.
- **Desired outcome:** Users can open the prompt with `Ctrl+/` (or `Cmd+/` on macOS), invoke slash commands with consistent muscle memory, and paste or type a valid URL into the prompt to open it in a new tab.

## 3. Background and Context
The LLM prompt is an interaction surface for browser commands and skill invocation. Users regularly type `/` to begin a command, and they expect browser-like URL handling when entering a web address.

- **Current behavior:** `Ctrl+J` / `Cmd+J` invokes the LLM prompt. Plain prompt input is processed as LLM input even when it can be parsed as a URL.
- **Motivation:** A `Ctrl+/` shortcut better reinforces the slash command model. Opening valid plain URLs maintains the familiar address-bar workflow for pasted web addresses.
- **Related issues or references:** [Feature-spec generator instructions](feature-spec-generator-skill.md); user-requested small fixes dated 2026-08-18.

## 4. Goals
- Goal 1: Invoke the LLM prompt with `Ctrl+/` on Windows and Linux, and `Cmd+/` on macOS.
- Goal 2: Open a new tab when plain LLM prompt input can be parsed as a URL.
- Goal 3: Preserve slash-command processing and existing LLM behavior for non-URL plain text.

## 5. Non-Goals
- Non-goal 1: Change the syntax, semantics, or available set of slash commands.
- Non-goal 2: Replace the browser's primary search or address-bar behavior.

## 6. User Stories
- As a browser user, I want to open the LLM prompt with `Ctrl+/` so that slash-based commands and the prompt shortcut share consistent muscle memory.
- As a browser user, I want a valid web address entered as plain prompt text to open in a new tab so that I can use the prompt like an address bar for pasted URLs.

## 7. Functional Requirements
1. The LLM prompt keyboard binding must use `Ctrl+/` on Windows and Linux, and its macOS equivalent `Cmd+/`; the prior `Ctrl+J` / `Cmd+J` binding must no longer invoke the prompt.
2. When submitted prompt text does not start with a slash command and can be parsed as a URL, Min must open that URL in a new tab rather than sending the text to the LLM command flow.
3. Prompt text that begins with a slash command must continue through existing command handling, and non-URL plain text must retain its existing LLM prompt behavior.

## 8. Non-Functional Requirements
- Performance: URL parsing and tab creation must not add a perceptible delay to prompt submission.
- Reliability: Invalid or incomplete URL-like text must not cause a navigation error or prevent the existing plain-text flow.
- Security: Navigation must use the existing URL validation and tab-opening safeguards.
- Accessibility: The new shortcut must remain reachable through existing keyboard interaction patterns.
- Compatibility: Behavior must work on supported Windows, Linux, and macOS builds.

## 9. UX / UI Notes
- User flow: The user presses the new shortcut, enters or pastes a web address without a slash prefix, submits it, and receives a new tab at that address.
- Visual considerations: Retain the current prompt presentation; no new controls or visual treatment are required.
- Edge cases: A string beginning with `/` is always treated as a command candidate, even if another parser might interpret it as a URL. Invalid URL-like strings fall back to current plain-text behavior.

## 10. Technical Notes
- Proposed approach: Update the LLM prompt keybinding registration and its user-facing shortcut references. In the prompt submission path, route non-command input through the repository's existing URL parser and tab-creation API before LLM dispatch.
- Dependencies: Existing keybinding infrastructure, URL parsing utility, and tab-management API.
- Risks / unknowns: Confirm the repository's URL parser accepts the intended set of pasted addresses and that the new shortcut does not conflict with a platform-reserved browser or renderer shortcut.
- Open questions: Should whitespace be trimmed before URL parsing, consistent with the primary address bar?

## 11. Acceptance Criteria
- [ ] Pressing `Ctrl+/` on Windows/Linux or `Cmd+/` on macOS opens the LLM prompt, while `Ctrl+J` / `Cmd+J` no longer does.
- [ ] Submitting a valid URL without a leading slash from the LLM prompt opens it in a new tab.
- [ ] Slash-prefixed commands and non-URL plain-text input retain their current behavior.

## 12. Testing / Verification
- Manual test plan: Verify both old and new shortcuts on each supported platform; submit fully qualified and supported shorthand URLs, slash commands, ordinary text, and malformed URL-like input from the prompt.
- Automated test coverage: Add or update focused keybinding and prompt-submission tests covering shortcut dispatch, URL navigation, slash commands, and plain-text fallback.
- Regression considerations: Confirm tab focus and task assignment follow the existing new-tab behavior, and verify no existing shortcut is unintentionally displaced.

## 13. Rollout / Follow-up
- Rollout plan: Ship as a small prompt interaction fix with the normal release process.
- Follow-up work: Consider documenting the updated shortcut wherever LLM prompt shortcuts are listed.