using System.Text;
using System.Text.RegularExpressions;

namespace TeensyRom.Core.Themes;

/// <summary>
/// Where theme files live under the engine's home. Shipped themes sit in a folder the asset sync replaces on every
/// version change; custom themes and device records sit under System, which the sync never touches.
/// </summary>
public static class ThemePaths
{
    public const string Extension = ".json";
    public static readonly string ShippedFolder = Path.Combine("Assets", "Themes");
    public static readonly string CustomFolder = Path.Combine("Assets", "System", "Themes", "Custom");
    public static readonly string DeviceRecordsFile = Path.Combine("Assets", "System", "Themes", "device-records.json");
}

/// <summary>The only shape an id may take before it is used to build a path, and how an id comes from a name.</summary>
public static partial class ThemeIds
{
    public const int MaxLength = 48;
    private const int MaxSlugLength = 40;
    private const string FallbackSlug = "theme";

    [GeneratedRegex(@"^[a-z0-9]+(?:-[a-z0-9]+)*\z")]
    private static partial Regex IdPattern();

    [GeneratedRegex(@"[^a-z0-9]+")]
    private static partial Regex NonSlugRun();

    public static bool IsValid(string? id) => id is not null && id.Length <= MaxLength && IdPattern().IsMatch(id);

    /// <summary>
    /// Builds an id from <paramref name="name"/>: lowercase, runs of other characters become one '-', at most 40 characters,
    /// "theme" when nothing is left. Appends -2, -3, ... while <paramref name="isTaken"/> says the id is in use.
    /// </summary>
    public static string FromName(string name, Func<string, bool> isTaken)
    {
        var slug = NonSlugRun().Replace(name.ToLowerInvariant(), "-").Trim('-');
        if (slug.Length > MaxSlugLength) slug = slug[..MaxSlugLength].Trim('-');
        if (slug.Length == 0) slug = FallbackSlug;

        var id = slug;
        for (var n = 2; isTaken(id); n++)
        {
            id = new StringBuilder(slug).Append('-').Append(n).ToString();
        }
        return id;
    }
}
