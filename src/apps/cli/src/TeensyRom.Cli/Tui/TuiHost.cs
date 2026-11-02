using Spectre.Console;
using Spectre.Console.Cli;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Fonts;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tui;

/// <summary>
/// The interactive menu that <c>trom</c> opens when run alone in a terminal. Its flows are the original interactive
/// commands, run on a private app that no command line can reach.
/// </summary>
internal sealed class TuiHost(CommandApp flows, StartupGate gate, ICliOutput output, CliConsoles consoles, ITransferLineStream? lines = null, IReleaseCheck? releases = null)
{
    private sealed record MenuEntry(string Label, string Flow, bool NeedsEngine, bool NeedsDevice = true, bool LeaveWhenDone = false);

    /// <summary>
    /// The entries above Leave, worked out on every pass of the menu so an entry can come and go while it is open. The
    /// update entry is there when the last release lookup found a newer release; the menu never looks one up itself.
    /// </summary>
    private MenuEntry[] Entries() =>
    [
        new("Launch", "launch", NeedsEngine: true),
        new("Open Trom UI", "ui", NeedsEngine: true, NeedsDevice: false),
        new("Watch Folders", "watch-folders", NeedsEngine: true),
        new("Index Files", "index", NeedsEngine: true),
        new("Devices", "ports", NeedsEngine: true),
        new("Theme", "theme", NeedsEngine: true, NeedsDevice: false),
        new("Generate ASID Patches", "chipsynth", NeedsEngine: false),
        new("Credits", "credits", NeedsEngine: false),
        new("Settings", "settings", NeedsEngine: true),
        .. UpdateEntry()
    ];

    private IEnumerable<MenuEntry> UpdateEntry() =>
        releases?.Cached() is { Available: true, Latest: { } latest }
            ? [new($"Update to {latest}", "update", NeedsEngine: false, LeaveWhenDone: true)]
            : [];

    private const string Leave = "Leave";

    /// <summary>
    /// Shows the logo and the menu until the user leaves; returns 0, or 1 when a flow that needs an engine and a
    /// device could not get them. An error inside a flow is shown and the menu returns, except after a successful
    /// update, which ends the menu because this process is still the old version. While it is open, a line is
    /// printed when any transfer starts or ends.
    /// </summary>
    public async Task<int> RunAsync()
    {
        output.SetRunMode(CliRunMode.Tui);
        AnsiConsole.Console = consoles.Out;

        AnsiConsole.WriteLine();
        RadHelper.RenderLogo("TeensyROM", FontConstants.Logo);

        if (releases?.Cached() is { Available: true, Latest: { } newest } found) output.Notice(UpdateNotifier.Sentence(newest, found.Installed));

        try
        {
            _ = StartLinesAsync();

            while (true)
            {
                var entries = Entries();
                var labels = entries.Select(entry => entry.Label).Append(Leave).ToList();
                // Every entry shows at once: with the update entry there are more than the 10 a prompt shows by default.
                var choice = PromptHelper.ChoicePrompt("Choose wisely", labels, pageSize: labels.Count);

                AnsiConsole.WriteLine();

                if (choice == Leave) return 0;

                var entry = entries.Single(e => e.Label == choice);

                if (entry.NeedsEngine)
                {
                    if (!await (entry.NeedsDevice ? gate.EnsureReadyAsync() : gate.EnsureEngineAsync())) return 1;

                    // Joins the start already running, or retries one that found no engine before a flow started it.
                    _ = StartLinesAsync();
                }

                var exitCode = await RunFlowAsync(entry.Flow);

                if (entry.LeaveWhenDone && exitCode == 0) return 0;
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

    /// <summary>Runs one flow and returns its exit code; a flow that failed with an error, shown here, returns 1.</summary>
    private async Task<int> RunFlowAsync(string flow)
    {
        try
        {
            return await flows.RunAsync([flow]);
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
        return 1;
    }
}
