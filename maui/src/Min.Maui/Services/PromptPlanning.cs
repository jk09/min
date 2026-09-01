using System.Text.Json;

namespace Min.Maui.Services;

public sealed record ToolCall(string Tool, JsonElement Args);
public sealed record PromptPlan(IReadOnlyList<ToolCall> ToolCalls, string? Message);

public interface ILlmPlannerClient
{
    Task<string> CreatePlanAsync(string prompt, IReadOnlyList<ToolDefinition> tools, ToolExecutionContext context, CancellationToken cancellationToken = default);
}

public sealed class NotConfiguredPlannerClient : ILlmPlannerClient
{
    public Task<string> CreatePlanAsync(string prompt, IReadOnlyList<ToolDefinition> tools, ToolExecutionContext context, CancellationToken cancellationToken = default)
    {
        return Task.FromResult("{\"message\":\"No LLM provider is configured for /b yet.\",\"toolCalls\":[]}");
    }
}

public sealed class PlanningService
{
    private readonly ILlmPlannerClient plannerClient;
    private readonly BrowserToolRegistry tools;

    public PlanningService(ILlmPlannerClient plannerClient, BrowserToolRegistry tools)
    {
        this.plannerClient = plannerClient;
        this.tools = tools;
    }

    public async Task<PromptRouteResult> RunAsync(string prompt, ToolExecutionContext context, CancellationToken cancellationToken = default)
    {
        PromptPlan plan;
        try
        {
            var rawPlan = await plannerClient.CreatePlanAsync(prompt, tools.GetCatalog(), context, cancellationToken).ConfigureAwait(false);
            plan = ParsePlan(rawPlan);
        }
        catch (Exception exception)
        {
            plan = StarterPromptPlanner.TryPlan(prompt, "Ollama planner unavailable: " + exception.Message) ?? new PromptPlan(Array.Empty<ToolCall>(), "Ollama planner unavailable: " + exception.Message);
        }

        if (plan.ToolCalls.Count == 0)
        {
            plan = StarterPromptPlanner.TryPlan(prompt, plan.Message) ?? plan;
        }

        var trace = new List<string>();

        foreach (var call in plan.ToolCalls)
        {
            var result = await tools.ExecuteAsync(call.Tool, call.Args, context).ConfigureAwait(false);
            trace.Add($"{call.Tool}: {result.Message}");
            if (!result.Succeeded)
            {
                return PromptRouteResult.Error(result.Message, trace);
            }
        }

        return PromptRouteResult.Handled(plan.Message ?? string.Join("; ", trace.DefaultIfEmpty("No tool calls returned.")), trace);
    }

    public static PromptPlan ParsePlan(string rawPlan)
    {
        using var document = JsonDocument.Parse(ExtractJson(rawPlan));
        var root = document.RootElement;
        var message = root.TryGetProperty("message", out var messageElement) && messageElement.ValueKind == JsonValueKind.String ? messageElement.GetString() : null;
        var calls = new List<ToolCall>();

        if (root.TryGetProperty("toolCalls", out var toolCallsElement) && toolCallsElement.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in toolCallsElement.EnumerateArray())
            {
                if (!item.TryGetProperty("tool", out var toolElement) || toolElement.ValueKind != JsonValueKind.String)
                {
                    continue;
                }

                var args = item.TryGetProperty("args", out var argsElement) ? argsElement.Clone() : JsonDocument.Parse("{}").RootElement.Clone();
                calls.Add(new ToolCall(toolElement.GetString()!, args));
            }
        }

        return new PromptPlan(calls, message);
    }

    private static string ExtractJson(string rawPlan)
    {
        var start = rawPlan.IndexOf('{');
        var end = rawPlan.LastIndexOf('}');
        return start >= 0 && end > start ? rawPlan[start..(end + 1)] : rawPlan;
    }
}

public static class StarterPromptPlanner
{
    public static PromptPlan? TryPlan(string prompt, string? message = null)
    {
        var normalized = prompt.Trim().ToLowerInvariant();
        if (normalized is "open settings" or "settings" || normalized.Contains("open settings", StringComparison.Ordinal))
        {
            return Plan("settings.open", new { });
        }

        if ((normalized.Contains("how many") || normalized.Contains("count")) && (normalized.Contains("window") || normalized.Contains("tab") || normalized.Contains("page")))
        {
            return Plan("browser.windows", new { });
        }

        if (normalized.Contains("summarize") && normalized.Contains("history"))
        {
            return Plan("history.summarizeToday", new { });
        }

        if (normalized.Contains("summarize") && normalized.Contains("page"))
        {
            return Plan("page.summarize", new { });
        }

        return null;
    }

    private static PromptPlan Plan(string tool, object args)
    {
        return new PromptPlan([new ToolCall(tool, JsonSerializer.SerializeToElement(args))], null);
    }
}