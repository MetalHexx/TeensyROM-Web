using Spectre.Console;
using Spectre.Console.Cli;
using System.Diagnostics;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Fonts;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Services;
public class Program
{
    private static async Task<int> Main(string[] args)
    {
        AnsiConsole.WriteLine();
        RadHelper.RenderLogo("TeensyROM", FontConstants.FontPath);

        var host = CliHost.Create();
        var app = CliHost.CreateApp(new TypeRegistrar(host.Services));
        var session = new CliSession(app, host.Gate);
        var interactive = AnsiConsole.Profile.Capabilities.Interactive;

        if (!await session.EnsureReadyForAsync(args))
        {
            return 1;
        }

        var resultCode = 0;

        while (true)
        {
            try
            {
                if (CommandRouting.IsHelpOrVersion(args))
                {
                    app.Run(args);
                    return -99;
                }

                if (args.Length > 0)
                {
                    var help = args.ToList();
                    help.Add("-h");
                    AnsiConsole.WriteLine();

                    resultCode = app.Run(help.ToArray());
                    resultCode = await session.RunCommandAsync(args);
                    args = [];

                    if (!interactive) return resultCode;
                }
                else if (!interactive)
                {
                    app.Run(["-h"]);
                    return 0;
                }

                var menuChoice = PromptHelper.ChoicePrompt("Choose wisely", ["Launch", "Settings", "Index Files", "List Ports", "Generate ASID Patches", "Credits", "Stop Engine", "Leave"]);

                AnsiConsole.WriteLine();

                if (menuChoice == "Leave") return 0;

                args = menuChoice switch
                {
                    "Launch" => ["launch"],
                    "Index Files" => ["index"],
                    "Settings" => ["settings"],
                    "List Ports" => ["ports"],
                    "Generate ASID Patches" => ["chipsynth"],
                    "Credits" => ["credits"],
                    "Stop Engine" => ["stop"],
                    _ => []
                };

                if (!await session.EnsureReadyForAsync(args))
                {
                    return 1;
                }
                await session.RunCommandAsync(args);

                args = [];
            }
            catch(CommandParseException ex)
            {
                RadHelper.WriteError(ex.Message);
                AnsiConsole.WriteLine();
                args = ["-h"];
            }
            catch (TeensyApiException ex)
            {
                RadHelper.WriteError(ex.Message);
                args = [];

                if (!interactive) return 1;
                continue;
            }
            catch (Exception ex)
            {
                AnsiConsole.WriteException(ex, ExceptionFormats.Default);
                LogExceptionToFile(ex);

                if (!interactive) return 1;
                continue;
            }
            if (resultCode == -1) return resultCode;
        }
    }

    private static readonly object _logFileLock = new object();

    private static void LogExceptionToFile(Exception ex)
    {
        string filePath = Path.Combine(TeensyRomHome.CliLogsPath, "UnhandledErrorLogs.txt");

        if (!Directory.Exists(Path.GetDirectoryName(filePath)))
        {
            Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
        }

        try
        {
            lock (_logFileLock)
            {
                File.AppendAllText(filePath, $"{DateTime.Now}{Environment.NewLine}Exception: {ex}{Environment.NewLine}{Environment.NewLine}");
            }
        }
        catch (Exception logEx)
        {
            Debug.WriteLine("Failed to log exception: " + logEx.Message);
        }
    }
}
