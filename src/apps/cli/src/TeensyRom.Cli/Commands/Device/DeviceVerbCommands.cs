using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Commands.Device;

/// <summary>A device verb's JSON result when tr-web answers with a message alone.</summary>
internal sealed record DeviceMessage(string Device, string Message);

/// <summary>
/// A verb that acts on one device chosen from the devices in <see cref="Scope"/>, and answers with the device afterwards
/// or with tr-web's message.
/// </summary>
internal abstract class DeviceVerbCommand<T>(ICliOutput output, IEngineControl engine, IDeviceChooser chooser, IDeviceService devices)
    : EngineCommand<T>(output, engine) where T : DeviceSettings
{
    protected IDeviceService Devices { get; } = devices;

    /// <summary>Which devices the verb can act on: <see cref="DeviceScope.Known"/> reaches an offline one.</summary>
    protected abstract DeviceScope Scope { get; }

    protected sealed override async Task<int> RunAsync(CommandContext context, T settings, CancellationToken ct)
    {
        var device = await chooser.ChooseAsync(settings.Device, Scope, ct);

        await ActAsync(device, settings, ct);

        return 0;
    }

    protected abstract Task ActAsync(DeviceSummary device, T settings, CancellationToken ct);

    protected void WriteDevice(DeviceSummary device)
    {
        if (Output.Mode == OutputMode.Json)
        {
            Output.Json(device);
            return;
        }
        Output.Fields(
        [
            ("Name", device.Name),
            ("Id", device.Id),
            ("State", device.State),
            ("Connection", device.Connection),
            ("Online", device.IsOnline ? "yes" : "no"),
            ("SD", device.SdAvailable ? "available" : "not available"),
            ("USB", device.UsbAvailable ? "available" : "not available")
        ]);
    }

    protected void WriteMessage(DeviceSummary device, string message)
    {
        if (Output.Mode == OutputMode.Json) Output.Json(new DeviceMessage(device.Id, message));
        else Output.Lines([message]);
    }
}

/// <summary>A verb on an online device whose result is tr-web's message.</summary>
internal abstract class OnlineDeviceMessageCommand(ICliOutput output, IEngineControl engine, IDeviceChooser chooser, IDeviceService devices)
    : DeviceVerbCommand<DeviceSettings>(output, engine, chooser, devices)
{
    protected sealed override DeviceScope Scope => DeviceScope.Online;

    protected abstract Task<string> CallAsync(string deviceId, CancellationToken ct);

    protected sealed override async Task ActAsync(DeviceSummary device, DeviceSettings settings, CancellationToken ct) =>
        WriteMessage(device, await CallAsync(device.Id, ct));
}

/// <summary><c>trom device reconnect</c>: reconnects a device, offline ones included, and shows it afterwards.</summary>
internal sealed class DeviceReconnectCommand(ICliOutput output, IEngineControl engine, IDeviceChooser chooser, IDeviceService devices)
    : DeviceVerbCommand<DeviceSettings>(output, engine, chooser, devices)
{
    protected override DeviceScope Scope => DeviceScope.Known;

    protected override async Task ActAsync(DeviceSummary device, DeviceSettings settings, CancellationToken ct) =>
        WriteDevice(await Devices.ReconnectDeviceAsync(device.Id, ct));
}

internal sealed class DeviceRenameSettings : DeviceSettings
{
    [CommandArgument(0, "<NAME>")]
    [Description("The new name for the TeensyROM.")]
    public string Name { get; set; } = string.Empty;

    public override ValidationResult Validate() =>
        string.IsNullOrWhiteSpace(Name) ? ValidationResult.Error("The new name can't be empty.") : base.Validate();
}

/// <summary><c>trom device rename &lt;NAME&gt;</c>: renames a device, offline ones included, and shows it under its new name.</summary>
internal sealed class DeviceRenameCommand(ICliOutput output, IEngineControl engine, IDeviceChooser chooser, IDeviceService devices)
    : DeviceVerbCommand<DeviceRenameSettings>(output, engine, chooser, devices)
{
    protected override DeviceScope Scope => DeviceScope.Known;

    protected override async Task ActAsync(DeviceSummary device, DeviceRenameSettings settings, CancellationToken ct) =>
        WriteDevice(await Devices.RenameDeviceAsync(device.Id, settings.Name.Trim(), ct));
}

/// <summary><c>trom device forget</c>: makes tr-web forget a device, offline ones included.</summary>
internal sealed class DeviceForgetCommand(ICliOutput output, IEngineControl engine, IDeviceChooser chooser, IDeviceService devices)
    : DeviceVerbCommand<DeviceSettings>(output, engine, chooser, devices)
{
    protected override DeviceScope Scope => DeviceScope.Known;

    protected override async Task ActAsync(DeviceSummary device, DeviceSettings settings, CancellationToken ct) =>
        WriteMessage(device, await Devices.ForgetDeviceAsync(device.Id, ct));
}

/// <summary><c>trom device ping</c>: checks that an online device answers.</summary>
internal sealed class DevicePingCommand(ICliOutput output, IEngineControl engine, IDeviceChooser chooser, IDeviceService devices)
    : OnlineDeviceMessageCommand(output, engine, chooser, devices)
{
    protected override Task<string> CallAsync(string deviceId, CancellationToken ct) => Devices.PingDeviceAsync(deviceId, ct);
}

/// <summary><c>trom device reset</c>: resets an online device, which stops whatever it is running.</summary>
internal sealed class DeviceResetCommand(ICliOutput output, IEngineControl engine, IDeviceChooser chooser, IDeviceService devices)
    : OnlineDeviceMessageCommand(output, engine, chooser, devices)
{
    protected override Task<string> CallAsync(string deviceId, CancellationToken ct) => Devices.ResetDeviceAsync(deviceId, ct);
}
