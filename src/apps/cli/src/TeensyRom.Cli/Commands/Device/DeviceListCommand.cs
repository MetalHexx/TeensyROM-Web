using Spectre.Console;
using Spectre.Console.Cli;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Commands.Device;

internal sealed class DeviceListSettings : TromSettings;

/// <summary>
/// <c>trom device list</c> shows the TeensyROMs tr-web already knows; <c>trom device discover</c> scans for new ones first.
/// Both start the engine when none is running, and both succeed with an empty result when tr-web knows none.
/// </summary>
internal sealed class DeviceListCommand(ICliOutput output, IEngineControl engine, IDeviceService devices)
    : EngineCommand<DeviceListSettings>(output, engine)
{
    internal const string DiscoverVerb = "discover";

    protected override async Task<int> RunAsync(CommandContext context, DeviceListSettings settings, CancellationToken ct)
    {
        var found = await devices.FindAsync(fullScan: context.Name == DiscoverVerb, ct);

        switch (Output.Mode)
        {
            case OutputMode.Json:
                Output.Json(found);
                break;
            case OutputMode.Plain:
                Output.Lines(found.Select(device => device.Name));
                break;
            default:
                if (found.Count > 0) Output.Out.Write(ToTable(found));
                break;
        }

        if (found.Count == 0) Output.Notice("No TeensyROM devices found.");

        return 0;
    }

    private static Table ToTable(IReadOnlyList<DeviceSummary> found)
    {
        var table = new Table().BorderColor(RadHelper.Theme.Secondary.Color).Border(TableBorder.Rounded);

        foreach (var header in new[] { "Name", "Id", "State", "Connection", "Online" }) table.AddColumn(header);

        foreach (var device in found)
        {
            table.AddRow(
                new Text(device.Name),
                new Text(device.Id),
                new Text(device.State),
                new Text(device.Connection),
                new Text(device.IsOnline ? "yes" : "no"));
        }
        return table;
    }
}
