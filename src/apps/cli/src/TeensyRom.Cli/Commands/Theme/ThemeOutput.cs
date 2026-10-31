using Spectre.Console;
using Spectre.Console.Rendering;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Themes;

namespace TeensyRom.Cli.Commands.ThemeCommands;

/// <summary>One C64 color as <c>trom theme --json</c> writes it.</summary>
internal sealed record ThemeColorJson(int Index, string Name);

/// <summary>The seven menu colors, keyed as <see cref="ThemeSlots.Key"/> names the slots.</summary>
internal sealed record ThemeColorsJson(
    ThemeColorJson Background,
    ThemeColorJson Border,
    ThemeColorJson Banner,
    ThemeColorJson Time,
    ThemeColorJson Keys,
    ThemeColorJson Sources,
    ThemeColorJson Names);

/// <summary>A theme; <paramref name="Kind"/> is <c>shipped</c> or <c>custom</c>.</summary>
internal sealed record ThemeJson(string Id, string Name, string Kind, ThemeColorsJson Colors);

/// <summary>What a TeensyROM was last given; the theme is named only while the colors still match it.</summary>
internal sealed record DeviceThemeJson(
    string DeviceId,
    string DeviceName,
    bool Online,
    bool Recorded,
    string? ThemeId,
    string? ThemeName,
    DateTimeOffset? AppliedAt,
    ThemeColorsJson Colors);

internal sealed record ThemeRefJson(string Id, string Name);

/// <summary>One device's apply result; <paramref name="Status"/> is <c>applied</c>, <c>busy</c> or <c>failed</c>.</summary>
internal sealed record ThemeApplyDeviceJson(string DeviceId, string DeviceName, string Status, bool Recorded, ThemeColorsJson? Colors, string? Message);

internal sealed record ThemeApplyJson(ThemeRefJson? Theme, IReadOnlyList<ThemeApplyDeviceJson> Devices);

internal sealed record ThemeSaveJson(bool Overwritten, ThemeJson Theme);

internal sealed record ThemeDeleteJson(string Id, string Name);

/// <summary>Maps themes to the CLI's JSON and shows them the way every theme verb does.</summary>
internal static class ThemeOutput
{
    private const string FactoryLabel = "TR Default (factory, no record)";

    public static ThemeColorsJson ToJson(ThemeColors colors) => new(
        Color(colors.Background), Color(colors.Border), Color(colors.Banner), Color(colors.Time),
        Color(colors.Keys), Color(colors.Sources), Color(colors.Names));

    public static ThemeJson ToJson(ThemeDto theme) =>
        new(theme.Id, theme.Name, theme.Kind.ToString().ToLowerInvariant(), ToJson(ThemeColors.From(theme.Parts.Device)));

    /// <summary>The device's record, naming a theme only when the record's theme still has the colors the device was given.</summary>
    public static DeviceThemeJson ToJson(DeviceSummary device, DeviceThemeRecordDto record, IEnumerable<ThemeDto> themes)
    {
        var colors = ThemeColors.From(record.Colors);
        var named = ThemeColors.MatchingTheme(record, themes);

        return new DeviceThemeJson(device.Id, device.Name, device.IsOnline, record.IsRecorded, named?.Id, named?.Name, record.AppliedAt, ToJson(colors));
    }

    public static ThemeApplyDeviceJson ToJson(ThemeApplyOutcome outcome) => new(
        outcome.Device.Id,
        outcome.Device.Name,
        outcome.Status.ToString().ToLowerInvariant(),
        outcome.IsRecorded,
        outcome.Colors is null ? null : ToJson(outcome.Colors),
        outcome.Message);

    public static void ShowList(ICliOutput output, IReadOnlyList<ThemeJson> themes)
    {
        switch (output.Mode)
        {
            case OutputMode.Json:
                output.Json(themes);
                break;
            case OutputMode.Plain:
                output.Lines(themes.Select(theme => theme.Name));
                break;
            default:
                output.Out.Write(Table(
                    ["Name", "Kind"],
                    themes.Select(theme => (IReadOnlyList<string>)[theme.Name, Capitalised(theme.Kind)]),
                    themes.Select(theme => theme.Colors)));
                break;
        }
    }

