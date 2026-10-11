namespace TeensyRom.Core.Common;

/// <summary>
/// The per-run ids ("Unknown", "Unknown-2", ...) given to a device whose reply carried no chip id. They are
/// display-only: never saved as a record, named, or matched against settings.
/// </summary>
public static class StandInDeviceId
{
    private const string Base = "Unknown";

    /// <summary>The stand-in id for the <paramref name="ordinal"/>th unidentified device of this run (1-based).</summary>
    public static string ForOrdinal(int ordinal) => ordinal == 1 ? Base : $"{Base}-{ordinal}";

    /// <summary>True when <paramref name="deviceId"/> is a stand-in rather than a chip id read from a device.</summary>
    public static bool IsStandIn(string? deviceId) =>
        deviceId == Base || (deviceId?.StartsWith($"{Base}-") ?? false);
}
