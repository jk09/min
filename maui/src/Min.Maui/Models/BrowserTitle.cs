namespace Min.Maui.Models;

using Microsoft.Maui.Graphics;

public static class BrowserTitle
{
    public static string FromUrl(string url)
    {
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            if (uri.Scheme == "min")
            {
                return uri.AbsolutePath.Trim('/').Replace('-', ' ');
            }

            return string.IsNullOrWhiteSpace(uri.Host) ? url : uri.Host;
        }

        return url;
    }

    public static string DisplayUrl(string url)
    {
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri) && !string.IsNullOrWhiteSpace(uri.Host))
        {
            return uri.Host + uri.PathAndQuery;
        }

        return url;
    }

    public static bool IsSecure(string url)
    {
        return Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase);
    }

    public static string FaviconText(string text)
    {
        var letter = text.FirstOrDefault(char.IsLetterOrDigit);
        return letter == default ? "M" : char.ToUpperInvariant(letter).ToString();
    }

    public static string FaviconUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || string.IsNullOrWhiteSpace(uri.Host))
        {
            return string.Empty;
        }

        return "https://www.google.com/s2/favicons?sz=32&domain_url=" + Uri.EscapeDataString(uri.GetLeftPart(UriPartial.Authority));
    }

    public static Color DefaultThemeColor(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || string.IsNullOrWhiteSpace(uri.Host))
        {
            return Color.FromArgb("#f4b934");
        }

        var hash = uri.Host.Aggregate(17, (current, next) => (current * 31) + next);
        var colors = new[] { "#4f83cc", "#d1933c", "#48a078", "#c55f6f", "#8b72cf", "#58a6a6" };
        return Color.FromArgb(colors[Math.Abs(hash) % colors.Length]);
    }

    public static bool TryCreateThemeColor(string? cssColor, out Color color)
    {
        color = Color.FromArgb("#f4b934");
        if (string.IsNullOrWhiteSpace(cssColor))
        {
            return false;
        }

        var value = cssColor.Trim().Trim('"');
        if (value.StartsWith('#') && (value.Length == 4 || value.Length == 7 || value.Length == 9))
        {
            color = Color.FromArgb(value);
            return true;
        }

        if (!value.StartsWith("rgb", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var start = value.IndexOf('(');
        var end = value.IndexOf(')');
        if (start < 0 || end <= start)
        {
            return false;
        }

        var channels = value[(start + 1)..end]
            .Split(',', StringSplitOptions.TrimEntries)
            .Take(3)
            .Select(part => int.TryParse(part, out var channel) ? Math.Clamp(channel, 0, 255) : -1)
            .ToArray();
        if (channels.Length != 3 || channels.Any(channel => channel < 0))
        {
            return false;
        }

        color = Color.FromRgb(channels[0], channels[1], channels[2]);
        return true;
    }
}