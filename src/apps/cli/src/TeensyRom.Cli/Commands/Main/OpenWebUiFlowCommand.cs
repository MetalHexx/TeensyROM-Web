using Spectre.Console.Cli;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.WebUi;

namespace TeensyRom.Cli.Commands.Main
{
    internal class OpenWebUiSettings : CommandSettings
    {
    }

    /// <summary>The menu's "Open Trom UI": opens it in the browser and lists where it answers. The menu has readied the engine.</summary>
    internal class OpenWebUiFlowCommand(UiLauncher launcher) : AsyncCommand<OpenWebUiSettings>
    {
        public override async Task<int> ExecuteAsync(CommandContext context, OpenWebUiSettings settings)
        {
            var report = await launcher.OpenAsync(open: true);

            if (!report.Available)
            {
                RadHelper.WriteError(report.Problem!);
                return 1;
            }

            var addresses = new[] { $"On this computer: {report.Address}" }
                .Concat(report.NetworkAddresses.Select(address => $"On your network: {address}"))
                .ToArray();

            RadHelper.WriteMenu("Trom UI", report.Opened ? "Opened in your browser." : $"Couldn't open a browser — open {report.Address} yourself.", addresses);
            return 0;
        }
    }
}
