using System.Globalization;

namespace TeensyRom.Cli.Themes;

/// <summary>One of the C64's 16 colors. <paramref name="Hex"/> is <c>#RRGGBB</c>.</summary>
internal sealed record C64Color(int Index, string Name, string Hex);

/// <summary>
/// The C64's 16 colors in index order. Mirrors <c>libs/ui/components/src/lib/c64-color/c64-palette.ts</c>, so a change
/// there must be made here too. The hex values are for showing swatches only; the device owns what an index means.
/// </summary>
internal static class C64Palette
{
    public static IReadOnlyList<C64Color> Colors { get; } =
    [
        new(0, "Black", "#000000"),
        new(1, "White", "#FFFFFF"),
        new(2, "Red", "#813338"),
        new(3, "Cyan", "#75CEC8"),
        new(4, "Purple", "#8E3C97"),
        new(5, "Green", "#56AC4D"),
        new(6, "Blue", "#2E2C9B"),
        new(7, "Yellow", "#EDF171"),
        new(8, "Orange", "#8E5029"),
        new(9, "Brown", "#553800"),
        new(10, "Light Red", "#C46C71"),
        new(11, "Dark Grey", "#4A4A4A"),
        new(12, "Medium Grey", "#7B7B7B"),
        new(13, "Light Green", "#A9FF9F"),
        new(14, "Light Blue", "#706DEB"),
        new(15, "Light Grey", "#B2B2B2")
    ];

    /// <summary>The names in lower case and index order, for usage messages.</summary>
    public static string ValidNames { get; } = string.Join(", ", Colors.Select(color => color.Name.ToLowerInvariant()));

    /// <exception cref="ArgumentOutOfRangeException">When <paramref name="index"/> is outside 0..15.</exception>
    public static C64Color Get(int index) =>
        index is >= 0 and < 16 ? Colors[index] : throw new ArgumentOutOfRangeException(nameof(index), index, "A C64 color index is 0 to 15.");

    /// <summary>Reads a color name in any case with surrounding whitespace trimmed (<c>light red</c>), or a whole number 0 to 15.</summary>
    public static bool TryParse(string? text, out C64Color color)
    {
        var trimmed = text?.Trim() ?? "";

        if (int.TryParse(trimmed, NumberStyles.None, CultureInfo.InvariantCulture, out var index) && index < Colors.Count)
        {
            color = Colors[index];
            return true;
        }

        color = Colors.FirstOrDefault(c => c.Name.Equals(trimmed, StringComparison.OrdinalIgnoreCase))!;
        return color is not null;
    }
}
