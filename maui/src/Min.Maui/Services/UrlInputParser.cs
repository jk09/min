namespace Min.Maui.Services;

public static class UrlInputParser
{
    public static bool TryParseNavigationUrl(string input, out string url)
    {
        url = string.Empty;
        var value = input.Trim();

        if (string.IsNullOrWhiteSpace(value) || value.Contains(' '))
        {
            return false;
        }

        if (value.StartsWith("min://", StringComparison.OrdinalIgnoreCase))
        {
            url = value;
            return true;
        }

        if (!value.Contains("://", StringComparison.Ordinal))
        {
            if (!LooksLikeHost(value))
            {
                return false;
            }

            value = "https://" + value;
        }

        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
        {
            return false;
        }

        if (uri.Scheme is not ("http" or "https" or "file"))
        {
            return false;
        }

        url = uri.ToString();
        return true;
    }

    private static bool LooksLikeHost(string value) => value.Contains('.', StringComparison.Ordinal) || value.Equals("localhost", StringComparison.OrdinalIgnoreCase);
}