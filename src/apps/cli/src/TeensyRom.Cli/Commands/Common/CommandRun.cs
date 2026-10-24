using Spectre.Console;
using TeensyRom.Cli.Output;

namespace TeensyRom.Cli.Commands.Common;

/// <summary>The Ctrl+C wiring and the live status line that the long-running commands share.</summary>
internal static class CommandRun
{
    /// <summary>
    /// Runs <paramref name="work"/> with a token that Ctrl+C cancels. The default console handling is suppressed while it
    /// runs, so the process survives to clean up and report.
    /// </summary>
    public static async Task<T> CancellableAsync<T>(Func<CancellationToken, Task<T>> work)
    {
        using var cancel = new CancellationTokenSource();
        ConsoleCancelEventHandler onCancel = (_, args) =>
        {
            args.Cancel = true;
            cancel.Cancel();
        };

        Console.CancelKeyPress += onCancel;

        try
        {
            return await work(cancel.Token);
        }
        finally
        {
            Console.CancelKeyPress -= onCancel;
        }
    }

    /// <summary>
    /// Runs <paramref name="work"/> with a spinner on stderr that shows what <paramref name="describe"/> makes of each
    /// progress report, when a person is watching one; otherwise <paramref name="work"/> gets no progress callback.
    /// </summary>
    /// <param name="starting">The status shown until the first progress report.</param>
    public static async Task<T> WithStatusAsync<TProgress, T>(
        ICliOutput output,
        string starting,
        Func<TProgress, string> describe,
        Func<Action<TProgress>?, Task<T>> work)
    {
        if (output.Mode != OutputMode.Human || !output.ErrIsTerminal) return await work(null);

        T? result = default;

        await output.Err.Status().Spinner(Spinner.Known.Dots).StartAsync(starting, async status =>
            result = await work(progress => status.Status = Markup.Escape(describe(progress))));

        return result!;
    }
}
