using System.Collections.ObjectModel;
using System.ComponentModel;
using Min.Maui.Core;
using Min.Maui.Models;

namespace Min.Maui.Services;

public sealed class BrowserSessionService : ObservableObject
{
    private readonly ISessionStore sessionStore;
    private BrowserTab? selectedTab;

    public BrowserSessionService(ISessionStore sessionStore)
    {
        this.sessionStore = sessionStore;
        RestoreOrSeedSession();
    }

    public ObservableCollection<BrowserTab> Tabs { get; } = new();

    public BrowserTab? SelectedTab
    {
        get => selectedTab;
        private set
        {
            if (selectedTab is not null)
            {
                selectedTab.IsSelected = false;
            }

            if (SetProperty(ref selectedTab, value))
            {
                if (selectedTab is not null)
                {
                    selectedTab.IsSelected = true;
                }

                OnPropertyChanged(nameof(HasTabs));
                OnPropertyChanged(nameof(OverflowSummary));
                Save();
            }
        }
    }

    public bool HasTabs => Tabs.Count > 0;
    public string OverflowSummary => Tabs.Count > 6 ? $"... {Tabs.Count - 6} more tabs" : string.Empty;

    public BrowserTab OpenTab(string url, bool background = false)
    {
        var tab = new BrowserTab(url);
        tab.PropertyChanged += OnTabChanged;
        Tabs.Add(tab);

        if (!background || SelectedTab is null)
        {
            SelectTab(tab);
        }

        OnPropertyChanged(nameof(HasTabs));
        OnPropertyChanged(nameof(OverflowSummary));
        Save();
        return tab;
    }

    public void SelectTab(BrowserTab? tab)
    {
        if (tab is null || !Tabs.Contains(tab))
        {
            return;
        }

        SelectedTab = tab;
    }

    public void SelectTab(string tabId) => SelectTab(Tabs.FirstOrDefault(tab => tab.Id == tabId));

    public void CloseTab(BrowserTab? tab)
    {
        if (tab is null || !Tabs.Contains(tab))
        {
            return;
        }

        var index = Tabs.IndexOf(tab);
        tab.PropertyChanged -= OnTabChanged;
        Tabs.Remove(tab);

        if (SelectedTab == tab)
        {
            SelectedTab = Tabs.Count == 0 ? null : Tabs[Math.Min(index, Tabs.Count - 1)];
        }

        OnPropertyChanged(nameof(HasTabs));
        OnPropertyChanged(nameof(OverflowSummary));
        Save();
    }

    public void CloseTab(string? tabId)
    {
        if (string.IsNullOrWhiteSpace(tabId) || tabId is "*" or "all")
        {
            CloseTab(SelectedTab);
            return;
        }

        CloseTab(Tabs.FirstOrDefault(tab => tab.Id == tabId));
    }

    public void NavigateSelected(string url)
    {
        if (SelectedTab is null)
        {
            OpenTab(url);
            return;
        }

        SelectedTab.RecordNavigation(url);
        Save();
    }

    public void RecordNavigation(string tabId, string url, string? title = null)
    {
        Tabs.FirstOrDefault(candidate => candidate.Id == tabId)?.RecordNavigation(url, title);
        Save();
    }

    public void NavigateToHistoryEntry(NavigationEntry? entry)
    {
        if (entry is null || SelectedTab is null)
        {
            return;
        }

        SelectedTab.NavigateToHistoryEntry(entry);
        Save();
    }

    private void RestoreOrSeedSession()
    {
        var snapshot = sessionStore.Load();
        if (snapshot is null || snapshot.Tabs.Count == 0)
        {
            OpenTab("https://www.bing.com");
            return;
        }

        foreach (var savedTab in snapshot.Tabs)
        {
            var tab = new BrowserTab(savedTab.Url, savedTab.Title);
            tab.PropertyChanged += OnTabChanged;
            Tabs.Add(tab);
        }

        SelectedTab = Tabs.FirstOrDefault(tab => tab.Id == snapshot.SelectedTabId) ?? Tabs[0];
    }

    private void Save()
    {
        sessionStore.Save(new BrowserSessionSnapshot(Tabs.Select(tab => new BrowserTabSnapshot(tab.Id, tab.Url, tab.Title)).ToArray(), SelectedTab?.Id));
    }

    private void OnTabChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName is nameof(BrowserTab.Url) or nameof(BrowserTab.Title))
        {
            Save();
        }
    }
}