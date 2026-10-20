using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Helpers;

namespace TeensyRom.Cli.Commands.Common;

/// <summary>
/// What every <c>trom</c> command accepts. Options live on the verb's own settings, never on a branch: Spectre
/// does not bind a branch's options when they follow the verb.
/// </summary>
internal class TromSettings : CommandSettings
{
    [Description("Write the result as JSON on stdout.")]
    [CommandOption("--json")]
    public bool Json { get; set; }
}

/// <summary>A command that works with one TeensyROM.</summary>
internal class DeviceSettings : TromSettings
{
    [Description("The TeensyROM to use, by name or id. Chosen for you when only one is online.")]
    [CommandOption("-d|--device <DEVICE>")]
    public string? Device { get; set; }
}

/// <summary>A command that works with one TeensyROM's storage.</summary>
internal class StorageSettings : DeviceSettings
{
    [Description("The storage to use: sd or usb. Defaults to the storage saved in your settings.")]
    [CommandOption("-s|--storage <STORAGE>")]
    public string? Storage { get; set; }

    public override ValidationResult Validate() =>
        Storage is null ? base.Validate() : Storage.ValidateStorageDevice();
}
