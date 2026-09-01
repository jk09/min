using System.Text.Json;

namespace Min.Maui.Services;

public sealed record BrowserSessionSnapshot(IReadOnlyList<BrowserTabSnapshot> Tabs, string? SelectedTabId);
public sealed record BrowserTabSnapshot(string Id, string Url, string Title);

public interface ISessionStore
{
    BrowserSessionSnapshot? Load();
    void Save(BrowserSessionSnapshot snapshot);
}

public sealed class FileSessionStore : ISessionStore
{
    private readonly string filePath;

    public FileSessionStore()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        filePath = Path.Combine(appData, "MinMaui", "session.json");
    }

    public BrowserSessionSnapshot? Load()
    {
        if (!File.Exists(filePath))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<BrowserSessionSnapshot>(File.ReadAllText(filePath));
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public void Save(BrowserSessionSnapshot snapshot)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
        File.WriteAllText(filePath, JsonSerializer.Serialize(snapshot, new JsonSerializerOptions { WriteIndented = true }));
    }
}

public sealed class MemorySessionStore : ISessionStore
{
    private BrowserSessionSnapshot? snapshot;
    public BrowserSessionSnapshot? Load() => snapshot;
    public void Save(BrowserSessionSnapshot snapshot) => this.snapshot = snapshot;
}