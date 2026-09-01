namespace Min.Maui.Services;

public sealed record AgentDefinition(string Id, string Label, string HandoffTemplate, bool IsEnabled = true)
{
    public string BuildHandoffUrl(string prompt, string? contextUrl)
    {
        var context = string.IsNullOrWhiteSpace(contextUrl) ? prompt : $"{prompt}\n\nCurrent page: {contextUrl}";
        return HandoffTemplate.Replace("{prompt}", Uri.EscapeDataString(context));
    }
}

public sealed class AgentRegistry
{
    private readonly IReadOnlyList<AgentDefinition> agents =
    [
        new("claude", "Claude.ai", "https://claude.ai/new?q={prompt}"),
        new("chatgpt", "ChatGPT", "https://chatgpt.com/?q={prompt}", IsEnabled: false),
        new("perplexity", "Perplexity", "https://www.perplexity.ai/search?q={prompt}", IsEnabled: false),
        new("copilot", "Copilot", "https://copilot.microsoft.com/?q={prompt}", IsEnabled: false)
    ];

    public IReadOnlyList<AgentDefinition> List() => agents;
    public AgentDefinition Default => agents[0];
}