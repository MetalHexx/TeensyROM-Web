using Spectre.Console.Cli;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Commands.Device;
using TeensyRom.Cli.Commands.Engine;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Update;
using TeensyRom.Cli.WebUi;

namespace TeensyRom.Cli.Commands.Init;

internal sealed class InitSettings : TromSettings;

internal sealed record InitTrom(string Version);

internal sealed record InitEngine(bool Running, string? Version, bool Matches, string Address, EngineHttps? Https = null);

internal sealed record InitWebUi(string Address, bool Available);

/// <summary>Whether a newer release is out, as <c>trom update --check</c> reports it; <see cref="Latest"/> is absent when checking is off or the lookup failed.</summary>
internal sealed record InitUpdate(string Installed, string? Latest, bool Available, InstallKind InstallKind, DateTimeOffset? CheckedAt)
{
    public static InitUpdate From(UpdateStatus status) =>
        new(status.Installed, status.Latest, status.Available, status.InstallKind, status.CheckedAt);
}

internal sealed record InitCommandInfo(string Name, string Description);

/// <summary>Everything <c>trom init</c> reports, in the shape of its <c>--json</c> output.</summary>
internal sealed record InitReport(
    InitTrom Trom,
    InitEngine Engine,
    InitWebUi WebUi,
    InitUpdate Update,
    IReadOnlyList<DeviceSummary> Devices,
    IReadOnlyList<InitCommandInfo> Commands,
    IReadOnlyList<string> Capabilities,
    IReadOnlyList<string> Problems);

