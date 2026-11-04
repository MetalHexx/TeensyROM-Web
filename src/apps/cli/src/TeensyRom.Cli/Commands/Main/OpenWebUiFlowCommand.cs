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

            var addresses = new List<string> { $"On this computer: {report.Address}" };

            for (var i = 0; i < report.NetworkAddresses.Count; i++)
            {
                addresses.Add($"On your network: {report.NetworkAddresses[i]}");
                if (i < report.SecureNetworkAddresses.Count) addresses.Add($"Secure, for MIDI and video: {report.SecureNetworkAddresses[i]}");
            }

            RadHelper.WriteMenu("Trom UI", report.Opened ? "Opened in your browser." : $"Couldn't open a browser — open {report.Address} yourself.", addresses.ToArray());
            if (report.Https?.Notice is { } notice) RadHelper.WriteLine(notice);
            return 0;
        }
    }
}
