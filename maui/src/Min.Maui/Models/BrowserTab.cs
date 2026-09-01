using System.Collections.ObjectModel;
using Min.Maui.Core;
using Microsoft.Maui.Graphics;

namespace Min.Maui.Models;

public sealed class BrowserTab : ObservableObject
{
    private string url;
    private string title;
    private bool isSelected;
    private bool isLoading;
    private bool isSecure;
    private Color themeColor;
    private int activeNavigationIndex;

    public BrowserTab(string url, string? title = null)
    {
        Id = Guid.NewGuid().ToString("N");
        this.url = url;
        this.title = string.IsNullOrWhiteSpace(title) ? BrowserTitle.FromUrl(url) : title;
        isSecure = BrowserTitle.IsSecure(url);
        themeColor = BrowserTitle.DefaultThemeColor(url);
        History.Add(new NavigationEntry(url, this.title, true));
    }

    public string Id { get; }

    public string Url
    {
        get => url;
        set
        {
            if (SetProperty(ref url, value))
            {
                IsSecure = BrowserTitle.IsSecure(value);
                OnPropertyChanged(nameof(DisplayUrl));
                OnPropertyChanged(nameof(FaviconUrl));
                ThemeColor = BrowserTitle.DefaultThemeColor(value);
            }
        }
    }

    public string Title
    {
        get => title;
        set
        {
            if (SetProperty(ref title, value))
            {
                OnPropertyChanged(nameof(DisplayTitle));
                OnPropertyChanged(nameof(FaviconText));
            }
        }
    }

    public string DisplayTitle => string.IsNullOrWhiteSpace(Title) ? DisplayUrl : Title;
    public string DisplayUrl => BrowserTitle.DisplayUrl(Url);
    public string FaviconText => BrowserTitle.FaviconText(DisplayTitle);
    public string FaviconUrl => BrowserTitle.FaviconUrl(Url);

    public Color ThemeColor
    {
        get => themeColor;
        private set => SetProperty(ref themeColor, value);
    }

    public bool IsSelected
    {
        get => isSelected;
        set => SetProperty(ref isSelected, value);
    }

    public bool IsLoading
    {
        get => isLoading;
        set => SetProperty(ref isLoading, value);
    }

    public bool IsSecure
    {
        get => isSecure;
        set => SetProperty(ref isSecure, value);
    }

    public ObservableCollection<NavigationEntry> History { get; } = new();

    public int ActiveNavigationIndex
    {
        get => activeNavigationIndex;
        private set => SetProperty(ref activeNavigationIndex, value);
    }

    public void RecordNavigation(string nextUrl, string? nextTitle = null)
    {
        Url = nextUrl;
        Title = string.IsNullOrWhiteSpace(nextTitle) ? BrowserTitle.FromUrl(nextUrl) : nextTitle;

        if (History.Count > 0 && History[ActiveNavigationIndex].Url == nextUrl)
        {
            ReplaceHistoryEntry(ActiveNavigationIndex, true);
            return;
        }

        while (History.Count > ActiveNavigationIndex + 1)
        {
            History.RemoveAt(History.Count - 1);
        }

        if (History.Count > 0)
        {
            ReplaceHistoryEntry(ActiveNavigationIndex, false);
        }

        History.Add(new NavigationEntry(nextUrl, Title, true));
        ActiveNavigationIndex = History.Count - 1;
    }

    public void NavigateToHistoryEntry(NavigationEntry entry)
    {
        var index = History.IndexOf(entry);
        if (index < 0)
        {
            return;
        }

        ReplaceHistoryEntry(ActiveNavigationIndex, false);
        ActiveNavigationIndex = index;
        Url = entry.Url;
        Title = entry.Title;
        ReplaceHistoryEntry(index, true);
    }

    public void SetThemeColor(string? cssColor)
    {
        if (BrowserTitle.TryCreateThemeColor(cssColor, out var color))
        {
            ThemeColor = color;
        }
    }

    private void ReplaceHistoryEntry(int index, bool isCurrent)
    {
        if (index < 0 || index >= History.Count)
        {
            return;
        }

        var current = History[index];
        History[index] = new NavigationEntry(current.Url, current.Title, isCurrent);
    }
}