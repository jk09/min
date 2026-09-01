using Microsoft.Extensions.Logging;
using Min.Maui.Automation;
using Min.Maui.Services;
using Min.Maui.ViewModels;

namespace Min.Maui;

public static class MauiProgram
{
	public static MauiApp CreateMauiApp()
	{
		var builder = MauiApp.CreateBuilder();
		builder
			.UseMauiApp<App>()
			.ConfigureFonts(fonts =>
			{
				fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
				fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
			});

#if DEBUG
		builder.Logging.AddDebug();
#endif

		builder.Services.AddSingleton<ISessionStore, FileSessionStore>();
		builder.Services.AddSingleton<BrowserSessionService>();
		builder.Services.AddSingleton<SearchEngineRegistry>();
		builder.Services.AddSingleton<AgentRegistry>();
		builder.Services.AddSingleton<BrowserToolRegistry>();
		builder.Services.AddHttpClient<ILlmPlannerClient, OllamaPlannerClient>();
		builder.Services.AddSingleton<PlanningService>();
		builder.Services.AddSingleton<PromptRouterService>();
		builder.Services.AddSingleton<BuildInfoService>();
		builder.Services.AddSingleton<BrowserAutomationEndpoint>();
		builder.Services.AddSingleton<NamedPipeAutomationServer>();
		builder.Services.AddSingleton<BrowserShellViewModel>();
		builder.Services.AddSingleton<MainPage>();

		return builder.Build();
	}
}
