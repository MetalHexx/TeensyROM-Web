using System.ComponentModel;
using System.Diagnostics;
using System.Text;

namespace TeensyRom.Cli.Update;

/// <summary>
/// How a child process ended. A process that couldn't be started has <see cref="StartFailure"/> set and no output.
/// </summary>
/// <param name="TimedOut">The process was still running when the time was up and was killed.</param>
internal sealed record ProcessResult(int ExitCode, string StdOut, string StdErr, bool TimedOut = false, string? StartFailure = null)
{
    public bool Succeeded => StartFailure is null && !TimedOut && ExitCode == 0;

    /// <summary>The first non-blank line of standard output; null when there is none.</summary>
    public string? FirstLine => StdOut.Split('\n').Select(line => line.Trim()).FirstOrDefault(line => line.Length > 0);

    /// <summary>The version in the first line of a <c>trom --version</c> run, <c>trom &lt;version&gt;</c>; null when that line isn't there.</summary>
    public SemVersion? ReportedTromVersion =>
        FirstLine is { } line && line.StartsWith("trom ", StringComparison.Ordinal) && SemVersion.TryParse(line[5..], out var version)
            ? version
            : null;

    /// <summary>Why it didn't succeed, as a clause for a sentence.</summary>
    public string Describe() => StartFailure ?? (TimedOut ? "it took too long" : $"it exited with code {ExitCode}");
}

internal interface IProcessRunner
{
    /// <summary>
    /// Runs <paramref name="file"/> with <paramref name="args"/> and waits for it, with no console input.
    /// <paramref name="onLine"/> receives each line of standard output and standard error as it arrives.
    /// </summary>
    /// <param name="killProcessTree">
    /// What a timeout or cancellation kills: the process and everything it started, or with false only the process itself,
    /// for one whose children are meant to outlive it.
    /// </param>
    Task<ProcessResult> RunAsync(string file, IReadOnlyList<string> args, TimeSpan timeout, Action<string>? onLine, CancellationToken ct = default, bool killProcessTree = true);
}

/// <summary>Runs child processes for real, killing the process, and by default its whole tree, when it outlives its timeout.</summary>
internal sealed class ProcessRunner : IProcessRunner
{
    public async Task<ProcessResult> RunAsync(string file, IReadOnlyList<string> args, TimeSpan timeout, Action<string>? onLine, CancellationToken ct = default, bool killProcessTree = true)
    {
        var start = new ProcessStartInfo(file)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };
        foreach (var arg in args) start.ArgumentList.Add(arg);

        var output = new StringBuilder();
        var errors = new StringBuilder();
        var gate = new object();

        void Capture(StringBuilder into, string? line)
        {
            if (line is null) return;

            lock (gate)
            {
                into.AppendLine(line);
                onLine?.Invoke(line);
            }
        }

        try
        {
            using var process = new Process { StartInfo = start };
            process.OutputDataReceived += (_, e) => Capture(output, e.Data);
            process.ErrorDataReceived += (_, e) => Capture(errors, e.Data);

            process.Start();
            process.StandardInput.Close();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            using var budget = CancellationTokenSource.CreateLinkedTokenSource(ct);
            budget.CancelAfter(timeout);

            try
            {
                await process.WaitForExitAsync(budget.Token);
            }
            catch (OperationCanceledException)
            {
                process.Kill(entireProcessTree: killProcessTree);
                await process.WaitForExitAsync(CancellationToken.None);

                if (ct.IsCancellationRequested) throw;

                return new ProcessResult(-1, output.ToString(), errors.ToString(), TimedOut: true);
            }

            return new ProcessResult(process.ExitCode, output.ToString(), errors.ToString());
        }
        catch (Win32Exception ex)
        {
            return new ProcessResult(-1, string.Empty, string.Empty, StartFailure: ex.Message.TrimEnd('.'));
        }
    }
}
