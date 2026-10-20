using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using TeensyRom.Cli.Common;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// Points this test process at a throwaway TeensyROM home so no test reads or writes the real <c>~/.teensyrom</c>.
/// One home per process: two processes on one home would share one engine lock.
/// </summary>
/// <remarks>
/// <para>
/// A <c>TEENSYROM_DATA_DIR</c> inherited from the shell is replaced, so a stray value can't point the settings tests
/// at a real home they would overwrite and delete.
/// </para>
/// <para>
/// A test may start an engine that outlives the test process and holds <c>engine.lock</c> in its home, so the home is
/// deleted only when nothing holds that lock. Each home's folder name carries its owner's PID, so the next test
/// process sweeps away every home whose owner is gone and whose lock is free.
/// </para>
/// </remarks>
internal static class TestHome
{
    private static readonly string TestHomesRoot = Path.Combine(Path.GetTempPath(), "teensyrom-cli-tests");

    [ModuleInitializer]
    internal static void Initialize()
    {
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

    private static bool EngineLockHeld(string home)
    {
        try
        {
            using var _ = new FileStream(Path.Combine(home, "api", "engine.lock"), FileMode.Open, FileAccess.ReadWrite, FileShare.None);
            return false;
        }
        catch (Exception ex) when (ex is FileNotFoundException or DirectoryNotFoundException)
        {
            return false;
        }
        catch (IOException)
        {
            return true;
        }
    }

    private static void TryDelete(string folder)
    {
        if (EngineLockHeld(folder)) return;

        try { Directory.Delete(folder, recursive: true); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }
}
