# Min MAUI Port

This folder contains the first Windows-focused Microsoft MAUI port of Min. The MAUI app is intentionally a thin desktop shell over native `WebView` controls, with browser state, prompt routing, tool execution, and automation hooks implemented as typed C# services.

## Current Scope

- Windows target: `net9.0-windows10.0.19041.0`.
- XAML shell with fixed-width tab chrome, a breadcrumb row, a centered prompt overlay, and a one-line status bar.
- Prompt routing for URLs, default web search, slash skills, `/ai` handoff, `/debug`, and `//` or `/b` browser instructions.
- Typed tool registry for tab, navigation, search, and page-summary actions.
- Session restore through a JSON file in local app data.
- Remote automation entry point for end-to-end tests through `BrowserAutomationEndpoint`; the named-pipe server starts when `MIN_MAUI_AUTOMATION_PIPE` is set.

## Commands

```powershell
dotnet build maui/Min.Maui.slnx
dotnet test maui/Min.Maui.slnx
dotnet build maui/src/Min.Maui/Min.Maui.csproj -f net9.0-windows10.0.19041.0
```

The first iteration keeps the original Electron application intact while establishing the MAUI solution side-by-side for incremental feature parity work.