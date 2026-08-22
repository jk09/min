# Feature Specification

## 1. Feature Title
- **Feature name:** Keep the insecure-page indicator visible in tabs
- **Created on:** 2026-08-16 14:07:00
- **Owner:** Jozef Košík <jozef.kosik@radixal.net>

## 2. Summary
Ensure an insecure-page indicator displayed in a browser tab remains visible whether or not the tab is hovered.

- **Problem statement:** The indicator can become invisible when its tab is hovered because the close button occupies the same location. This hides security-relevant information from the user.
- **Desired outcome:** An insecure-page indicator is continuously visible whenever it applies to a tab and is never obscured or replaced by the close button.

## 3. Background and Context
The tab bar communicates page state in a constrained space. Security indicators need a persistent, unambiguous presentation, including while users interact with a tab.

- **Current behavior:** On an insecure page, the tab-level indicator is shown in its normal state but becomes invisible on hover when the close button is displayed in the same area.
- **Motivation:** Users must be able to identify insecure pages at all times; hover behavior must not suppress this security signal.
- **Related issues or references:** [Insecure tab indicator reference](insecure-tab-indicator-reference.png) shows the affected indicator circled in red.

## 4. Goals
- Goal 1: Keep the insecure-page indicator visible on every tab state in which it is present.
- Goal 2: Prevent the close button from covering, replacing, or otherwise obscuring the indicator.
- Goal 3: Preserve a clear and usable way to close affected tabs.

## 5. Non-Goals
- Non-goal 1: Redesigning other tab status indicators or the complete tab-bar layout.
- Non-goal 2: Changing how Min determines whether a page is secure or insecure.

## 6. User Stories
- As a browser user, I want an insecure-page indicator to remain visible when I hover a tab so that I can recognize the page's security state before selecting it.
- As a browser user, I want to retain access to the tab close control without it hiding security information.

## 7. Functional Requirements
1. When a tab has an insecure-page indicator, the indicator must remain rendered and visible both before and during hover.
2. The close button must not overlap, replace, or visually obscure an insecure-page indicator.
3. The resulting layout must preserve an accessible, operable tab close action for tabs that show the indicator.

## 8. Non-Functional Requirements
- Performance: Hovering a tab must not introduce perceptible visual lag or layout instability.
- Reliability: The indicator visibility must be consistent across tab state transitions, including hover and selection.
- Security: Security-relevant page state must not be hidden by ordinary tab interactions.
- Accessibility: Any adjusted control placement must preserve its existing accessible name, focus behavior, and usable hit target.
- Compatibility: The behavior must work within Min's supported desktop platforms and themes.

## 9. UX / UI Notes
- User flow: A user views an insecure tab, hovers it, and can still see its security indicator while also being able to close the tab.
- Visual considerations: Give the indicator a dedicated, non-overlapping position within the tab. Keep the visual language of the existing tab bar; do not introduce a broader redesign.
- Edge cases: Check inactive, active, and hovered insecure tabs, including constrained tab widths where labels are truncated.

## 10. Technical Notes
- Proposed approach: Update the tab-bar rendering and/or styling that currently exchanges the security indicator for the close control on hover, giving both elements non-conflicting layout rules.
- Dependencies: Existing tab state, tab rendering, and tab-bar stylesheet behavior.
- Risks / unknowns: Available horizontal space may vary with tab width, title length, active state, and platform-specific controls.
- Open questions: Confirm whether another persistent location within the existing tab visual hierarchy better accommodates both controls at minimum tab widths.

## 11. Acceptance Criteria
- [ ] An insecure-page tab displays its indicator when not hovered.
- [ ] The same indicator remains clearly visible while the tab is hovered.
- [ ] Hovering does not allow the close button to overlap or replace the indicator.
- [ ] The close action remains visible or otherwise readily operable without hiding the security indicator.
- [ ] Active, inactive, and narrow insecure tabs have no clipped or overlapping tab controls.

## 12. Testing / Verification
- Manual test plan: Open an insecure page, inspect the tab in inactive and active states, hover it, and confirm the indicator remains visible and the close action works. Repeat with a narrow tab and each supported theme.
- Automated test coverage: Add or update focused tab-bar UI coverage for simultaneous visibility of the insecure indicator and close control, where the existing test tooling supports it.
- Regression considerations: Verify that tabs without the indicator retain their current hover and close-button behavior.

## 13. Rollout / Follow-up
- Rollout plan: Deliver with the next normal browser UI release after focused tab-bar regression verification.
- Follow-up work: Review other security- or permission-related tab indicators for the same hover-overlap pattern.
