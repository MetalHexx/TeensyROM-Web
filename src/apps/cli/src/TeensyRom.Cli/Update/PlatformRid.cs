using System.Runtime.InteropServices;

namespace TeensyRom.Cli.Update;

/// <summary>
/// The runtime identifiers the suite ships for, and the file names that follow from them. The release asset names are
/// a contract with the release workflow: <c>TeensyROM-Suite-{version}-{rid}.zip</c> or <c>.tar.gz</c>.
/// </summary>
internal static class PlatformRid
{
    /// <summary>
    /// This process's identifier, or null on a platform the suite has no package for. The process architecture is
    /// used, not the machine's: an x64 trom under Rosetta belongs to an x64 install.
    /// </summary>
    public static string? Current { get; } = For(CurrentPlatform(), RuntimeInformation.ProcessArchitecture);

    public static string? For(OSPlatform platform, Architecture architecture)
    {
        if (platform == OSPlatform.Windows && architecture == Architecture.X64) return "win-x64";
        if (platform == OSPlatform.OSX && architecture == Architecture.X64) return "osx-x64";
        if (platform == OSPlatform.OSX && architecture == Architecture.Arm64) return "osx-arm64";
        if (platform == OSPlatform.Linux && architecture == Architecture.X64) return "linux-x64";

        return null;
    }

    public static bool IsWindows(string rid) => rid.StartsWith("win-", StringComparison.Ordinal);

    public static string ArchiveSuffix(string rid) => IsWindows(rid) ? ".zip" : ".tar.gz";

    public static string TromExecutable(string rid) => IsWindows(rid) ? "trom.exe" : "trom";

    public static string ApiExecutable(string rid) => IsWindows(rid) ? "TeensyRom.Api.exe" : "TeensyRom.Api";

    public static string AssetName(SemVersion version, string rid) => $"TeensyROM-Suite-{version}-{rid}{ArchiveSuffix(rid)}";

    private static OSPlatform CurrentPlatform() =>
        OperatingSystem.IsWindows() ? OSPlatform.Windows
        : OperatingSystem.IsMacOS() ? OSPlatform.OSX
        : OperatingSystem.IsLinux() ? OSPlatform.Linux
        : OSPlatform.Create("unsupported");
}
