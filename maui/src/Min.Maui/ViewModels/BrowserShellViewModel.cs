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
    private PromptInputMode inputMode;
    private bool isSendFeedbackActive;

    public BrowserShellViewModel(BrowserSessionService session, PromptRouterService router, SearchEngineRegistry searchEngines, AgentRegistry agents, BuildInfoService buildInfo)
    {
        this.session = session;
        this.router = router;
        statusText = buildInfo.Label;

        OpenPromptCommand = new RelayCommand<object>(_ => IsPromptOverlayVisible = true);
        ClosePromptCommand = new RelayCommand<object>(_ => IsPromptOverlayVisible = false);
        SetPromptModeCommand = new RelayCommand<string>(SetPromptMode);
        SubmitPromptCommand = new AsyncRelayCommand(SubmitPromptAsync, () => !IsBusy, OnSubmitFailed);
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

    public bool IsLlmMode
    {
        get => inputMode == PromptInputMode.Llm;
        set
        {
            var nextMode = value ? PromptInputMode.Llm : PromptInputMode.Browse;
            if (SetProperty(ref inputMode, nextMode))
            {
                OnPropertyChanged(nameof(InputModeLabel));
                OnPropertyChanged(nameof(InputPlaceholder));
                OnPropertyChanged(nameof(IsSearchMode));
                OnPropertyChanged(nameof(IsDebugAvailable));
                if (!IsLlmMode)
                {
                    DebugMode = false;
                }
            }
        }
    }

    public bool IsSearchMode => !IsLlmMode;
    public bool IsDebugAvailable => IsLlmMode;
    public string InputModeLabel => IsLlmMode ? "LLM" : "URL/Search";
    public string InputPlaceholder => IsLlmMode ? "Ask the model to use browser tools" : "Enter a URL or search";

    public bool IsSendFeedbackActive
    {
        get => isSendFeedbackActive;
        private set
        {
            if (SetProperty(ref isSendFeedbackActive, value))
            {
                OnPropertyChanged(nameof(SendButtonText));
            }
        }
    }

    public string SendButtonText => IsSendFeedbackActive ? "Sent" : "Send";

    public ICommand OpenPromptCommand { get; }
    public ICommand ClosePromptCommand { get; }
    public ICommand SetPromptModeCommand { get; }
    public ICommand SubmitPromptCommand { get; }
    public ICommand SelectTabCommand { get; }
    public ICommand CloseTabCommand { get; }
    public ICommand NavigateToBreadcrumbCommand { get; }

    public void RecordNavigation(string tabId, string url, string? title = null)
    {
        session.RecordNavigation(tabId, url, title);
        OnPropertyChanged(nameof(Breadcrumbs));
    }

    public void OpenLinkInNewTab(string url)
    {
        session.OpenTab(url);
    }

    public void InsertPromptNewLine()
    {
        PromptText += Environment.NewLine;
    }

    public void SubmitPromptFromKeyboard()
    {
        if (SubmitPromptCommand.CanExecute(null))
        {
            SubmitPromptCommand.Execute(null);
        }
    }

    private void SetPromptMode(string? mode)
    {
        IsLlmMode = string.Equals(mode, "agent", StringComparison.OrdinalIgnoreCase);
    }

    public async Task SubmitPromptAsync()
    {
        IsSendFeedbackActive = true;
        IsBusy = true;
        try
        {
            var result = IsLlmMode
                ? await router.RouteLlmAsync(PromptText)
                : await router.RouteBrowseAsync(PromptText);
            StatusText = result.Message;
            if (result.Succeeded)
            {
                PromptText = string.Empty;
            }

            if (IsLlmMode && DebugMode)
            {
                router.OpenDebugTab();
            }

            if (result.CloseOverlay)
            {
                IsPromptOverlayVisible = false;
            }
        }
        finally
        {
            await Task.Delay(220);
            IsSendFeedbackActive = false;
            IsBusy = false;
        }
    }

    private void OnSubmitFailed(Exception exception)
    {
        StatusText = "Prompt failed: " + exception.Message;
        IsSendFeedbackActive = false;
        IsBusy = false;
    }
}