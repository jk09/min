namespace Min.Maui;

using System.Collections.Specialized;
using System.ComponentModel;
using Min.Maui.Models;
using Min.Maui.ViewModels;
#if WINDOWS
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.Web.WebView2.Core;
using Windows.System;
#endif

public partial class MainPage : ContentPage
{
	private readonly BrowserShellViewModel viewModel;
	private readonly Dictionary<string, WebView> webViews = new();
#if WINDOWS
	private readonly HashSet<WebView> webViewsWithNewWindowHandlers = new();
#endif

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

			var closeAccelerator = new KeyboardAccelerator
			{
				Key = VirtualKey.Escape
			};
			closeAccelerator.Invoked += (_, args) =>
			{
				viewModel.IsPromptOverlayVisible = false;
				args.Handled = true;
			};
			element.KeyboardAccelerators.Add(closeAccelerator);

			var submitAccelerator = new KeyboardAccelerator
			{
				Key = VirtualKey.Enter
			};
			submitAccelerator.Invoked += (_, args) =>
			{
				if (viewModel.IsPromptOverlayVisible)
				{
					viewModel.SubmitPromptFromKeyboard();
					args.Handled = true;
				}
			};
			element.KeyboardAccelerators.Add(submitAccelerator);

			var newlineAccelerator = new KeyboardAccelerator
			{
				Key = VirtualKey.Enter,
				Modifiers = VirtualKeyModifiers.Control
			};
			newlineAccelerator.Invoked += (_, args) =>
			{
				if (viewModel.IsPromptOverlayVisible)
				{
					viewModel.InsertPromptNewLine();
					PromptEditor.Focus();
					args.Handled = true;
				}
			};
			element.KeyboardAccelerators.Add(newlineAccelerator);
		}
#endif
	}

	private void ClosePromptOverlay(object? sender, TappedEventArgs e)
	{
		viewModel.IsPromptOverlayVisible = false;
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
		webView.Navigated += async (_, args) =>
		{
			tab.IsLoading = false;
			if (!string.IsNullOrWhiteSpace(args.Url))
			{
				viewModel.RecordNavigation(tab.Id, args.Url, BrowserTitle.FromUrl(args.Url));
			}

			await UpdateTabThemeColorAsync(webView, tab);
		};
#if WINDOWS
		webView.HandlerChanged += (_, _) => AttachNewWindowHandler(webView);
		AttachNewWindowHandler(webView);
#endif

		return webView;
	}

	private static async Task UpdateTabThemeColorAsync(WebView webView, BrowserTab tab)
	{
		try
		{
			var color = await webView.EvaluateJavaScriptAsync("document.querySelector('meta[name=\\\"theme-color\\\"]')?.content || getComputedStyle(document.body).backgroundColor");
			tab.SetThemeColor(color);
		}
		catch (Exception)
		{
		}
	}

#if WINDOWS
	private void AttachNewWindowHandler(WebView webView)
	{
		if (webViewsWithNewWindowHandlers.Contains(webView) || webView.Handler?.PlatformView is not WebView2 nativeWebView)
		{
			return;
		}

		webViewsWithNewWindowHandlers.Add(webView);
		_ = AttachNewWindowHandlerAsync(nativeWebView);
	}

	private async Task AttachNewWindowHandlerAsync(WebView2 nativeWebView)
	{
		await nativeWebView.EnsureCoreWebView2Async();
		nativeWebView.CoreWebView2.NewWindowRequested += OnNewWindowRequested;
	}

	private void OnNewWindowRequested(CoreWebView2 sender, CoreWebView2NewWindowRequestedEventArgs args)
	{
		args.Handled = true;
		if (!string.IsNullOrWhiteSpace(args.Uri))
		{
			Dispatcher.Dispatch(() => viewModel.OpenLinkInNewTab(args.Uri));
		}
	}
#endif
}
