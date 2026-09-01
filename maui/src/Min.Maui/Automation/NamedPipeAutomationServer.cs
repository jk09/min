using System.IO.Pipes;
using System.Text;
using System.Text.Json;

namespace Min.Maui.Automation;

public sealed class NamedPipeAutomationServer
{
    private readonly BrowserAutomationEndpoint endpoint;

    public NamedPipeAutomationServer(BrowserAutomationEndpoint endpoint)
    {
        this.endpoint = endpoint;
    }

    public void StartIfRequested(CancellationToken cancellationToken = default)
    {
        var pipeName = Environment.GetEnvironmentVariable("MIN_MAUI_AUTOMATION_PIPE");
        if (string.IsNullOrWhiteSpace(pipeName))
        {
            return;
        }

        _ = Task.Run(() => RunAsync(pipeName, cancellationToken), cancellationToken);
    }

    private async Task RunAsync(string pipeName, CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            await using var pipe = new NamedPipeServerStream(pipeName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);
            await pipe.WaitForConnectionAsync(cancellationToken).ConfigureAwait(false);
            using var reader = new StreamReader(pipe, Encoding.UTF8, leaveOpen: true);
            await using var writer = new StreamWriter(pipe, Encoding.UTF8, leaveOpen: true) { AutoFlush = true };
            var request = await reader.ReadLineAsync(cancellationToken).ConfigureAwait(false);
            var response = await DispatchRawAsync(request ?? "{}").ConfigureAwait(false);
            await writer.WriteLineAsync(JsonSerializer.Serialize(response)).ConfigureAwait(false);
        }
    }

    private async Task<AutomationResponse> DispatchRawAsync(string request)
    {
        try
        {
            using var document = JsonDocument.Parse(request);
            var root = document.RootElement;
            var command = root.TryGetProperty("command", out var commandElement) ? commandElement.GetString() : null;
            var args = root.TryGetProperty("args", out var argsElement) ? argsElement.Clone() : JsonDocument.Parse("{}").RootElement.Clone();
            return string.IsNullOrWhiteSpace(command) ? new AutomationResponse(false, "Automation request requires command.") : await endpoint.DispatchAsync(command, args).ConfigureAwait(false);
        }
        catch (JsonException ex)
        {
            return new AutomationResponse(false, ex.Message);
        }
    }
}