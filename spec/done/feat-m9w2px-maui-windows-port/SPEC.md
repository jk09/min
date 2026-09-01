# Feature Specification

## 1. Feature Title
- **Feature name:** Windows-first Microsoft MAUI browser port
- **Created on:** 2026-09-01
- **Owner:** Jozef Kosik <jozef.kosik@radixal.net>

## 2. Summary
Create a side-by-side Microsoft MAUI solution that begins migrating Min from Electron to a typed .NET desktop shell for Windows.

The first iteration keeps the existing Electron application intact and adds a root-level `maui` solution. The MAUI app uses XAML for the shell chrome and prompt overlay, while C# services own tab state, prompt routing, tool execution, session restore, Ollama-backed planning, and remote automation hooks.

## 3. Background and Context
This port reconstructs the behavior represented by the completed feature specs in `spec/done`, in their creation order, with the current active feature ledger as the source of truth. The primary behaviors carried into the first MAUI slice are prompt-first browsing, fixed-width informational tabs, an on-demand centered prompt overlay, URL/search/prompt routing, AI handoff, browser-command tool execution, navigation breadcrumbs, empty-state prompt access, and startup session restore.

## 4. Goals
- Add a new root-level MAUI solution without removing or rewriting the Electron application.
- Concentrate on a Windows desktop target using MAUI's native `WebView` host.
- Separate XAML UI from business logic through MVVM services and view models.
- Keep prompt routing and tool execution type-safe and unit-testable.
- Provide a remote automation entry point suitable for end-to-end tests.

## 5. Non-Goals
- Full cross-platform MAUI support beyond Windows.
- Complete parity for content blocking, password management, downloads, translations, reader view, or native menus.
- Shipping a bundled LLM provider or storing provider credentials.

## 6. Functional Requirements
1. The MAUI solution lives under a new repository-root folder.
2. The shell displays multiple tab records and maintains one native `WebView` per tab, showing the selected tab.
3. The tab strip uses fixed-width informational tabs and an overflow summary instead of Tasks UI or a visible new-tab button.
4. The prompt is available on demand as a centered overlay above the web surface and has a persistent status bar affordance.
5. Prompt input offers an explicit Search/Agent mode selector: Search mode routes host-like strings to direct URL navigation and ordinary text to the default search engine; Agent mode routes the input to the model planning pipeline.
6. The LLM planning pipeline exposes a typed browser tool catalog and executes validated tool calls.
7. The prompt can be dismissed with `Esc`, the close button, or by clicking outside the composer.
8. LLM mode supports starter commands for opening settings, summarizing the current page metadata, and summarizing today's MAUI session history.
9. The Send button gives immediate visual feedback when activated.
10. Pressing `Enter` submits the prompt, while `Ctrl+Enter` inserts a newline.
11. Debug mode is only available in Agent mode, and opens the LLM debug tab when an Agent prompt is submitted.
12. The shell supports AI agent handoff through `/ai`.
13. The shell persists and restores tab URLs and active tab state.
14. The shell exposes an automation endpoint and named-pipe server for remote end-to-end manipulation.

## 7. Acceptance Criteria
- [x] `dotnet test maui/Min.Maui.slnx` builds the MAUI app and runs routing/automation tests.
- [x] URL prompt input opens a direct tab.
- [x] Plain prompt input opens a default Bing search tab.
- [x] `//` planning input can execute a browser tool call.
- [x] LLM mode can execute starter internal tools such as opening settings, summarizing the current page, and summarizing today's session history.
- [x] Agent-mode debug submissions open the internal prompt debug page.
- [x] The automation endpoint can submit a prompt through the same route as a remote end-to-end driver.

## 8. Testing / Verification
- Unit coverage: `maui/test/Min.Maui.Tests/PromptRouterTests.cs` covers URL routing, search routing, planned tool calls, and the automation dispatch surface.
- Manual verification: run the MAUI app on Windows and exercise the XAML shell, prompt overlay, tab switching, and WebView navigation.

## 9. Follow-up
- Expand the Ollama-backed planner with richer page-content extraction and provider settings UI.
- Expand remote automation into a full UI-level Windows test harness.
- Port remaining Electron browser services incrementally behind typed interfaces.