    public static void ShowDevices(ICliOutput output, IReadOnlyList<DeviceThemeJson> devices)
    {
        switch (output.Mode)
        {
            case OutputMode.Json:
                output.Json(devices);
                break;
            case OutputMode.Plain:
                output.Lines(devices.Select(device => $"{device.DeviceName}: {ThemeLabel(device, "custom colors")}"));
                break;
            default:
                if (devices.Count == 0)
                {
                    output.Notice("tr-web doesn't know any TeensyROM yet.");
                    break;
                }
                output.Out.Write(Table(
                    ["Device", "Theme", "Applied"],
                    devices.Select(device => (IReadOnlyList<string>)
                        [device.DeviceName, ThemeLabel(device, "Custom colors"), device.AppliedAt?.ToLocalTime().ToString("yyyy-MM-dd HH:mm") ?? "-"]),
                    devices.Select(device => device.Colors)));
                break;
        }
    }

    public static void ShowApply(ICliOutput output, ThemeApplyJson result)
    {
        if (output.Mode == OutputMode.Json)
        {
            output.Json(result);
            return;
        }
        output.Lines(result.Devices.Select(device => device.Status switch
        {
            "applied" => $"{device.DeviceName}: applied{(result.Theme is null ? string.Empty : " " + result.Theme.Name)}; the C64 was reset.",
            "busy" => $"{device.DeviceName}: busy with a transfer — try again when it finishes.",
            _ => $"{device.DeviceName}: failed — {device.Message}"
        }));
    }

    /// <summary>One theme: JSON, or its name, kind and colors for a person or a pipe.</summary>
    public static void ShowTheme(ICliOutput output, object json, ThemeJson theme)
    {
        if (output.Mode == OutputMode.Json)
        {
            output.Json(json);
            return;
        }
        var fields = new List<(string Label, string Value)> { ("Name", theme.Name), ("Kind", Capitalised(theme.Kind)) };

        fields.AddRange(Slots(theme.Colors).Select(slot => (ThemeSlots.Label(slot.Slot), slot.Color.Name)));
        output.Fields(fields);
    }

    /// <summary>Without a record the device only shows tr-web's factory fallback, so that is said before any theme name.</summary>
    private static string ThemeLabel(DeviceThemeJson device, string customLabel) =>
        !device.Recorded ? FactoryLabel : device.ThemeName ?? customLabel;

    private static ThemeColorJson Color(int index) => new(index, C64Palette.Get(index).Name);

    private static IEnumerable<(ThemeSlot Slot, ThemeColorJson Color)> Slots(ThemeColorsJson colors) =>
    [
        (ThemeSlot.Background, colors.Background),
        (ThemeSlot.Border, colors.Border),
        (ThemeSlot.Banner, colors.Banner),
        (ThemeSlot.Time, colors.Time),
        (ThemeSlot.Keys, colors.Keys),
        (ThemeSlot.Sources, colors.Sources),
        (ThemeSlot.Names, colors.Names)
    ];

    /// <summary>The leading columns, then the seven slots headed by their keys. Cells are <see cref="Text"/> so a name with brackets stays literal.</summary>
    private static Table Table(string[] leading, IEnumerable<IReadOnlyList<string>> rows, IEnumerable<ThemeColorsJson> colors)
    {
        var table = new Table().BorderColor(RadHelper.Theme.Secondary.Color).Border(TableBorder.Rounded);

        foreach (var header in leading.Concat(ThemeSlots.All.Select(ThemeSlots.Key))) table.AddColumn(header);

        foreach (var (row, rowColors) in rows.Zip(colors))
        {
            table.AddRow(row.Concat(Slots(rowColors).Select(slot => slot.Color.Name)).Select(cell => (IRenderable)new Text(cell)));
        }
        return table;
    }

    private static string Capitalised(string value) => value.Length == 0 ? value : char.ToUpperInvariant(value[0]) + value[1..];
}
