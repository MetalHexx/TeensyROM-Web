using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Commands.File;

/// <summary>One ban as <c>trom file banned --json</c> lists it; <paramref name="Kind"/> is <c>file</c> or <c>folder</c>.</summary>
internal sealed record BanEntryJson(string Entry, string Kind);

/// <summary>What happened to one entry of a <c>file unban</c> run. Not being banned is ok: <c>Ok = true, Lifted = false</c>.</summary>
internal sealed record UnbanResultJson(string Entry, string Kind, bool Ok, bool Lifted, string Message);

/// <summary><c>trom file banned</c> takes no device: bans are engine-wide.</summary>
internal sealed class FileBannedSettings : TromSettings;

/// <summary>The entries of <c>trom file unban</c>.</summary>
internal sealed class FileUnbanSettings : TromSettings
{
    [CommandArgument(0, "<ENTRIES>")]
    [Description("File names, folder entries as `trom file banned` prints them, or device file paths. Use - to read them from stdin.")]
    public string[] Entries { get; set; } = [];
}

internal static class BanKinds
{
    public static string Name(BanEntryKind kind) => kind == BanEntryKind.Folder ? "folder" : "file";
}

/// <summary>
/// <c>trom file banned</c>: every banned folder, then every banned file name. Piped, stdout carries the entries exactly as
/// stored, one per line, ready for <c>trom file unban -</c>.
/// </summary>
internal sealed class FileBannedCommand(ICliOutput output, IEngineControl engine, IStorageService storage)
    : EngineCommand<FileBannedSettings>(output, engine)
{
    protected override async Task<int> RunAsync(CommandContext context, FileBannedSettings settings, CancellationToken ct)
    {
        var bans = await storage.GetBansAsync(ct);

        switch (Output.Mode)
        {
            case OutputMode.Json:
                Output.Json(bans.Select(ban => new BanEntryJson(ban.Entry, BanKinds.Name(ban.Kind))).ToList());
                break;
            case OutputMode.Plain:
                Output.Lines(bans.Select(ban => ban.Entry));
                break;
            default:
                if (bans.Count == 0)
                {
                    Output.Notice("Nothing is banned.");
                    break;
                }
                var table = new Table().BorderColor(RadHelper.Theme.Secondary.Color).Border(TableBorder.Rounded);

                table.AddColumn("Entry");
                table.AddColumn("Kind");

                foreach (var ban in bans) table.AddRow(new Text(ban.Entry), new Text(BanKinds.Name(ban.Kind)));

                Output.Out.Write(table);
                break;
        }
        return 0;
    }
}

/// <summary>
/// <c>trom file unban &lt;ENTRIES&gt;...</c>: lifts bans. An entry naming a banned folder lifts that folder; any other
/// entry is a file, lifted by its last path segment. An entry that isn't banned is reported, not failed. The exit code
/// follows <see cref="BatchOutcome"/>.
/// </summary>
internal sealed class FileUnbanCommand(ICliOutput output, IEngineControl engine, IStorageService storage, IStdinPaths stdin)
    : EngineCommand<FileUnbanSettings>(output, engine)
{
    protected override async Task<int> RunAsync(CommandContext context, FileUnbanSettings settings, CancellationToken ct)
    {
        var entries = stdin.Expand(settings.Entries);
        var folders = (await storage.GetBansAsync(ct)).Where(ban => ban.Kind == BanEntryKind.Folder).Select(ban => ban.Entry).ToList();

        var results = new List<UnbanResultJson>();
        var failedForOtherReasons = false;

        foreach (var entry in entries)
        {
            var (kind, target) = Resolve(entry, folders);

            try
            {
                var lifted = await storage.LiftBanAsync(target, kind, ct);

                results.Add(new UnbanResultJson(entry, BanKinds.Name(kind), true, lifted.Lifted, lifted.Lifted ? lifted.Message : $"{entry} is not banned."));
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                var mapped = ExitCodeMapper.Map(error);

                results.Add(new UnbanResultJson(entry, BanKinds.Name(kind), false, false, mapped.Message));
                failedForOtherReasons |= mapped.Code != CliExitCode.NotFound;
            }
        }
        Show(results);

        return BatchOutcome.Finish(Output, results.Count, results.Count(result => !result.Ok), failedForOtherReasons, "entries");
    }

    /// <summary>A banned folder is matched exactly as stored (ignoring case and a trailing slash); anything else is a file name.</summary>
    private static (BanEntryKind Kind, string Target) Resolve(string entry, IReadOnlyList<string> bannedFolders)
    {
        var trimmed = entry.Trim().TrimEnd('/');
        var folder = bannedFolders.FirstOrDefault(banned => banned.TrimEnd('/').Equals(trimmed, StringComparison.OrdinalIgnoreCase));

        if (folder is not null) return (BanEntryKind.Folder, folder);

        var name = entry.Trim();

        return (BanEntryKind.File, name[(name.LastIndexOf('/') + 1)..]);
    }

    private void Show(IReadOnlyList<UnbanResultJson> results)
    {
        switch (Output.Mode)
        {
            case OutputMode.Json:
                Output.Json(results);
                break;
            case OutputMode.Plain:
                Output.Lines(results.Where(result => result.Lifted).Select(result => result.Entry));
                foreach (var result in results.Where(result => !result.Lifted)) Output.Notice(result.Ok ? result.Message : $"{result.Entry}: {result.Message}");
                break;
            default:
                var table = new Table().BorderColor(RadHelper.Theme.Secondary.Color).Border(TableBorder.Rounded);

                table.AddColumn("Entry");
                table.AddColumn("Result");

                foreach (var result in results) table.AddRow(new Text(result.Entry), new Text(result.Ok ? result.Message : $"Failed: {result.Message}"));

                Output.Out.Write(table);
                break;
        }
    }
}
