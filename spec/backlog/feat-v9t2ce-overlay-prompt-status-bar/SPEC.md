# Feature Specification

## 1. Feature Title
- **Feature name:** On-demand centered LLM prompt overlay with persistent thin status bar
- **Created on:** 2026-08-16 09:19
- **Owner:** Jozef Košík <jozef.kosik@radixal.net>

## 2. Summary
Replace the always-visible LLM prompt bar docked at the edge of the window with an on-demand, centered overlay above the web viewer, and keep only a single-line status bar at the bottom of the window.

- **Problem statement:** The LLM prompt panel is permanently docked (default `bottom`, see [index.html](index.html#L118-L133) and [js/llmPrompt/promptPanel.js](js/llmPrompt/promptPanel.js#L44-L90)). It permanently consumes webview estate via `syncWebviewMargins`, is visually present even when the user only wants to browse, and its cramped single-line form leaves no room for controls such as model selection or prompt settings.
- **Desired outcome:** The prompt is summoned on demand and appears as a large, centered composer card floating over a dimmed web page — visually similar to the VS Code Copilot chat composer. When dismissed, the only remaining chrome is a 1-line status bar below the web viewer that continues to show the build commit indicator.

## 3. Background and Context

- **Current behavior:**
  - `#llm-prompt-panel` is a docked `section` with `data-position` of `bottom`/`top`/`left`/`right`; `getTargetMargins`/`syncWebviewMargins` shrink the webview area to make room for it.
  - The status row `#llm-prompt-status` lives *inside* the prompt panel and hosts `#llm-prompt-engine-state`, `#llm-prompt-result`, and `#llm-prompt-build-info`.
  - The panel is hidden only when no page webview is active (new-tab / address selection UI mode).
- **Motivation:** Maximize the web viewer estate and remove a constant distraction, while giving the prompt enough room to grow (multi-line input, model picker, settings affordances). This is aligned with the fork's goal of an LLM-driven, minimalistic browser (see [AGENTS.md](AGENTS.md)).
- **Related issues or references:**
  - [spec/done/feat-h3k9mz-minimal-llm-prompt/SPEC.md](spec/done/feat-h3k9mz-minimal-llm-prompt/SPEC.md) — removal of the accumulating history log; this spec continues that direction.
  - [spec/done/feat-b7x4qn-build-commit-indicator/SPEC.md](spec/done/feat-b7x4qn-build-commit-indicator/SPEC.md) — the commit indicator that must survive this change and move into the new status bar.
  - [spec/done/feat-a7k3p9-llm-prompt-panel/SPEC.md](spec/done/feat-a7k3p9-llm-prompt-panel/SPEC.md) — original prompt panel design.
  - Visual reference supplied with the request: [vscode-copilot-composer-reference.png](spec/backlog/feat-v9t2ce-overlay-prompt-status-bar/vscode-copilot-composer-reference.png) — the VS Code Copilot chat composer: a centered rounded card containing a large placeholder input ("What will you create?"), a toolbar row with mode/model pickers on the left and submit/mic actions on the right, and a thin meta row beneath.

## 4. Goals
- Goal 1: Make the LLM prompt an on-demand overlay centered in the web viewer estate, dimming the underlying page while it is open.
- Goal 2: Reclaim the webview estate: the docked panel no longer reserves layout space; only a 1-line status bar remains below the web viewer.
- Goal 3: Preserve the build commit indicator and engine/result status reporting in the new status bar.
- Goal 4: Give the composer enough room to host future adornments (model selector, settings, mode toggles) without redesigning it again.

## 5. Non-Goals
- Non-goal 1: Implementing the actual model-selection or settings behavior; this spec only reserves and renders the toolbar affordances.
- Non-goal 2: Reintroducing a multi-turn chat transcript or persistent prompt history view.
- Non-goal 3: Changing routing/engine logic in [js/llmPrompt/promptRouter.js](js/llmPrompt/promptRouter.js) or [js/llmPrompt/engineClient.js](js/llmPrompt/engineClient.js).
- Non-goal 4: Keeping the legacy `top`/`left`/`right` docked placements as user-selectable options.

## 6. User Stories
- As a browser user, I want the prompt hidden by default so that the web page uses the full viewer estate and does not distract me.
- As a browser user, I want to summon the prompt with a keyboard shortcut and have it appear centered over a dimmed page so that my attention is on the prompt while I compose it.
- As a browser user, I want to dismiss the prompt with `Esc` or by clicking outside it so that I can return to browsing immediately.
- As a developer of this fork, I want the build commit hash to remain visible at all times in the bottom status bar so that I can confirm which revision is running without opening the prompt.

## 7. Functional Requirements
1. The LLM prompt is hidden by default and does not occupy any layout space when closed.
2. The prompt can be opened by a keyboard shortcut (default suggestion: the existing LLM prompt focus shortcut) and by activating an affordance in the status bar.
3. When open, the prompt renders as a centered card horizontally and vertically positioned within the web viewer estate (excluding tab bar and status bar), constrained to a maximum width (e.g. `min(720px, 80vw)`).
4. When open, a semi-transparent scrim covers the web viewer estate, visually dimming the page beneath the prompt. The scrim does not cover the tab bar or the status bar.
5. Clicking the scrim, pressing `Esc`, or successfully submitting a prompt closes the overlay and returns focus to the previously focused element (typically the webview).
6. The composer supports multi-line input that auto-grows up to a bounded height, then scrolls.
7. The composer includes a toolbar row with placeholder controls for mode, model selection, and settings (left-aligned) and the submit action (right-aligned). Non-implemented controls are rendered disabled or as inert placeholders, never as broken actions.
8. A persistent, single-line status bar is rendered at the bottom of the window, below the web viewer estate, and is always visible regardless of the prompt's open state.
9. The status bar contains `#llm-prompt-engine-state`, `#llm-prompt-result`, and `#llm-prompt-build-info`, preserving the behavior specified in the build commit indicator spec (short hash, dirty marker, tooltip, excluded from `aria-live` announcements).
10. Webview margin computation reserves space for the status bar height only; the overlay never contributes to webview margins.
11. The `/` skill-listing behavior and the browsing-history URL suggestion dropdown continue to work inside the overlay composer.
12. Prompt result/status messages update the status bar even after the overlay is dismissed, so the user can see outcomes while browsing.
13. When no page webview is active (new-tab / address selection UI mode), the overlay is not shown; the status bar remains visible.

## 8. Non-Functional Requirements
- Performance: Opening and closing the overlay must not trigger webview relayout; the scrim and card use compositor-friendly properties (`opacity`, `transform`).
- Reliability: Overlay state must be recoverable — no state where the scrim remains without a focusable composer, or where the composer is open but unreachable by keyboard.
- Security: No change to data handling; prompt content is not persisted by this feature.
- Accessibility: The overlay is a modal dialog (`role="dialog"`, `aria-modal="true"`) with a labelled composer, focus trapped while open and restored on close. The status bar remains a polite live region for status/result, excluding the build indicator.
- Compatibility: Works on Windows, macOS, and Linux, in light and dark themes, and at narrow window widths (card falls back to near-full width with margins).

## 9. UX / UI Notes
- User flow:
  1. User browses; only the tab bar, page, and 1-line status bar are visible.
  2. User presses the prompt shortcut (or clicks the status bar affordance).
  3. The page dims and a centered composer card fades in with the input focused.
  4. User types and submits, or presses `Esc` to cancel.
  5. Overlay fades out; the status bar shows engine state and the latest result.
- Visual considerations:
  - Card: rounded corners, elevated shadow, theme background, subtle border — modeled on the VS Code Copilot chat composer in [vscode-copilot-composer-reference.png](spec/backlog/feat-v9t2ce-overlay-prompt-status-bar/vscode-copilot-composer-reference.png).
  - Toolbar row mirrors the reference: leading inline controls (add-context, mode, model) and trailing submit action; a thin meta row below the card is optional.
  - Placeholder text similar in spirit to the current `Ask, or type / for skills`.
  - Scrim: theme-aware, low-opacity black/white overlay; must dim, not obscure.
  - Status bar: `light-fade` muted text, fixed 1-line height, no wrapping, `#llm-prompt-result` truncating with ellipsis and `#llm-prompt-build-info` pinned to the trailing edge with `flex: none`.
- Edge cases:
  - Very short window heights: the card must remain fully visible; reduce internal padding rather than clipping.
  - Long result text must not grow the status bar beyond one line.
  - Opening the overlay while the history suggestion dropdown is open must not leave the dropdown orphaned.
  - Full-screen / focus-mode interaction with the status bar must be defined (see open questions).

## 10. Technical Notes
- Proposed approach:
  1. Split the markup in [index.html](index.html#L118-L133): move `#llm-prompt-status` out of `#llm-prompt-panel` into a new top-level `#status-bar` element rendered after the webview container; wrap the composer in a new overlay container with a scrim child.
  2. Rework [js/llmPrompt/promptPanel.js](js/llmPrompt/promptPanel.js) to expose `open()`/`close()`/`toggle()` overlay state instead of `applyPosition`; retire `ALLOWED_POSITIONS`, `getConfiguredPosition`, and the `llmPromptPanelPosition` setting (with migration/ignore of stale values).
  3. Reduce `getTargetMargins`/`syncWebviewMargins` to a single bottom margin equal to the status bar height.
  4. Rewrite the panel styles in [css/llmPrompt.css](css/llmPrompt.css) into overlay + card + toolbar + status bar rules; keep the existing status element selectors so the build indicator module continues to work unchanged.
  5. Bind the open/close shortcut in [js/defaultKeybindings.js](js/defaultKeybindings.js) / [js/keybindings.js](js/keybindings.js) alongside existing prompt focus handling.
- Dependencies: None new; pure renderer markup/CSS/JS change.
- Risks / unknowns:
  - Focus management between the overlay and the `webview` element (blur/restore) is historically fragile in Electron.
  - Interaction with `focusMode` and `modalMode` ([js/focusMode.js](js/focusMode.js), [js/modalMode.js](js/modalMode.js)) — the overlay may need to reuse the existing modal mode infrastructure rather than inventing a second one.
  - Removing the `llmPromptPanelPosition` setting is a breaking change for existing user profiles.
- Open questions:
  - Should the status bar be hidden in focus mode / full-screen, or always visible?
  - Should the overlay stay open after submission to display streamed results, instead of always closing?
  - Should the status bar be clickable in its entirety to open the prompt, or only a dedicated affordance?

## 11. Acceptance Criteria
- [ ] With the prompt closed, no prompt chrome is visible and the web viewer occupies all space except the tab bar and the 1-line status bar.
- [ ] The prompt shortcut opens a centered composer card over a dimmed page, with the input focused.
- [ ] `Esc`, clicking the scrim, and submitting all close the overlay and restore focus.
- [ ] The bottom status bar is always visible and shows the build commit indicator with its tooltip, matching the prior build-indicator spec.
- [ ] Engine state and the latest prompt result render in the status bar, on one line, truncated with ellipsis when long.
- [ ] Webview margins account only for the status bar; opening/closing the overlay does not resize the page.
- [ ] Skill listing (`/`) and history URL suggestions work inside the overlay composer.

## 12. Testing / Verification
- Manual test plan:
  1. Launch the browser, confirm no prompt is visible and the status bar shows `#<hash>`.
  2. Press the prompt shortcut; verify centering, dimming, focus, and card sizing at wide and narrow window widths.
  3. Type `/` and confirm skill listing; type a URL fragment and confirm history suggestions.
  4. Submit a prompt; confirm the overlay closes and the result appears in the status bar.
  5. Press `Esc` and click the scrim in separate runs; confirm both close and restore focus to the page.
  6. Tab through the open overlay to verify focus trapping; verify screen reader announces the dialog and status updates.
  7. Repeat in light and dark themes and in the new-tab UI mode.
- Automated test coverage: Extend the existing renderer tests under [test/](test/) to cover overlay open/close state transitions and `getTargetMargins` returning only a bottom margin.
- Regression considerations: Prompt routing/engine behavior, build indicator rendering, webview margin sync, focus mode, and users with a stale `llmPromptPanelPosition` setting.

## 13. Rollout / Follow-up
- Rollout plan: Single change on a feature branch; no feature flag. Stale `llmPromptPanelPosition` values are ignored on load.
- Follow-up work:
  - Implement real model-selection and settings controls in the composer toolbar.
  - Consider an in-overlay streaming result view for long-running prompts.
  - Consider additional status bar slots (page security, download progress) now that a status bar exists.
