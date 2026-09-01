using System.Text.Json;

namespace Min.Maui.Services;

public sealed record PromptRouteResult(bool Succeeded, string Message, bool CloseOverlay, IReadOnlyList<string> Trace)
{
    public static PromptRouteResult Handled(string message, IReadOnlyList<string>? trace = null, bool closeOverlay = false) => new(true, message, closeOverlay, trace ?? Array.Empty<string>());
    public static PromptRouteResult Error(string message, IReadOnlyList<string>? trace = null) => new(false, message, false, trace ?? Array.Empty<string>());
}

public sealed class PromptRouterService
{
    private readonly BrowserSessionService session;
    private readonly SearchEngineRegistry searchEngines;
    private readonly AgentRegistry agents;
    private readonly BrowserToolRegistry tools;
    private readonly PlanningService planning;

    public PromptRouterService(BrowserSessionService session, SearchEngineRegistry searchEngines, AgentRegistry agents, BrowserToolRegistry tools, PlanningService planning)
    {
        this.session = session;
        this.searchEngines = searchEngines;
        this.agents = agents;
        this.tools = tools;
        this.planning = planning;
    }

    public async Task<PromptRouteResult> RouteAsync(string input, SearchEngineDefinition? selectedSearchEngine = null, AgentDefinition? selectedAgent = null, bool debug = false, CancellationToken cancellationToken = default)
    {
        var value = input.Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            return PromptRouteResult.Error("Type a URL, search, /skill, or // browser instruction.");
        }

        var context = new ToolExecutionContext(session.SelectedTab?.Id, session.SelectedTab?.Url);
        if (value.StartsWith("//", StringComparison.Ordinal))
        {
            return await RouteLlmAsync(value[2..].Trim(), cancellationToken).ConfigureAwait(false);
        }

        if (value.StartsWith("/b ", StringComparison.OrdinalIgnoreCase))
        {
            return await RouteLlmAsync(value[3..].Trim(), cancellationToken).ConfigureAwait(false);
        }

        if (value.StartsWith('/'))
        {
            return await RouteSkillAsync(value[1..], selectedAgent ?? agents.Default, context).ConfigureAwait(false);
        }

        if (UrlInputParser.TryParseNavigationUrl(value, out var url))
        {
            var tab = session.OpenTab(url);
            return PromptRouteResult.Handled($"Opened {tab.DisplayUrl}", closeOverlay: true);
        }

        var engine = selectedSearchEngine is { IsEnabled: true } ? selectedSearchEngine : searchEngines.Default;
        session.OpenTab(engine.BuildSearchUrl(value));
        return PromptRouteResult.Handled($"Searching {engine.Label} for {value}", closeOverlay: true);
    }

    public Task<PromptRouteResult> RouteBrowseAsync(string input, SearchEngineDefinition? selectedSearchEngine = null, CancellationToken cancellationToken = default)
    {
        var value = input.Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            return Task.FromResult(PromptRouteResult.Error("Type a URL or search."));
        }

        if (UrlInputParser.TryParseNavigationUrl(value, out var url))
        {
            var tab = session.OpenTab(url);
            return Task.FromResult(PromptRouteResult.Handled($"Opened {tab.DisplayUrl}", closeOverlay: true));
        }

        var engine = selectedSearchEngine is { IsEnabled: true } ? selectedSearchEngine : searchEngines.Default;
        session.OpenTab(engine.BuildSearchUrl(value));
        return Task.FromResult(PromptRouteResult.Handled($"Searching {engine.Label} for {value}", closeOverlay: true));
    }

    public Task<PromptRouteResult> RouteLlmAsync(string input, CancellationToken cancellationToken = default)
    {
        var value = input.Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            return Task.FromResult(PromptRouteResult.Error("Type an instruction for the model."));
        }

        return planning.RunAsync(value, new ToolExecutionContext(session.SelectedTab?.Id, session.SelectedTab?.Url), cancellationToken);
    }

    private async Task<PromptRouteResult> RouteSkillAsync(string skillText, AgentDefinition selectedAgent, ToolExecutionContext context)
    {
        var split = skillText.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var skill = split.ElementAtOrDefault(0) ?? string.Empty;
        var argsText = split.ElementAtOrDefault(1) ?? string.Empty;

        return skill.ToLowerInvariant() switch
        {
            "search" => await ExecuteToolAsync("search.web", new { query = argsText }, context).ConfigureAwait(false),
            "tabs" => await ExecuteToolAsync("tabs.list", new { }, context).ConfigureAwait(false),
            "ai" => OpenAgentHandoff(argsText, selectedAgent),
            "debug" => OpenDebugTab(),
            _ => PromptRouteResult.Error($"Unknown skill: /{skill}")
        };
    }

    private async Task<PromptRouteResult> ExecuteToolAsync(string toolId, object args, ToolExecutionContext context)
    {
        var result = await tools.ExecuteAsync(toolId, JsonSerializer.SerializeToElement(args), context).ConfigureAwait(false);
        return result.Succeeded ? PromptRouteResult.Handled(result.Message, closeOverlay: true) : PromptRouteResult.Error(result.Message);
    }

    private PromptRouteResult OpenAgentHandoff(string prompt, AgentDefinition selectedAgent)
    {
        if (string.IsNullOrWhiteSpace(prompt))
        {
            return PromptRouteResult.Error("/ai requires a prompt.");
        }

        var agent = selectedAgent.IsEnabled ? selectedAgent : agents.Default;
        var tab = session.OpenTab(agent.BuildHandoffUrl(prompt, session.SelectedTab?.Url));
        return PromptRouteResult.Handled($"Opened {agent.Label} handoff in {tab.DisplayUrl}", closeOverlay: true);
    }

    private PromptRouteResult OpenDebugTab()
    {
        session.OpenTab("min://llm-prompt-debug");
        return PromptRouteResult.Handled("Opened prompt debug tab", closeOverlay: true);
    }
}