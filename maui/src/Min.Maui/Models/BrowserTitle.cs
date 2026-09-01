namespace Min.Maui.Models;

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
}