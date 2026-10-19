using System.Runtime.CompilerServices;
using TeensyRom.Core.Common;

namespace TeensyRom.Core.Storage.Tests;

/// <summary>
/// Points this test process at a throwaway TeensyROM home so no test reads or writes the real
/// <c>~/.teensyrom</c>. One home per process: two test processes on one home would trip the engine instance lock.
/// </summary>
internal static class TestHome
{
    [ModuleInitializer]
    internal static void Initialize()
    {
        // Left alone when already set: local-only suites may be pointed at real captured data on purpose.
        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(TeensyRomHome.DataDirVariable))) return;

        var home = Path.Combine(Path.GetTempPath(), "teensyrom-tests", $"TeensyRom.Core.Storage.Tests-{Environment.ProcessId}-{Guid.NewGuid():N}");

        Environment.SetEnvironmentVariable(TeensyRomHome.DataDirVariable, home);

        AppDomain.CurrentDomain.ProcessExit += (_, _) =>
        {
            // Best-effort: the home lives in the temp directory, so a leftover folder is harmless.
            try { Directory.Delete(home, recursive: true); }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
        };
    }
}
