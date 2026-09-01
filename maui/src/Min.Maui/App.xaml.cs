namespace Min.Maui;

public partial class App : Application
{
	private readonly MainPage mainPage;

	public App(ViewModels.BrowserShellViewModel viewModel, Automation.NamedPipeAutomationServer automationServer)
	{
		InitializeComponent();
		mainPage = new MainPage(viewModel);
		automationServer.StartIfRequested();
	}

	protected override Window CreateWindow(IActivationState? activationState)
	{
		return new Window(mainPage)
		{
			Title = "Min"
		};
	}
}