using System.Text.Json;
using Min.Maui.Models;

namespace Min.Maui.Services;

public sealed record ToolDefinition(string Id, string Description, IReadOnlyDictionary<string, string> Parameters);
public sealed record ToolResult(bool Succeeded, string Message, object? Data = null);
public sealed record ToolExecutionContext(string? SelectedTabId, string? SelectedUrl);

public sealed class BrowserToolRegistry
{
    private readonly BrowserSessionService session;
    private readonly SearchEngineRegistry searchEngines;
    private readonly Dictionary<string, Func<JsonElement, ToolExecutionContext, Task<ToolResult>>> handlers = new(StringComparer.OrdinalIgnoreCase);

    public BrowserToolRegistry(BrowserSessionService session, SearchEngineRegistry searchEngines)
    {
        this.session = session;
        this.searchEngines = searchEngines;
        RegisterBuiltIns();
    }

    public IReadOnlyList<ToolDefinition> GetCatalog() =>
    [
        new("tabs.list", "List open browser tabs.", new Dictionary<string, string>()),
        new("tabs.open", "Open a URL in a tab.", new Dictionary<string, string> { ["url"] = "Absolute or host-like URL", ["background"] = "Optional boolean" }),
        new("tabs.close", "Close a tab. Placeholder or wildcard ids close the selected tab.", new Dictionary<string, string> { ["tabId"] = "Optional tab id" }),
        new("tabs.select", "Select an existing tab.", new Dictionary<string, string> { ["tabId"] = "Tab id" }),
        new("navigation.go", "Navigate the selected tab to a URL.", new Dictionary<string, string> { ["url"] = "Absolute or host-like URL" }),
        new("search.web", "Search the web with the selected search engine.", new Dictionary<string, string> { ["query"] = "Search query" }),
        new("page.summarize", "Return a short placeholder summary for the selected page.", new Dictionary<string, string>())
    ];

    public Task<ToolResult> ExecuteAsync(string id, JsonElement args, ToolExecutionContext context)
    {
        return handlers.TryGetValue(id, out var handler)
            ? handler(args, context)
            : Task.FromResult(new ToolResult(false, $"Unknown tool: {id}"));
    }

    private void RegisterBuiltIns()
    {
        handlers["tabs.list"] = (args, context) => Task.FromResult(new ToolResult(true, $"{session.Tabs.Count} tab(s) open", session.Tabs.Select(tab => new { tab.Id, tab.Title, tab.Url, tab.IsSelected }).ToArray()));
        handlers["tabs.open"] = (args, context) =>
        {
            var url = ReadString(args, "url");
            if (!UrlInputParser.TryParseNavigationUrl(url ?? string.Empty, out var parsedUrl))
            {
                return Task.FromResult(new ToolResult(false, "tabs.open requires a valid URL."));
            }

            var tab = session.OpenTab(parsedUrl, ReadBool(args, "background") ?? false);
            return Task.FromResult(new ToolResult(true, $"Opened {tab.DisplayUrl}", tab.Id));
        };
        handlers["tabs.close"] = (args, context) =>
        {
            session.CloseTab(ReadString(args, "tabId"));
            return Task.FromResult(new ToolResult(true, "Closed tab"));
        };
        handlers["tabs.select"] = (args, context) =>
        {
            var tabId = ReadString(args, "tabId");
            if (string.IsNullOrWhiteSpace(tabId))
            {
                return Task.FromResult(new ToolResult(false, "tabs.select requires tabId."));
            }

            session.SelectTab(tabId);
            return Task.FromResult(new ToolResult(true, "Selected tab"));
        };
        handlers["navigation.go"] = (args, context) =>
        {
            var url = ReadString(args, "url");
            if (!UrlInputParser.TryParseNavigationUrl(url ?? string.Empty, out var parsedUrl))
            {
                return Task.FromResult(new ToolResult(false, "navigation.go requires a valid URL."));
            }

            session.NavigateSelected(parsedUrl);
            return Task.FromResult(new ToolResult(true, $"Navigated to {BrowserTitle.DisplayUrl(parsedUrl)}"));
        };
        handlers["search.web"] = (args, context) =>
        {
            var query = ReadString(args, "query");
            if (string.IsNullOrWhiteSpace(query))
            {
                return Task.FromResult(new ToolResult(false, "search.web requires query."));
            }

            var tab = session.OpenTab(searchEngines.Default.BuildSearchUrl(query));
            return Task.FromResult(new ToolResult(true, $"Searching for {query}", tab.Id));
        };
        handlers["page.summarize"] = (args, context) => Task.FromResult(new ToolResult(true, "Page summarization will use the selected WebView content provider in a later iteration."));
    }

    private static string? ReadString(JsonElement args, string propertyName) => args.ValueKind == JsonValueKind.Object && args.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    private static bool? ReadBool(JsonElement args, string propertyName) => args.ValueKind == JsonValueKind.Object && args.TryGetProperty(propertyName, out var value) && value.ValueKind is JsonValueKind.True or JsonValueKind.False ? value.GetBoolean() : null;
}