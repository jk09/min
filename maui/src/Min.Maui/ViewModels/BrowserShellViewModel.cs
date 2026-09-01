using System.Collections.ObjectModel;
using System.Windows.Input;
using Min.Maui.Core;
using Min.Maui.Models;
using Min.Maui.Services;

namespace Min.Maui.ViewModels;

public sealed class BrowserShellViewModel : ObservableObject
{
    private readonly BrowserSessionService session;
    private readonly PromptRouterService router;
    private string promptText = string.Empty;
    private bool isPromptOverlayVisible;
    private bool isBusy;
    private string statusText;
    private bool debugMode;

    public BrowserShellViewModel(BrowserSessionService session, PromptRouterService router, SearchEngineRegistry searchEngines, AgentRegistry agents, BuildInfoService buildInfo)
    {
        this.session = session;
        this.router = router;
        statusText = buildInfo.Label;

        OpenPromptCommand = new RelayCommand<object>(_ => IsPromptOverlayVisible = true);
        ClosePromptCommand = new RelayCommand<object>(_ => IsPromptOverlayVisible = false);
        SubmitPromptCommand = new AsyncRelayCommand(SubmitPromptAsync, () => !IsBusy);
        SelectTabCommand = new RelayCommand<BrowserTab>(session.SelectTab);
        CloseTabCommand = new RelayCommand<BrowserTab>(session.CloseTab);
        NavigateToBreadcrumbCommand = new RelayCommand<NavigationEntry>(session.NavigateToHistoryEntry);

        session.PropertyChanged += (_, args) =>
        {
            if (args.PropertyName is nameof(BrowserSessionService.SelectedTab) or nameof(BrowserSessionService.HasTabs) or nameof(BrowserSessionService.OverflowSummary))
            {
                OnPropertyChanged(nameof(SelectedTab));
                OnPropertyChanged(nameof(HasTabs));
                OnPropertyChanged(nameof(Breadcrumbs));
                OnPropertyChanged(nameof(OverflowSummary));
            }
        };
        session.Tabs.CollectionChanged += (_, _) =>
        {
            OnPropertyChanged(nameof(HasTabs));
            OnPropertyChanged(nameof(OverflowSummary));
        };
    }

    public ObservableCollection<BrowserTab> Tabs => session.Tabs;
    public BrowserTab? SelectedTab => session.SelectedTab;
    public bool HasTabs => session.HasTabs;
    public IEnumerable<NavigationEntry> Breadcrumbs => session.SelectedTab?.History ?? Enumerable.Empty<NavigationEntry>();
    public string OverflowSummary => session.OverflowSummary;

    public string PromptText
    {
        get => promptText;
        set => SetProperty(ref promptText, value);
    }

    public bool IsPromptOverlayVisible
    {
        get => isPromptOverlayVisible;
        set => SetProperty(ref isPromptOverlayVisible, value);
    }

    public bool IsBusy
    {
        get => isBusy;
        set
        {
            if (SetProperty(ref isBusy, value) && SubmitPromptCommand is AsyncRelayCommand command)
            {
                command.RaiseCanExecuteChanged();
            }
        }
    }

    public string StatusText
    {
        get => statusText;
        set => SetProperty(ref statusText, value);
    }

    public bool DebugMode
    {
        get => debugMode;
        set => SetProperty(ref debugMode, value);
    }

    public ICommand OpenPromptCommand { get; }
    public ICommand ClosePromptCommand { get; }
    public ICommand SubmitPromptCommand { get; }
    public ICommand SelectTabCommand { get; }
    public ICommand CloseTabCommand { get; }
    public ICommand NavigateToBreadcrumbCommand { get; }

    public void RecordNavigation(string tabId, string url, string? title = null)
    {
        session.RecordNavigation(tabId, url, title);
        OnPropertyChanged(nameof(Breadcrumbs));
    }

    private async Task SubmitPromptAsync()
    {
        IsBusy = true;
        try
        {
            var result = await router.RouteAsync(PromptText, debug: DebugMode).ConfigureAwait(false);
            StatusText = result.Message;
            if (result.Succeeded)
            {
                PromptText = string.Empty;
            }

            if (result.CloseOverlay)
            {
                IsPromptOverlayVisible = false;
            }
        }
        finally
        {
            IsBusy = false;
        }
    }
}