/// <summary>
/// <c>trom init</c>: one read-only report of versions, whether a newer release is out, engine, web UI, devices, commands,
/// capabilities and problems. It starts or replaces the engine like any engine command, but a failed start is part of
/// the report, not an error raised first: the report is written and only then does the command exit 3. It never resets,
/// reconnects, indexes or changes settings. The release lookup runs while the engine starts and never holds the report
/// up for more than a few seconds.
/// </summary>
internal sealed class InitCommand(ICliOutput output, IEngineControl engine, IDeviceService devices, IWebUiProbe webUi, IEngineLocator locator, IReleaseCheck releases)
    : TromCommand<InitSettings>(output)
{
    private const string WebUiAddress = EngineAddress.BaseUrl + "/";
    private const string EngineNotRunning = "No Trom API is running.";

    private static readonly TimeSpan ReleaseLookupBudget = TimeSpan.FromSeconds(3);

    protected override async Task<int> RunAsync(CommandContext context, InitSettings settings, CancellationToken ct)
    {
        var release = releases.CurrentAsync(ReleaseLookupBudget, ct);
        var ready = await engine.EnsureRunningAsync(ct);
        var status = await engine.GetStatusAsync(ct);
        var problems = new List<string>();

        if (!ready.Ok) problems.Add(ready.FailureMessage ?? EngineNotRunning);

        IReadOnlyList<DeviceSummary> found = [];

        if (status.Running)
        {
            if (ready.Ok && !status.Matches)
            {
                problems.Add($"The running Trom API is version {status.Version} but this CLI is {status.CliVersion} — the next command that needs Trom API restarts it.");
            }
            found = await FindDevicesAsync(problems, ct);
        }
        else if (ready.Ok)
        {
            problems.Add(status.Problem ?? EngineNotRunning);
        }

        var webUiAvailable = status.Running && await webUi.IsServingAsync(ct);

        if (status.Running && !webUiAvailable) problems.Add(WebUiDiagnosis.Problem(locator));
        var report = new InitReport(
            new InitTrom(status.CliVersion),
            new InitEngine(status.Running, status.Version, status.Matches, EngineAddress.BaseUrl, status.Https),
            new InitWebUi(WebUiAddress, webUiAvailable),
            InitUpdate.From(await release),
            found,
            Commands(),
            Capabilities(),
            problems);

        Write(report);

        if (!ready.Ok) throw new CliException(CliExitCode.EngineUnavailable, ready.FailureMessage ?? "Trom API isn't running.");

        return 0;
    }

    /// <summary>Every noun, then every top-level command, each with its description.</summary>
    internal static IReadOnlyList<InitCommandInfo> Commands() =>
    [
        .. CliHost.PublicTree.Select(noun => new InitCommandInfo(noun.Name, noun.Description)),
        .. CliHost.PublicCommands.Select(command => new InitCommandInfo(command.Name, command.Description))
    ];

    /// <summary>Every <c>noun verb</c> of the tree, then every top-level command name.</summary>
    internal static IReadOnlyList<string> Capabilities() =>
    [
        .. CliHost.PublicTree.SelectMany(noun => noun.Verbs.Select(verb => $"{noun.Name} {verb.Name}")),
        .. CliHost.PublicCommands.Select(command => command.Name)
    ];

    private async Task<IReadOnlyList<DeviceSummary>> FindDevicesAsync(List<string> problems, CancellationToken ct)
    {
        IReadOnlyList<DeviceSummary> found;

        try
        {
            found = await devices.FindAsync(fullScan: false, ct);
        }
        catch (TeensyApiException ex)
        {
            problems.Add($"Couldn't list the TeensyROM devices: {ex.Message}");
            return [];
        }

        var online = found.Where(device => device.IsOnline).ToList();

        if (online.Count == 0) problems.Add("No TeensyROM is online.");

        foreach (var device in online)
        {
            if (device.SdAvailable && !device.SdIndexed) problems.Add(NotIndexed(device, "sd"));
            if (device.UsbAvailable && !device.UsbIndexed) problems.Add(NotIndexed(device, "usb"));
        }
        return found;
    }

    private static string NotIndexed(DeviceSummary device, string storage)
    {
        var name = device.Name.Any(char.IsWhiteSpace) ? $"\"{device.Name}\"" : device.Name;

        return $"{device.Name}'s {storage.ToUpperInvariant()} storage isn't fully indexed — run `trom index build --device {name} --storage {storage}`.";
    }

    private static string DescribeUpdate(InitUpdate update) => update switch
    {
        { Available: true, Latest: { } latest } => $"{latest} is out — run `trom update`",
        { Latest: not null } => "up to date",
        { InstallKind: InstallKind.Source or InstallKind.Unknown } => "not checked",
        _ => "unknown"
    };

    private void Write(InitReport report)
    {
        if (Output.Mode == OutputMode.Json)
        {
            Output.Json(report);
            if (report.Engine.Https?.Notice is { } jsonNotice) Output.Notice(jsonNotice);
            return;
        }

        List<(string Label, string Value)> fields =
        [
            ("TROM version", report.Trom.Version),
            ("Trom API", report.Engine.Running ? "running" : "not running"),
            ("Trom API address", report.Engine.Address),
            ("Trom API version", report.Engine.Version ?? string.Empty),
            ("Version match", report.Engine.Running ? (report.Engine.Matches ? "yes" : "no") : string.Empty),
            .. EngineStatusCommand.DescribeHttps(report.Engine.Https),
            ("Trom UI", report.WebUi.Available ? "available" : "not available"),
            ("Trom UI address", report.WebUi.Address),
            ("Update", DescribeUpdate(report.Update))
        ];

        if (Output.Mode == OutputMode.Plain)
        {
            fields.AddRange(report.Devices.Select(device => ("Device", $"{device.Name} ({device.State}, {(device.IsOnline ? "online" : "offline")}, {device.Connection})")));
            fields.AddRange(report.Commands.Select(command => ("Command", command.Name)));
            fields.AddRange(report.Problems.Select(problem => ("Problem", problem)));
            Output.Fields(fields);
            if (report.Engine.Https?.Notice is { } plainNotice) Output.Notice(plainNotice);
            return;
        }

        Output.Fields(fields);
        if (report.Devices.Count > 0) Output.Out.Write(DeviceListCommand.ToTable(report.Devices));
        if (report.Engine.Https?.Notice is { } notice) Output.Notice(notice);
        foreach (var problem in report.Problems) Output.Notice(problem);
    }
}
