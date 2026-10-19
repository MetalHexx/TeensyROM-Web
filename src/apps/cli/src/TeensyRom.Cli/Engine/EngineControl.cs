using TeensyRom.Cli.Api;
using TeensyRom.Cli.Common;

namespace TeensyRom.Cli.Engine;

/// <summary>Owns the engine's life for the CLI: finds it, starts it, replaces it, stops it.</summary>
internal interface IEngineControl
{
    /// <summary>
    /// Makes sure an engine of this CLI's version is answering, starting or replacing one when needed.
    /// Failures come back as a message to show, not as exceptions.
    /// </summary>
    Task<EngineReady> EnsureRunningAsync(CancellationToken ct);

    /// <summary>Stops the running engine and waits for it to release its port and lock. Never starts anything.</summary>
    Task<EngineStopOutcome> StopAsync(CancellationToken ct);
}

/// <summary>
/// The decisions behind <see cref="IEngineControl"/>; every OS interaction sits behind an interface.
/// </summary>
/// <remarks>
/// The rule that keeps it to one engine: an engine that is still bootstrapping isn't listening yet, so a refused
/// probe alone never starts one while the engine lock is held, and a start that loses a race to another engine is
/// still a success once that engine answers.
/// </remarks>
/// <param name="ownVersion">This CLI's version, which the engine must report.</param>
/// <param name="notify">Receives the one-line progress notices (starting, restarting, waiting).</param>
internal sealed class EngineControl(
    IEngineProbe probe,
    IEngineLock engineLock,
    IEngineLocator locator,
    IEngineLauncher launcher,
    ISourceFreshness freshness,
    IEngineClock clock,
    string ownVersion,
    Action<string> notify) : IEngineControl
{
    internal static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(500);
    internal static readonly TimeSpan StartTimeout = TimeSpan.FromSeconds(180);
    internal static readonly TimeSpan LaunchFailFast = TimeSpan.FromSeconds(15);
    internal static readonly TimeSpan StopTimeout = TimeSpan.FromSeconds(45);

    public async Task<EngineReady> EnsureRunningAsync(CancellationToken ct)
    {
        var attempt = new Attempt();

        switch (await probe.ProbeAsync(ct))
        {
            case EngineProbeResult.Engine running:
                return await EnsureCurrentAsync(running, attempt, ct);

            case EngineProbeResult.Foreign:
                return EngineReady.Failed(ForeignMessage());

            case EngineProbeResult.NotReady:
                return await WaitAsync(attempt, ct);

            default:
                return await StartOrWaitAsync(attempt, ct);
        }
    }

    public async Task<EngineStopOutcome> StopAsync(CancellationToken ct)
    {
        switch (await probe.ProbeAsync(ct))
        {
            case EngineProbeResult.Unreachable:
                return EngineStopOutcome.NotRunning;
            case EngineProbeResult.Foreign:
                return EngineStopOutcome.Foreign;
            case EngineProbeResult.NotReady:
                return EngineStopOutcome.Failed;
        }

        switch (await probe.RequestStopAsync(ct))
        {
            case EngineStopRequest.NotSupported:
                return EngineStopOutcome.NotSupported;
            case EngineStopRequest.Failed:
                return EngineStopOutcome.Failed;
        }

        var deadline = clock.UtcNow + StopTimeout;

        while (true)
        {
            if (await probe.ProbeAsync(ct) is EngineProbeResult.Unreachable && !engineLock.IsHeld())
            {
                return EngineStopOutcome.Stopped;
            }

            if (clock.UtcNow >= deadline) return EngineStopOutcome.Failed;

            await clock.DelayAsync(PollInterval, ct);
        }
    }

    /// <summary>Reuses the running engine when it is this CLI's version and build; otherwise replaces it.</summary>
    private async Task<EngineReady> EnsureCurrentAsync(EngineProbeResult.Engine running, Attempt attempt, CancellationToken ct)
    {
        var notice = RestartNotice(running.Version);

        if (notice is null) return EngineReady.Ready;

        notify(notice);

        return await StopAsync(ct) switch
        {
            EngineStopOutcome.Stopped => await StartAndWaitAsync(attempt, ct),
            EngineStopOutcome.NotRunning => await StartOrWaitAsync(attempt, ct),
            _ => EngineReady.Failed(
                $"The running TeensyROM engine (version {Comparable(running.Version)}) can't be stopped from the CLI. Stop it where it was started, then try again.")
        };
    }

    private string? RestartNotice(string runningVersion)
    {
        if (!SameVersion(runningVersion))
        {
            return $"The running TeensyROM engine is version {Comparable(runningVersion)}, this CLI is {Comparable(ownVersion)} — restarting it.";
        }

        return locator.Locate().Location is { Mode: EngineMode.Source } source && IsStale(source)
            ? "The running TeensyROM engine is out of date with this source tree — restarting it."
            : null;
    }

    // The version is the same across builds, so a source-mode engine is fresh only if this CLI started it from the
    // sources as they are now.
    private bool IsStale(EngineLocation source)
    {
        var current = freshness.Current(source.Folder);

        return current != SourceFingerprint.Unknown && freshness.Recorded() != current;
    }

    private async Task<EngineReady> StartOrWaitAsync(Attempt attempt, CancellationToken ct) =>
        engineLock.IsHeld() ? await WaitAsync(attempt, ct) : await StartAndWaitAsync(attempt, ct);

    private async Task<EngineReady> StartAndWaitAsync(Attempt attempt, CancellationToken ct)
    {
        var failure = await StartAsync(attempt, ct);

        return failure is null ? await WaitAsync(attempt, ct) : EngineReady.Failed(failure);
    }

    /// <summary>Builds (from source) and launches an engine; returns the failure message, or null once launched.</summary>
    private async Task<string?> StartAsync(Attempt attempt, CancellationToken ct)
    {
        notify("Starting the TeensyROM engine…");

        var lookup = locator.Locate();

        if (lookup.Location is not { } location)
        {
            return $"No TeensyROM engine was found beside this CLI (looked in {lookup.SearchedFolder}).";
        }

        attempt.Location = location;

        Directory.CreateDirectory(TeensyRomHome.EngineLogsPath);
        Directory.CreateDirectory(TeensyRomHome.CliLogsPath);

        if (location.Mode == EngineMode.Source)
        {
            attempt.SourceFingerprint = freshness.Current(location.Folder);
            notify("Building the TeensyROM engine from source…");

            var build = await launcher.BuildAsync(location, ct);

            if (!build.Ok) return StartFailed(build.Failure ?? "the build failed", attempt);
        }

        var launch = launcher.Launch(location);

        if (!launch.Ok) return StartFailed(launch.Failure ?? "it couldn't be launched", attempt);

        attempt.LaunchedAt = clock.UtcNow;
        return null;
    }

    /// <summary>
    /// Waits for an engine of this version to answer. It starts one itself only if it was waiting on someone else's
    /// start and that engine never appeared.
    /// </summary>
    private async Task<EngineReady> WaitAsync(Attempt attempt, CancellationToken ct)
    {
        if (attempt.LaunchedAt is null) notify("Waiting for the TeensyROM engine to finish starting…");

        var deadline = (attempt.LaunchedAt ?? clock.UtcNow) + StartTimeout;

        while (true)
        {
            switch (await probe.ProbeAsync(ct))
            {
                case EngineProbeResult.Engine running when SameVersion(running.Version):
                    if (attempt.SourceFingerprint is { } fingerprint) freshness.Record(fingerprint);
                    return EngineReady.Ready;

                case EngineProbeResult.Engine running:
                    return EngineReady.Failed(StartFailed(
                        $"version {Comparable(running.Version)} answered instead of {Comparable(ownVersion)}", attempt));

                case EngineProbeResult.Foreign:
                    return EngineReady.Failed(ForeignMessage());

                case EngineProbeResult.Unreachable when !engineLock.IsHeld():
                    if (attempt.LaunchedAt is null)
                    {
                        var failure = await StartAsync(attempt, ct);

                        if (failure is not null) return EngineReady.Failed(failure);

                        deadline = attempt.LaunchedAt!.Value + StartTimeout;
                    }
                    else if (clock.UtcNow - attempt.LaunchedAt.Value >= LaunchFailFast)
                    {
                        return EngineReady.Failed(StartFailed("the engine exited while starting", attempt));
                    }
                    break;
            }

            if (clock.UtcNow >= deadline)
            {
                return EngineReady.Failed(StartFailed($"it didn't answer within {StartTimeout.TotalSeconds:0} seconds", attempt));
            }

            await clock.DelayAsync(PollInterval, ct);
        }
    }

    private bool SameVersion(string version) =>
        string.Equals(Comparable(version), Comparable(ownVersion), StringComparison.Ordinal);

    private string StartFailed(string reason, Attempt attempt)
    {
        var message = $"The TeensyROM engine didn't start ({reason}). Its logs are in {TeensyRomHome.EngineLogsPath}.";

        return (attempt.Location ?? locator.Locate().Location) is { Mode: EngineMode.Source }
            ? $"{message} The build log is {TeensyRomHome.EngineBuildLogPath}."
            : message;
    }

    private static string ForeignMessage() =>
        $"Something other than a TeensyROM engine is using port {EngineAddress.Port} — free the port and try again. The engine's logs are in {TeensyRomHome.EngineLogsPath}.";

    private static string Comparable(string version)
    {
        var plus = version.IndexOf('+');

        return plus < 0 ? version : version[..plus];
    }

    /// <summary>What one <see cref="EnsureRunningAsync"/> call has done so far.</summary>
    private sealed class Attempt
    {
        public EngineLocation? Location { get; set; }

        public DateTimeOffset? LaunchedAt { get; set; }

        /// <summary>The engine sources' fingerprint taken before this call built them, to record once the engine answers.</summary>
        public string? SourceFingerprint { get; set; }
    }
}
