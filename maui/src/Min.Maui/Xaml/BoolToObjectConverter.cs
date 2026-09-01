using System.Globalization;

namespace Min.Maui.Xaml;

public sealed class BoolToObjectConverter : IValueConverter
{
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var parts = (parameter as string)?.Split('|') ?? Array.Empty<string>();
        if (parts.Length != 2)
        {
            return value;
        }

        return value is true ? Color.FromArgb(parts[0]) : Color.FromArgb(parts[1]);
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotSupportedException();
}