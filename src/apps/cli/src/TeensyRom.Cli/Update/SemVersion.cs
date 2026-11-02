using System.Text.RegularExpressions;

namespace TeensyRom.Cli.Update;

/// <summary>
/// A SemVer 2 version ordered by §11 precedence. Build metadata (<c>+...</c>) is dropped on parse, so two versions
/// that have equal precedence are equal values.
/// </summary>
internal readonly partial record struct SemVersion(int Major, int Minor, int Patch, string PreRelease = "") : IComparable<SemVersion>
{
    [GeneratedRegex(@"^v?(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<pre>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$")]
    private static partial Regex Pattern();

    public bool IsPreRelease => !string.IsNullOrEmpty(PreRelease);

    /// <summary>Reads <c>1.2.3</c>, <c>v1.2.3-beta.1</c> or <c>1.2.3+abc</c>; false for anything that isn't a SemVer 2 version.</summary>
    public static bool TryParse(string? text, out SemVersion version)
    {
        version = default;

        if (string.IsNullOrWhiteSpace(text)) return false;

        var match = Pattern().Match(text.Trim());

        if (!match.Success) return false;

        if (!int.TryParse(match.Groups["major"].Value, out var major)
            || !int.TryParse(match.Groups["minor"].Value, out var minor)
            || !int.TryParse(match.Groups["patch"].Value, out var patch))
        {
            return false;
        }

        version = new SemVersion(major, minor, patch, match.Groups["pre"].Value);
        return true;
    }

    public int CompareTo(SemVersion other)
    {
        var core = Major.CompareTo(other.Major);
        if (core != 0) return core;

        core = Minor.CompareTo(other.Minor);
        if (core != 0) return core;

        core = Patch.CompareTo(other.Patch);
        if (core != 0) return core;

        if (IsPreRelease != other.IsPreRelease) return IsPreRelease ? -1 : 1;

        return IsPreRelease ? ComparePreRelease(PreRelease, other.PreRelease) : 0;
    }

    public static bool operator <(SemVersion left, SemVersion right) => left.CompareTo(right) < 0;

    public static bool operator >(SemVersion left, SemVersion right) => left.CompareTo(right) > 0;

    public static bool operator <=(SemVersion left, SemVersion right) => left.CompareTo(right) <= 0;

    public static bool operator >=(SemVersion left, SemVersion right) => left.CompareTo(right) >= 0;

    public override string ToString() => IsPreRelease ? $"{Major}.{Minor}.{Patch}-{PreRelease}" : $"{Major}.{Minor}.{Patch}";

    private static int ComparePreRelease(string left, string right)
    {
        var leftParts = left.Split('.');
        var rightParts = right.Split('.');

        for (var i = 0; i < Math.Min(leftParts.Length, rightParts.Length); i++)
        {
            var order = ComparePart(leftParts[i], rightParts[i]);

            if (order != 0) return order;
        }
        return leftParts.Length.CompareTo(rightParts.Length);
    }

    // Numeric identifiers rank below alphanumeric ones and compare as numbers; a number too big for an int still
    // compares correctly by length, because the pattern allows no leading zeros.
    private static int ComparePart(string left, string right)
    {
        var leftNumeric = left.All(char.IsAsciiDigit);
        var rightNumeric = right.All(char.IsAsciiDigit);

        if (leftNumeric && rightNumeric)
        {
            return left.Length != right.Length ? left.Length.CompareTo(right.Length) : Math.Sign(string.CompareOrdinal(left, right));
        }

        if (leftNumeric) return -1;
        if (rightNumeric) return 1;

        return Math.Sign(string.CompareOrdinal(left, right));
    }
}
