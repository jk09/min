namespace Min.Maui;

using System.Collections.Specialized;
using System.ComponentModel;
using Min.Maui.Models;
using Min.Maui.ViewModels;
#if WINDOWS
using Microsoft.UI.Xaml.Input;
using Windows.System;
#endif

public partial class MainPage : ContentPage
{
	private readonly BrowserShellViewModel viewModel;
	private readonly Dictionary<string, WebView> webViews = new();

	public MainPage(BrowserShellViewModel viewModel)
	{
		this.viewModel = viewModel;
		InitializeComponent();
		BindingContext = viewModel;
		viewModel.PropertyChanged += OnViewModelChanged;
		viewModel.Tabs.CollectionChanged += OnTabsChanged;
		Loaded += OnLoaded;
		SyncWebViews();
	}

	protected override void OnHandlerChanged()
	{
		base.OnHandlerChanged();
#if WINDOWS
		if (Handler?.PlatformView is Microsoft.UI.Xaml.UIElement element)
		{
			var accelerator = new KeyboardAccelerator
			{
				Key = VirtualKey.L,
				Modifiers = VirtualKeyModifiers.Control
			};
			accelerator.Invoked += (_, args) =>
			{
				viewModel.IsPromptOverlayVisible = true;
				PromptEditor.Focus();
				args.Handled = true;
			};
			element.KeyboardAccelerators.Add(accelerator);
		}
#endif
	}

	private void OnLoaded(object? sender, EventArgs e)
	{
		if (!viewModel.HasTabs)
		{
			viewModel.IsPromptOverlayVisible = true;
			PromptEditor.Focus();
		}
	}

	private void OnTabsChanged(object? sender, NotifyCollectionChangedEventArgs e) => SyncWebViews();

	private void OnViewModelChanged(object? sender, PropertyChangedEventArgs e)
	{
		if (e.PropertyName is nameof(BrowserShellViewModel.SelectedTab))
		{
			SyncWebViews();
		}

		if (e.PropertyName is nameof(BrowserShellViewModel.IsPromptOverlayVisible) && viewModel.IsPromptOverlayVisible)
		{
			PromptEditor.Focus();
		}
	}

	private void SyncWebViews()
	{
		foreach (var tab in viewModel.Tabs)
		{
			if (!webViews.ContainsKey(tab.Id))
			{
				var webView = CreateWebView(tab);
				webViews[tab.Id] = webView;
				WebViewHost.Add(webView);
			}
		}

		foreach (var staleTabId in webViews.Keys.Except(viewModel.Tabs.Select(tab => tab.Id)).ToArray())
		{
			WebViewHost.Remove(webViews[staleTabId]);
			webViews.Remove(staleTabId);
		}

		foreach (var pair in webViews)
		{
			pair.Value.IsVisible = pair.Key == viewModel.SelectedTab?.Id;
		}
	}

	private WebView CreateWebView(BrowserTab tab)
	{
		var webView = new WebView
		{
			Source = tab.Url,
			HorizontalOptions = LayoutOptions.Fill,
			VerticalOptions = LayoutOptions.Fill
		};

		tab.PropertyChanged += (_, args) =>
		{
			if (args.PropertyName == nameof(BrowserTab.Url) && webView.Source?.ToString() != tab.Url)
			{
				webView.Source = tab.Url;
			}
		};
		webView.Navigating += (_, _) => tab.IsLoading = true;
		webView.Navigated += (_, args) =>
		{
			tab.IsLoading = false;
			if (!string.IsNullOrWhiteSpace(args.Url))
			{
				viewModel.RecordNavigation(tab.Id, args.Url, BrowserTitle.FromUrl(args.Url));
			}
		};

		return webView;
	}
}
