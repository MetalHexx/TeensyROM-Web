using Spectre.Console.Cli;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Commands.Main
{
    internal class StopSettings : CommandSettings
    {
        public static string Example => "stop";
        public static string Description => "Stop the TeensyROM engine";
    }

    internal class StopCommand(IEngineControl engine, IPlayerService player) : AsyncCommand<StopSettings>
    {
        public override async Task<int> ExecuteAsync(CommandContext context, StopSettings settings)
        {
            player.StopStream();

            switch (await engine.StopAsync(CancellationToken.None))
            {
                case EngineStopOutcome.Stopped:
                    RadHelper.WriteLine("TeensyROM engine stopped. The web app it served has stopped too.");
                    return 0;
                case EngineStopOutcome.NotRunning:
                    RadHelper.WriteLine("No TeensyROM engine is running.");
                    return 0;
                case EngineStopOutcome.NotSupported:
                    RadHelper.WriteError("The running TeensyROM engine can't be stopped from the CLI — stop it where it was started.");
                    return 1;
                case EngineStopOutcome.Foreign:
                    RadHelper.WriteError($"Something other than a TeensyROM engine is using port {EngineAddress.Port}.");
                    return 1;
                default:
                    RadHelper.WriteError($"The TeensyROM engine didn't stop within {EngineControl.StopTimeout.TotalSeconds:0} seconds. Its logs are in {TeensyRomHome.EngineLogsPath}.");
                    return 1;
            }
        }
    }
}
