using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Themes;

namespace TeensyRom.Cli.Commands.ThemeCommands;

/// <summary>A verb that can change any of the seven menu colors with one flag per slot.</summary>
internal class ThemeColorSettings : DeviceSettings
{
    [CommandOption("--background <COLOR>")]
    [Description("A C64 color by name or 0-15.")]
    public string? Background { get; set; }

    [CommandOption("--border <COLOR>")]
    [Description("A C64 color by name or 0-15.")]
    public string? Border { get; set; }

    [CommandOption("--banner <COLOR>")]
    [Description("A C64 color by name or 0-15.")]
    public string? Banner { get; set; }

    [CommandOption("--time <COLOR>")]
    [Description("A C64 color by name or 0-15.")]
    public string? Time { get; set; }

    [CommandOption("--keys <COLOR>")]
    [Description("A C64 color by name or 0-15.")]
    public string? Keys { get; set; }

    [CommandOption("--sources <COLOR>")]
    [Description("A C64 color by name or 0-15.")]
    public string? Sources { get; set; }

    [CommandOption("--names <COLOR>")]
    [Description("A C64 color by name or 0-15.")]
    public string? Names { get; set; }

    /// <summary>The slots given on the command line, as C64 color indexes. Complete once <see cref="Validate"/> has passed.</summary>
    public IReadOnlyDictionary<ThemeSlot, int> Overrides()
    {
        var overrides = new Dictionary<ThemeSlot, int>();

        foreach (var slot in ThemeSlots.All)
        {
            if (Flag(slot) is { } value && C64Palette.TryParse(value, out var color)) overrides[slot] = color.Index;
        }
        return overrides;
    }

    public override ValidationResult Validate()
    {
        foreach (var slot in ThemeSlots.All)
        {
            if (Flag(slot) is { } value && !C64Palette.TryParse(value, out _))
            {
                return ValidationResult.Error(
                    $"--{ThemeSlots.Key(slot)} must be one of the C64's 16 colors ({C64Palette.ValidNames}) or a number from 0 to 15, not '{value}'.");
            }
        }
        return base.Validate();
    }

    private string? Flag(ThemeSlot slot) => slot switch
    {
        ThemeSlot.Background => Background,
        ThemeSlot.Border => Border,
        ThemeSlot.Banner => Banner,
        ThemeSlot.Time => Time,
        ThemeSlot.Keys => Keys,
        ThemeSlot.Sources => Sources,
        ThemeSlot.Names => Names,
        _ => throw new ArgumentOutOfRangeException(nameof(slot), slot, null)
    };
}

internal sealed class ThemeApplySettings : ThemeColorSettings
{
    [CommandArgument(0, "[THEME]")]
    [Description("The theme to apply, by name or id, as `trom theme list` shows it. Without one, the color flags change each TeensyROM's current colors.")]
    public string? Theme { get; set; }

    public override ValidationResult Validate()
    {
        var result = base.Validate();

        if (!result.Successful) return result;

        return string.IsNullOrWhiteSpace(Theme) && Overrides().Count == 0
            ? ValidationResult.Error("Name a theme, or give at least one color flag such as --border blue.")
            : result;
    }
}

internal sealed class ThemeSaveSettings : ThemeColorSettings
{
    [CommandArgument(0, "<NAME>")]
    [Description("The name of the custom theme to save.")]
    public string Name { get; set; } = string.Empty;

    [CommandArgument(1, "[BASE]")]
    [Description("The theme whose colors to start from, by name or id. Without one, a TeensyROM's current colors are the start.")]
    public string? Base { get; set; }

    [CommandOption("--overwrite")]
    [Description("Replace the colors of a custom theme that already has this name.")]
    public bool Overwrite { get; set; }

    public override ValidationResult Validate()
    {
        var result = base.Validate();

        if (!result.Successful) return result;
        if (string.IsNullOrWhiteSpace(Name)) return ValidationResult.Error("Give the theme a name.");
        if (!string.IsNullOrWhiteSpace(Base) && !string.IsNullOrWhiteSpace(Device)) return ValidationResult.Error("Give a base theme or --device, not both.");

        return result;
    }
}

internal sealed class ThemeShowSettings : DeviceSettings;

internal sealed class ThemeListSettings : TromSettings;

internal sealed class ThemeDeleteSettings : TromSettings
{
    [CommandArgument(0, "<NAME>")]
    [Description("The custom theme to delete, by name or id, as `trom theme list` shows it.")]
    public string Name { get; set; } = string.Empty;

    [CommandOption("-y|--yes")]
    [Description("Delete without asking. Required when there is no terminal to ask in.")]
    public bool Yes { get; set; }
}
