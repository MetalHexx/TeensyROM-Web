using System.Text.Json;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// The one engine every suite, agent and user of this checkout shares: started or reused through the CLI's own
/// <see cref="EngineControl"/> (source mode, because this assembly sits under <c>src/apps/cli</c>) in a throwaway home,
/// so no test touches the real <c>~/.teensyrom</c>. Freshness after engine edits (or a change of build configuration) is the control's source fingerprint and configuration stamp.
/// </summary>
/// <remarks>
/// State lives in <see cref="StateDirectory"/>: <c>state.json</c> names the home in use, and <c>ensure.lock</c> is held
/// while a process starts or stops the engine, so concurrent runs queue instead of racing for the port.
/// </remarks>
internal static class TestEngine
{
    private const string HomeFolderPrefix = "home-";
    private const string ScenarioFolderPrefix = "scenario-";

    private static readonly TimeSpan LockRetry = TimeSpan.FromMilliseconds(250);
    private static readonly TimeSpan LockTimeout = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan OperationTimeout = TimeSpan.FromMinutes(15);

    private static readonly string StateDirectory = Path.Combine(Path.GetTempPath(), "teensyrom-cli-test-engine");

    private static string StatePath => Path.Combine(StateDirectory, "state.json");

    /// <summary>A cap for one start-or-reuse call: a first run builds the engine and waits out device discovery.</summary>
    public static CancellationTokenSource Bounded() => new(OperationTimeout);

    /// <summary>
    /// Makes sure the shared engine of this CLI's version and build is answering, and returns the home it runs in.
    /// This process's <c>TEENSYROM_DATA_DIR</c> is set to that home, before anything is started: the launcher passes
    /// the environment through, and the CLI under test resolves its own folders from it.
    /// </summary>
    public static async Task<string> EnsureAsync(CancellationToken ct)
    {
        using var held = await HoldEnsureLockAsync(ct);

        var recorded = ReadHome();
        var home = recorded ?? Path.Combine(StateDirectory, $"{HomeFolderPrefix}{DateTime.Now:yyyyMMdd-HHmmss}");

        Environment.SetEnvironmentVariable(TeensyRomHome.DataDirVariable, home);

        var control = NewControl();

        // An engine answering on the port that holds no lock in this home serves another home, such as the operator's.
        if (await new EngineProbe().ProbeAsync(ct) is EngineProbeResult.Engine && !new EngineLock().IsHeld())
        {
            await StopOrThrowAsync(control, ct);
        }

        var ready = await control.EnsureRunningAsync(ct);

        if (!ready.Ok) throw new InvalidOperationException(ready.FailureMessage);

        if (recorded is null) WriteState(home);

        SweepOlderHomes(home);

        return home;
    }

    /// <summary>Stops the running engine, whichever home it serves. Does nothing when none is running.</summary>
    public static async Task StopAsync(CancellationToken ct)
    {
        using var held = await HoldEnsureLockAsync(ct);

        await StopOrThrowAsync(NewControl(), ct);
    }

    /// <summary>Whether an engine holds the single-instance lock of <paramref name="home"/>.</summary>
    public static bool IsEngineLockHeld(string home) =>
        new EngineLock(() => Path.Combine(home, "api", "engine.lock")).IsHeld();

    /// <summary>A path for a throwaway home that belongs to one scenario; nothing is created yet.</summary>
    public static string NewScenarioHome() =>
        Path.Combine(StateDirectory, $"{ScenarioFolderPrefix}{Guid.NewGuid():N}");

    public static void TryDeleteHome(string home)
    {
        if (IsEngineLockHeld(home)) return;

        try { Directory.Delete(home, recursive: true); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }

    private static EngineControl NewControl() => new(
        new EngineProbe(),
        new EngineLock(),
        new EngineLocator(AppContext.BaseDirectory),
        new EngineLauncher(),
        new SourceFingerprint(),
        new SystemEngineClock(),
        AssemblyExtensions.GetVersion(typeof(CliHost).Assembly),
        notice => Console.Error.WriteLine($"[test-engine] {notice}"));

    private static async Task StopOrThrowAsync(EngineControl control, CancellationToken ct)
    {
        var outcome = await control.StopAsync(ct);

        if (outcome is not (EngineStopOutcome.Stopped or EngineStopOutcome.NotRunning))
        {
            throw new InvalidOperationException(
                $"port {EngineAddress.Port} is held by something the tests can't stop: {outcome}.");
        }
    }

    private static async Task<FileStream> HoldEnsureLockAsync(CancellationToken ct)
    {
        Directory.CreateDirectory(StateDirectory);

        var path = Path.Combine(StateDirectory, "ensure.lock");
        var deadline = DateTime.UtcNow + LockTimeout;

        while (true)
        {
            try
            {
                return new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
            }
            catch (IOException) when (DateTime.UtcNow < deadline)
            {
                await Task.Delay(LockRetry, ct);
            }
            catch (IOException)
            {
                throw new TimeoutException($"Another test run held {path} for {LockTimeout.TotalMinutes:0} minutes.");
            }
        }
    }

    private static string? ReadHome()
    {
        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(StatePath));

            return document.RootElement.TryGetProperty("home", out var value) && !string.IsNullOrWhiteSpace(value.GetString())
                ? Path.GetFullPath(value.GetString()!)
                : null;
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    private static void WriteState(string home) =>
        File.WriteAllText(StatePath, JsonSerializer.Serialize(new { home, startedAt = DateTimeOffset.UtcNow }));

    private static void SweepOlderHomes(string current)
    {
        foreach (var folder in Directory.EnumerateDirectories(StateDirectory, $"{HomeFolderPrefix}*"))
        {
            if (!string.Equals(Path.GetFullPath(folder), current, StringComparison.OrdinalIgnoreCase)) TryDeleteHome(folder);
        }
    }
}
