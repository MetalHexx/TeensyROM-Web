using Spectre.Console;
using Spectre.Console.Cli;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Fonts;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tui;

/// <summary>
/// The interactive menu that <c>trom</c> opens when run alone in a terminal. Its flows are the original interactive
/// commands, run on a private app that no command line can reach.
/// </summary>
internal sealed class TuiHost(CommandApp flows, StartupGate gate, ICliOutput output, CliConsoles consoles, ITransferLineStream? lines = null)
{
    private sealed record MenuEntry(string Label, string Flow, bool NeedsEngine);

    private static readonly MenuEntry[] Menu =
    [
        new("Launch", "launch", NeedsEngine: true),
        new("Watch Folders", "watch-folders", NeedsEngine: true),
        new("Settings", "settings", NeedsEngine: true),
        new("Index Files", "index", NeedsEngine: true),
        new("Devices", "ports", NeedsEngine: true),
        new("Generate ASID Patches", "chipsynth", NeedsEngine: false),
        new("Credits", "credits", NeedsEngine: false)
    ];

    private const string Leave = "Leave";

    /// <summary>
    /// Shows the logo and the menu until the user leaves; returns 0, or 1 when a flow that needs an engine and a
    /// device could not get them. An error inside a flow is shown and the menu returns. While it is open, a line is
    /// printed when any transfer starts or ends.
    /// </summary>
    public async Task<int> RunAsync()
    {
        output.SetRunMode(CliRunMode.Tui);
        AnsiConsole.Console = consoles.Out;

        AnsiConsole.WriteLine();
        RadHelper.RenderLogo("TeensyROM", FontConstants.FontPath);

        var labels = Menu.Select(entry => entry.Label).Append(Leave).ToList();

        try
        {
            _ = StartLinesAsync();

            while (true)
            {
                var choice = PromptHelper.ChoicePrompt("Choose wisely", labels);

                AnsiConsole.WriteLine();

                if (choice == Leave) return 0;

                var entry = Menu.Single(e => e.Label == choice);

                if (entry.NeedsEngine)
                {
                    if (!await gate.EnsureReadyAsync()) return 1;

                    // Joins the start already running, or retries one that found no engine before a flow started it.
                    _ = StartLinesAsync();
                }

                await RunFlowAsync(entry.Flow);
            }
        }
        finally
        {
            if (lines is not null) await lines.DisposeAsync();
        }
    }

    private async Task StartLinesAsync()
    {
        if (lines is null) return;

        try
        {
            await lines.StartAsync(CancellationToken.None);
        }
        catch (Exception ex)
        {
            ExitCodeMapper.LogExceptionToFile(ex);
        }
    }

    private async Task RunFlowAsync(string flow)
    {
        try
        {
            await flows.RunAsync([flow]);
        }
        catch (CommandParseException ex)
        {
            RadHelper.WriteError(ex.Message);
        }
        catch (TeensyApiException ex)
        {
            RadHelper.WriteError(ex.Message);
        }
        catch (CliException ex)
        {
            RadHelper.WriteError(ex.Message);
        }
        catch (Exception ex)
        {
            AnsiConsole.WriteException(ex, ExceptionFormats.Default);
            ExitCodeMapper.LogExceptionToFile(ex);
        }
    }
}
