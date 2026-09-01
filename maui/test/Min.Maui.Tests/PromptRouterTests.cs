using System.Text.Json;
using Min.Maui.Automation;
using Min.Maui.Services;
using Min.Maui.ViewModels;

namespace Min.Maui.Tests;

public sealed class PromptRouterTests
{
    [Fact]
    public async Task PlainUrlOpensTabDirectly()
    {
        var services = TestServices.Create();

        var result = await services.Router.RouteAsync("example.com", services.SearchEngines.Default, services.Agents.Default);

        Assert.True(result.Succeeded);
        Assert.True(result.CloseOverlay);
        Assert.Equal("https://example.com/", services.Session.SelectedTab?.Url);
    }

    [Fact]
    public async Task PlainTextSearchesDefaultEngine()
    {
        var services = TestServices.Create();

        var result = await services.Router.RouteAsync("daily news", services.SearchEngines.Default, services.Agents.Default);

        Assert.True(result.Succeeded);
        Assert.Contains("bing.com/search", services.Session.SelectedTab?.Url);
        Assert.Contains("daily%20news", services.Session.SelectedTab?.Url);
    }

    [Fact]
    public async Task BrowserInstructionExecutesPlannedToolCalls()
    {
        var services = TestServices.Create("{\"toolCalls\":[{\"tool\":\"tabs.open\",\"args\":{\"url\":\"chromium.org\"}}]}");

        var result = await services.Router.RouteAsync("//open chromium", services.SearchEngines.Default, services.Agents.Default);

        Assert.True(result.Succeeded);
        Assert.Equal("https://chromium.org/", services.Session.SelectedTab?.Url);
        Assert.Contains(result.Trace, line => line.StartsWith("tabs.open", StringComparison.Ordinal));
    }

    [Fact]
    public async Task AutomationEndpointSubmitsPromptLikeE2EDriver()
    {
        var services = TestServices.Create();
        var endpoint = new BrowserAutomationEndpoint(services.Session, services.Router, services.SearchEngines, services.Agents);
        var args = JsonSerializer.SerializeToElement(new { input = "bing.com" });

        var response = await endpoint.DispatchAsync("prompt.submit", args);

        Assert.True(response.Succeeded);
        Assert.Equal("https://bing.com/", services.Session.SelectedTab?.Url);
    }

    [Fact]
    public void LinkPopupBridgeOpensLinkInBrowserTab()
    {
        var services = TestServices.Create();
        var viewModel = new BrowserShellViewModel(services.Session, services.Router, services.SearchEngines, services.Agents, new BuildInfoService());
        var previousTabCount = services.Session.Tabs.Count;

        viewModel.OpenLinkInNewTab("https://example.net/path");

        Assert.Equal(previousTabCount + 1, services.Session.Tabs.Count);
        Assert.Equal("https://example.net/path", services.Session.SelectedTab?.Url);
    }

    private sealed record TestServices(BrowserSessionService Session, SearchEngineRegistry SearchEngines, AgentRegistry Agents, PromptRouterService Router)
    {
        public static TestServices Create(string? plan = null)
        {
            var session = new BrowserSessionService(new MemorySessionStore());
            var searchEngines = new SearchEngineRegistry();
            var agents = new AgentRegistry();
            var tools = new BrowserToolRegistry(session, searchEngines);
            var planning = new PlanningService(new TestPlannerClient(plan), tools);
            var router = new PromptRouterService(session, searchEngines, agents, tools, planning);
            return new TestServices(session, searchEngines, agents, router);
        }
    }

    private sealed class TestPlannerClient : ILlmPlannerClient
    {
        private readonly string plan;

        public TestPlannerClient(string? plan)
        {
            this.plan = plan ?? "{\"toolCalls\":[]}";
        }

        public Task<string> CreatePlanAsync(string prompt, IReadOnlyList<ToolDefinition> tools, ToolExecutionContext context, CancellationToken cancellationToken = default) => Task.FromResult(plan);
    }
}