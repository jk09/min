using System.Text.Json;
using Min.Maui.Services;

namespace Min.Maui.Automation;

public sealed record AutomationResponse(bool Succeeded, string Message, object? Data = null);

public sealed class BrowserAutomationEndpoint
{
    private readonly BrowserSessionService session;
    private readonly PromptRouterService router;
    private readonly SearchEngineRegistry searchEngines;
    private readonly AgentRegistry agents;

    public BrowserAutomationEndpoint(BrowserSessionService session, PromptRouterService router, SearchEngineRegistry searchEngines, AgentRegistry agents)
    {
        this.session = session;
        this.router = router;
        this.searchEngines = searchEngines;
        this.agents = agents;
    }

    public async Task<AutomationResponse> DispatchAsync(string command, JsonElement args, CancellationToken cancellationToken = default)
    {
        switch (command)
        {
            case "tabs.list":
                return new AutomationResponse(true, "Tabs listed", session.Tabs.Select(tab => new { tab.Id, tab.Title, tab.Url, tab.IsSelected }).ToArray());
            case "tabs.open":
                var url = ReadString(args, "url");
                if (!UrlInputParser.TryParseNavigationUrl(url ?? string.Empty, out var parsedUrl))
                {
                    return new AutomationResponse(false, "tabs.open requires url.");
                }

                var tab = session.OpenTab(parsedUrl);
                return new AutomationResponse(true, "Tab opened", new { tab.Id, tab.Url });
            case "prompt.submit":
                var input = ReadString(args, "input");
                var result = await router.RouteAsync(input ?? string.Empty, searchEngines.Default, agents.Default, cancellationToken: cancellationToken).ConfigureAwait(false);
                return new AutomationResponse(result.Succeeded, result.Message, new { result.CloseOverlay, result.Trace });
            default:
                return new AutomationResponse(false, $"Unknown automation command: {command}");
        }
    }

    private static string? ReadString(JsonElement args, string propertyName) => args.ValueKind == JsonValueKind.Object && args.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}