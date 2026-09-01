namespace Min.Maui.Services;

public sealed record SearchEngineDefinition(string Id, string Label, string Template, bool IsEnabled = true)
{
    public string BuildSearchUrl(string query) => Template.Replace("{query}", Uri.EscapeDataString(query));
}

public sealed class SearchEngineRegistry
{
    private readonly IReadOnlyList<SearchEngineDefinition> engines =
    [
        new("bing", "Bing", "https://www.bing.com/search?q={query}"),
        new("google", "Google", "https://www.google.com/search?q={query}", IsEnabled: false),
        new("ecosia", "Ecosia", "https://www.ecosia.org/search?q={query}", IsEnabled: false),
        new("startpage", "Startpage", "https://www.startpage.com/search?q={query}", IsEnabled: false)
    ];

    public IReadOnlyList<SearchEngineDefinition> List() => engines;
    public SearchEngineDefinition Default => engines[0];
}