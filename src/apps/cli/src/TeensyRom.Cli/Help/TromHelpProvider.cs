using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Help;
using Spectre.Console.Rendering;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Helpers;

namespace TeensyRom.Cli.Help;

/// <summary>
/// Spectre's help, with <c>trom</c>'s own header and footer on the root page only. Spectre has no root-description
/// setting, so the description, the menu note, the <c>--json</c> note and the exit-code table live here.
/// </summary>
internal sealed class TromHelpProvider(ICommandAppSettings settings) : HelpProvider(settings)
{
    private static readonly (CliExitCode Code, string Meaning)[] ExitCodes =
    [
        (CliExitCode.Success, "success"),
        (CliExitCode.Failed, "the command failed"),
        (CliExitCode.Usage, "usage error: unknown command or option, or an invalid value"),
        (CliExitCode.EngineUnavailable, "the TeensyROM engine is not running or did not answer"),
        (CliExitCode.NoDevice, "no TeensyROM is online, or the one you named is offline"),
        (CliExitCode.NotFound, "the device, file or directory was not found")
    ];

    public override IEnumerable<IRenderable> GetHeader(ICommandModel model, ICommandInfo? command)
    {
        if (command is not null) return base.GetHeader(model, command);

        return
        [
            new Text("trom: control your TeensyROM from the command line."),
            Text.NewLine,
            Text.NewLine,
            new Text("Run trom with no arguments to open the interactive menu. Every command takes --json to write its result as JSON on stdout; messages and errors go to stderr."),
            Text.NewLine,
            Text.NewLine
        ];
    }

    public override IEnumerable<IRenderable> GetFooter(ICommandModel model, ICommandInfo? command)
    {
        if (command is not null) return base.GetFooter(model, command);

        var heading = new Text("EXIT CODES:", new Style(foreground: RadHelper.Theme.Secondary.Color));
        var codes = string.Join("\n", ExitCodes.Select(exit => $"    {(int)exit.Code}  {exit.Meaning}"));

        return [Text.NewLine, heading, Text.NewLine, new Text(codes), Text.NewLine];
    }
}
