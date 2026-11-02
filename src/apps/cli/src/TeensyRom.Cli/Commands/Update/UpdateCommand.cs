using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Commands.Update;

internal sealed class UpdateSettings : TromSettings
{
    [Description("Only look for a newer release; install nothing. Exits 0 when the lookup worked, whether or not one is out.")]
    [CommandOption("--check")]
    public bool Check { get; set; }

    [Description("Install without asking. Trom API stops during the update, which ends any transfer or playback. Required when there is no terminal to ask in.")]
    [CommandOption("-y|--yes")]
    public bool Yes { get; set; }
}

/// <summary>
/// What <c>trom update --json</c> writes: the status of the lookup, then, for an install attempt, whether it updated and,
/// when it did, what changed. <c>--check</c> writes the status alone.
/// </summary>
/// <param name="Updated">Absent for <c>--check</c>; false when no newer release was out.</param>
/// <param name="From">The version before the update.</param>
/// <param name="To">The version after it.</param>
internal sealed record UpdateDocument(
    string Installed,
    string? Latest,
    bool Available,
    InstallKind InstallKind,
    DateTimeOffset? CheckedAt,
    bool? Updated = null,
    string? From = null,
    string? To = null,
    bool? EngineWasRunning = null,
    bool? EngineRestarted = null,
    string? RestartProblem = null)
{
    public static UpdateDocument Of(UpdateStatus status) =>
        new(status.Installed, status.Latest, status.Available, status.InstallKind, status.CheckedAt);

    public static UpdateDocument NothingNewer(UpdateStatus status) => Of(status) with { Updated = false };

    /// <summary>The status as it stands after the update: the installed version is the one just installed.</summary>
    public static UpdateDocument After(UpdateStatus before, UpdateApplied applied)
    {
        var behind = SemVersion.TryParse(before.Latest, out var latest) && SemVersion.TryParse(applied.To, out var installed) && latest > installed;

        return new UpdateDocument(
            applied.To, before.Latest, behind, before.InstallKind, before.CheckedAt,
            Updated: true, From: applied.From, To: applied.To,
            EngineWasRunning: applied.EngineWasRunning, EngineRestarted: applied.EngineRestarted, RestartProblem: applied.RestartProblem);
    }
}

/// <summary>
/// <c>trom update</c>: looks up the newest release and, when it is newer, installs it after asking (unless --yes). It
/// stops Trom API for the swap and starts it again afterwards, so it needs neither the engine nor a device. A
/// Homebrew install updates through brew; a source build is refused. <c>--check</c> only looks.
/// </summary>
internal sealed class UpdateCommand(ICliOutput output, IUpdateRunner updates) : TromCommand<UpdateSettings>(output)
{
    protected override async Task<int> RunAsync(CommandContext context, UpdateSettings settings, CancellationToken ct)
    {
        var check = await UpdateWork.CheckAsync(Output, updates);
        var status = check.Status;

        if (settings.Check)
        {
            Show(UpdateDocument.Of(status), UpdateWork.Describe(status));
            return 0;
        }

        if (!status.Available)
        {
            Show(UpdateDocument.NothingNewer(status), UpdateWork.Describe(status));
            return 0;
        }

        // A source build or an unknown install is refused by the update itself, with the reason; asking first would only mislead.
        if (status.InstallKind is InstallKind.Release or InstallKind.Homebrew && !settings.Yes) Confirm(status);

        var applied = await UpdateWork.ApplyAsync(Output, updates, check);

        if (Output.Mode == OutputMode.Json) Output.Json(UpdateDocument.After(status, applied));
        else Output.Notice(UpdateWork.Result(applied));

        if (UpdateWork.RestartNotice(applied) is { } notice) Output.Notice(notice);

        return 0;
    }

    private void Show(UpdateDocument document, string sentence)
    {
        if (Output.Mode == OutputMode.Json) Output.Json(document);
        else Output.Notice(sentence);
    }

    /// <exception cref="CliException"><see cref="CliExitCode.Failed"/> when declined; <see cref="CliExitCode.Usage"/> when there is no terminal to ask in.</exception>
    private void Confirm(UpdateStatus status)
    {
        if (!Output.CanPrompt) throw new CliException(CliExitCode.Usage, "Pass --yes to update without a terminal to confirm it.");

        var question = $"Update TeensyROM Suite from {status.Installed} to {status.Latest}? Trom API stops during the update, which ends any transfer or playback. It starts again if it was running.";

        if (!Output.Err.Confirm(Markup.Escape(question), defaultValue: true))
        {
            throw new CliException(CliExitCode.Failed, "Cancelled; nothing was changed.");
        }
    }
}
