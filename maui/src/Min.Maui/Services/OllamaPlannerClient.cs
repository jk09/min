using System.Net.Http.Json;
using System.Text.Json;

namespace Min.Maui.Services;

public sealed class OllamaPlannerClient : ILlmPlannerClient
{
    private const int MaxPromptLength = 24000;
    private readonly HttpClient httpClient;

    public OllamaPlannerClient(HttpClient httpClient)
    {
        this.httpClient = httpClient;
    }

    public async Task<string> CreatePlanAsync(string prompt, IReadOnlyList<ToolDefinition> tools, ToolExecutionContext context, CancellationToken cancellationToken = default)
    {
        var baseUrl = ReadConfig("MIN_LLM_BASE_URL", "http://localhost:11434/v1").TrimEnd('/');
        var model = ReadConfig("MIN_LLM_MODEL", "llama3.2");
        var request = new
        {
            model,
            messages = new[]
            {
                new { role = "system", content = BuildSystemPrompt(tools, context) },
                new { role = "user", content = prompt[..Math.Min(prompt.Length, MaxPromptLength)] }
            },
            stream = false,
            response_format = new { type = "json_object" }
        };

        using var response = await httpClient.PostAsJsonAsync(baseUrl + "/chat/completions", request, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false), cancellationToken: cancellationToken).ConfigureAwait(false);
        return document.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? string.Empty;
    }

    private static string ReadConfig(string environmentName, string fallback)
    {
        return Environment.GetEnvironmentVariable(environmentName) is { Length: > 0 } value ? value : fallback;
    }

    private static string BuildSystemPrompt(IReadOnlyList<ToolDefinition> tools, ToolExecutionContext context)
    {
        var catalog = string.Join("\n", tools.Select(tool => "- " + tool.Id + ": " + tool.Description + " Parameters: " + string.Join(", ", tool.Parameters.Select(parameter => parameter.Key + "=" + parameter.Value))));
        return "You control the Min MAUI browser by returning JSON only. " +
            "Return {\"message\":string,\"toolCalls\":[{\"tool\":string,\"args\":object}]}. " +
            "Use tools instead of prose for browser actions. Examples: open settings -> settings.open; summarize page -> page.summarize; summarize today's history -> history.summarizeToday. " +
            "Current tab URL: " + (context.SelectedUrl ?? "none") + "\nTools:\n" + catalog;
    }
}