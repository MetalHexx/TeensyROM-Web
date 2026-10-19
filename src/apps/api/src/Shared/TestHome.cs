using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using TeensyRom.Core.Common;

namespace TeensyRom.TestSupport;

/// <summary>
/// Points this test process at a throwaway TeensyROM home so no test reads or writes the real
/// <c>~/.teensyrom</c>. Linked into every test project that resolves the home. One home per process: two
/// test processes on one home would trip the engine instance lock.
/// </summary>
/// <remarks>
/// A process that booted the engine holds <c>engine.lock</c> open until it dies, and the test host may be killed
/// before an exit-time delete of a large home finishes, so exit cleanup is only best-effort. What guarantees
/// cleanup: each home folder name carries its owner's PID, so the next test process sweeps away every home whose
/// owner is gone. At most the latest run's home outlives its process.
/// </remarks>
internal static class TestHome
{
    private static readonly string TestHomesRoot = Path.Combine(Path.GetTempPath(), "teensyrom-tests");

    [ModuleInitializer]
    internal static void Initialize()
    {
        // Left alone when already set: local-only suites may be pointed at real captured data on purpose.
        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(TeensyRomHome.DataDirVariable))) return;

        var project = typeof(TestHome).Assembly.GetName().Name;
        var home = Path.Combine(TestHomesRoot, $"{project}-{Environment.ProcessId}-{Guid.NewGuid():N}");

        Environment.SetEnvironmentVariable(TeensyRomHome.DataDirVariable, home);

        SweepAbandonedHomes();

        AppDomain.CurrentDomain.ProcessExit += (_, _) => TryDelete(home);
    }

    private static void SweepAbandonedHomes()
    {
        if (!Directory.Exists(TestHomesRoot)) return;

        foreach (var folder in Directory.EnumerateDirectories(TestHomesRoot))
        {
            if (OwnerProcessId(folder) is { } ownerPid && !IsRunning(ownerPid)) TryDelete(folder);
        }
    }

    /// <summary>Reads the PID out of <c>{project}-{pid}-{guid}</c>.</summary>
    private static int? OwnerProcessId(string folder)
    {
        var parts = Path.GetFileName(folder).Split('-');

        return parts.Length >= 3 && int.TryParse(parts[^2], out var pid) ? pid : null;
    }

    private static bool IsRunning(int processId)
    {
        try
        {
            using var process = Process.GetProcessById(processId);
            return !process.HasExited;
        }
        catch (ArgumentException)
        {
            return false;
        }
        catch (InvalidOperationException)
        {
            return false;
        }
        catch (Win32Exception)
        {
            return true;
        }
    }

    private static void TryDelete(string folder)
    {
        try { Directory.Delete(folder, recursive: true); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }
}
