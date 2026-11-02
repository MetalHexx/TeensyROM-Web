using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Update;

/// <summary>
/// Looks up the newest release while a command runs and, when the command ends, mentions a newer one on stderr: one
/// sentence, at most once a day. The lookup never holds the command up for more than a second.
/// </summary>
internal sealed class UpdateNotifier(IReleaseCheck check, ICliOutput output, TimeProvider time)
{
    /// <summary>How long the lookup may run.</summary>
    public static readonly TimeSpan FetchBudget = TimeSpan.FromSeconds(5);

    /// <summary>How long the end of a command waits for a lookup that is still running.</summary>
    public static readonly TimeSpan WaitBudget = TimeSpan.FromSeconds(1);

    public static readonly TimeSpan NoticeInterval = TimeSpan.FromHours(24);

    private Task? _refresh;
    private bool _menu;

    /// <summary>The notice, also shown under the logo of the guided menu.</summary>
    public static string Sentence(string latest, string installed) =>
        $"TeensyROM Suite {latest} is out (you have {installed}). Run `trom update`.";

    /// <summary>
    /// True for a run a person is watching in a terminal: not <c>--json</c>, help or the version, and not <c>update</c> or
    /// <c>init</c>, which report the release themselves.
    /// </summary>
    public bool ShouldCheck(string[] args, bool canPrompt) =>
        canPrompt
        && !CommandRouting.WantsJson(args)
        && !CommandRouting.AsksForHelp(args)
        && !args.Any(arg => arg is "--version" or "-v")
        && args.FirstOrDefault(arg => !arg.StartsWith('-')) is not ("update" or "init");

    /// <summary>Starts the lookup in the background when this run should check; <paramref name="menu"/> is the guided menu, which shows the notice itself.</summary>
    public void Begin(string[] args, bool menu)
    {
        if (!ShouldCheck(args, output.CanPrompt)) return;

        _menu = menu;
        _refresh = Task.Run(() => check.RefreshAsync(FetchBudget));
    }

    /// <summary>Waits briefly for the lookup, then prints the notice when a newer release is out and none was printed today. Never throws.</summary>
    public async Task EndAsync()
    {
        if (_refresh is not { } refresh) return;

        try
        {
            try
            {
                await refresh.WaitAsync(WaitBudget, time);
            }
            catch (TimeoutException)
            {
                // The lookup is still going; the next run reads whatever it manages to record.
            }

            if (_menu || check.Cached() is not { Available: true, Latest: { } latest } status) return;

            var now = time.GetUtcNow();

            if (check.NotifiedAt() is { } last && last <= now && now - last < NoticeInterval) return;

            output.Notice(new CliNotice("updateAvailable", Sentence(latest, status.Installed), Fix: "trom update"));
            check.MarkNotified();
        }
        catch (Exception)
        {
            // The notice is a courtesy; nothing here may fail the command that has just finished.
        }
    }
}
