using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.WebUi;

namespace TeensyRom.Cli.Commands.Ui;

internal sealed class UiSettings : TromSettings
{
    [Description("Print the addresses without opening a browser.")]
    [CommandOption("--no-open")]
    public bool NoOpen { get; set; }
}

/// <summary>
/// <c>trom ui</c>: starts Trom API when needed, opens Trom UI in the browser and lists the addresses it answers at, on this
/// computer and on the network. A browser that won't open is a notice, not a failure; Trom UI not being served is a failure
/// (exit 1) after the report is written.
/// </summary>
internal sealed class UiCommand(ICliOutput output, IEngineControl engine, UiLauncher launcher) : EngineCommand<UiSettings>(output, engine)
{
    protected override async Task<int> RunAsync(CommandContext context, UiSettings settings, CancellationToken ct)
    {
        var report = await launcher.OpenAsync(open: !settings.NoOpen, ct);

        Write(report);

        if (!report.Available) throw new CliException(CliExitCode.Failed, report.Problem!);

        if (report.OpenFailure is not null)
        {
            Output.Notice($"Couldn't open a browser ({report.OpenFailure.TrimEnd('.')}) — open {report.Address} yourself.");
        }
        if (BrowserOpener.Current == BrowserPlatform.Wsl)
        {
            Output.Notice("Devices on your network reach Trom UI through this computer's Windows address, not the WSL address above.");
        }
        return 0;
    }

    private void Write(UiReport report)
    {
        if (Output.Mode == OutputMode.Json)
        {
            Output.Json(report);
            return;
        }

        List<(string Label, string Value)> fields = [("Trom UI", report.Address)];

        fields.AddRange(report.NetworkAddresses.Select(address => ("On your network", address)));
        if (!report.Available) fields.Add(("Status", "not available"));
        Output.Fields(fields);
    }
}
