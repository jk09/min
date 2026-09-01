namespace Min.Maui.Diagnostics;

public static class StartupDiagnostics
{
    private static readonly object SyncRoot = new();

    public static string LogPath { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MinMaui",
        "startup.log");

    public static void Write(string message)
    {
        try
        {
            lock (SyncRoot)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(LogPath)!);
                File.AppendAllText(LogPath, $"{DateTimeOffset.Now:O} {message}{Environment.NewLine}");
            }
        }
        catch
        {
        }
    }

    public static void Write(Exception exception)
    {
        Write(exception.ToString());
    }
}