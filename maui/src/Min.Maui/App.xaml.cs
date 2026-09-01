namespace Min.Maui;

public partial class App : Application
{
	private readonly MainPage mainPage;

	public App(MainPage mainPage, Automation.NamedPipeAutomationServer automationServer)
	{
		this.mainPage = mainPage;
		InitializeComponent();
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