using Spectre.Console.Cli;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;

namespace TeensyRom.Cli.Commands.Engine;

internal sealed class EngineStatusSettings : TromSettings;

/// <summary>
/// <c>trom engine status</c>: says whether a TeensyROM engine answers and whether its version matches this CLI's.
/// Looks only; it never starts, restarts or stops anything. Exits 3 when no engine answers.
/// </summary>
internal sealed class EngineStatusCommand(ICliOutput output, IEngineControl engine) : TromCommand<EngineStatusSettings>(output)
{
    protected override async Task<int> RunAsync(CommandContext context, EngineStatusSettings settings, CancellationToken ct)
    {
        var status = await engine.GetStatusAsync(ct);

        if (Output.Mode == OutputMode.Json) Output.Json(status);
        else Output.Fields(Describe(status));

        if (!status.Running) throw new CliException(CliExitCode.EngineUnavailable, status.Problem ?? "No Trom API is running.");

        if (!status.Matches)
        {
            Output.Notice($"The running Trom API is version {status.Version} but this CLI is {status.CliVersion} — the next command that needs Trom API restarts it.");
        }
        if (status.Https?.Notice is { } notice) Output.Notice(notice);
        return 0;
    }

    /// <summary>The secure-address and certificate-expiry rows for an engine that reported HTTPS; empty otherwise.</summary>
    internal static IEnumerable<(string Label, string Value)> DescribeHttps(EngineHttps? https)
    {
        if (https is null) yield break;

        yield return ("Secure address", https.Listening
            ? $"https://localhost:{https.Port}"
            : $"not available — {https.Problem}");

        if (https.ExpiresAt is { } expiresAt) yield return ("Certificate expires", expiresAt.ToString("yyyy-MM-dd"));
    }

    internal static IReadOnlyList<(string Label, string Value)> Describe(EngineStatus status)
    {
        List<(string Label, string Value)> rows = status.Running
            ?
            [
                ("Status", "running"),
                ("Address", status.Address),
                ("Trom API version", status.Version ?? string.Empty),
                ("CLI version", status.CliVersion),
                ("Version match", status.Matches ? "yes" : "no")
            ]
            :
            [
                ("Status", "not running"),
                ("Address", status.Address),
                ("CLI version", status.CliVersion)
            ];

        rows.AddRange(DescribeHttps(status.Https));
        if (status.LogFolder is not null) rows.Add(("Log folder", status.LogFolder));
        if (status.LogFile is not null) rows.Add(("Log file", status.LogFile));

        return rows;
    }
}
