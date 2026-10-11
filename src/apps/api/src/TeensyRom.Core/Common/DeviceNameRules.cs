namespace TeensyRom.Core.Common;

/// <summary>The one rule for a user-chosen device name, shared by the request validator and the connection manager.</summary>
public static class DeviceNameRules
{
    public const int MaxLength = 24;

    /// <summary>
    /// Trims <paramref name="raw"/>; valid when 1..<see cref="MaxLength"/> UTF-16 chars remain after the
    /// trim and none is a control char. Length is <see cref="string.Length"/>, the same unit the browser
    /// counts. Duplicates are allowed.
    /// </summary>
    public static bool TryNormalize(string? raw, out string name)
    {
        name = string.Empty;

        var trimmed = raw?.Trim();

        if (string.IsNullOrEmpty(trimmed) || trimmed.Length > MaxLength || trimmed.Any(char.IsControl))
        {
            return false;
        }

        name = trimmed;
        return true;
    }
}
