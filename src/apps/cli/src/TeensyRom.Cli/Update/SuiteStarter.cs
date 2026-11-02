using System.Text.Json;

namespace TeensyRom.Cli.Update;

/// <param name="Problem">Why Trom API did not start, as a sentence; null when it did.</param>
internal sealed record SuiteStart(bool Ok, string? Problem);

/// <summary>Starts Trom API after an update.</summary>
internal interface ISuiteStarter
{
    /// <summary>Starts Trom API by running <paramref name="tromPath"/>, the installed trom, which is the new one after an update.</summary>
    Task<SuiteStart> StartEngineAsync(string tromPath, CancellationToken ct = default);
}

/// <summary>
/// Runs <c>&lt;trom&gt; engine start --json</c> as a child process. This process can't do it itself: its engine
/// control only accepts an engine of its own version, and the engine it must start is the new one.
/// </summary>
internal sealed class SuiteStarter(IProcessRunner runner) : ISuiteStarter
{
    /// <summary>Longer than the engine's own start timeout, so the child gives up first and says why.</summary>
    public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(210);

    internal static readonly string[] Arguments = ["engine", "start", "--json"];

    public async Task<SuiteStart> StartEngineAsync(string tromPath, CancellationToken ct = default)
    {
        // Only the child is killed on a timeout or Ctrl+C: its tree can hold the detached engine it has just started.
        var result = await runner.RunAsync(tromPath, Arguments, Timeout, null, ct, killProcessTree: false);

        return result.Succeeded ? new SuiteStart(true, null) : new SuiteStart(false, Problem(result));
    }

    private static string Problem(ProcessResult result)
    {
        if (result.StartFailure is not null || result.TimedOut) return $"Trom API didn't start: {result.Describe()}.";

        var lines = result.StdErr.Split('\n').Select(line => line.Trim()).Where(line => line.Length > 0).ToList();

        return lines.Select(ErrorMessage).LastOrDefault(message => message is not null)
            ?? lines.LastOrDefault()
            ?? $"Trom API didn't start: {result.Describe()}.";
    }

    /// <summary>The <c>message</c> of the JSON error object <c>trom --json</c> ends its stderr with.</summary>
    private static string? ErrorMessage(string line)
    {
        if (!line.StartsWith('{')) return null;

        try
        {
            using var document = JsonDocument.Parse(line);

            return document.RootElement.TryGetProperty("error", out var error) && error.TryGetProperty("message", out var message)
                ? message.GetString()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
