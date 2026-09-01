using System.Reflection;

namespace Min.Maui.Services;

public sealed class BuildInfoService
{
    public string Label { get; } = FormatLabel();

    private static string FormatLabel()
    {
        var version = typeof(BuildInfoService).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        return string.IsNullOrWhiteSpace(version) ? "MAUI port" : $"MAUI {version}";
    }
}