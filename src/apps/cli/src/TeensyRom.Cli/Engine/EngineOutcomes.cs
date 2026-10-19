namespace TeensyRom.Cli.Engine;

/// <summary>What one look at <c>GET /api/version</c> on the engine's port found.</summary>
internal abstract record EngineProbeResult
{
    private EngineProbeResult() { }

    /// <summary>Nothing is listening: the connection was refused, however long that took.</summary>
    internal sealed record Unreachable : EngineProbeResult;

    /// <summary>Something is listening but hasn't answered yet: a timeout after connecting, or a 5xx.</summary>
    internal sealed record NotReady : EngineProbeResult;

    /// <summary>A TeensyROM engine answered with its version.</summary>
    internal sealed record Engine(string Version) : EngineProbeResult;

    /// <summary>Something that is not a TeensyROM engine answered definitively.</summary>
    internal sealed record Foreign(string Reason) : EngineProbeResult;
}

/// <summary>Whether an engine is ready for a command; <see cref="FailureMessage"/> says what to fix when it is not.</summary>
internal sealed record EngineReady(bool Ok, string? FailureMessage)
{
    public static EngineReady Ready { get; } = new(true, null);

    public static EngineReady Failed(string message) => new(false, message);
}

internal enum EngineStopOutcome
{
    Stopped,
    NotRunning,

    /// <summary>The running engine has no stop endpoint (404 or 405).</summary>
    NotSupported,

    Foreign,
    Failed
}

/// <summary>How the engine answered a request to stop.</summary>
internal enum EngineStopRequest
{
    Accepted,
    NotSupported,

    /// <summary>The engine was already gone when asked.</summary>
    Gone,

    Failed
}

internal enum EngineMode { Packaged, Source }

/// <summary>
/// Where the engine this CLI starts lives. <see cref="Folder"/> is the engine's own folder when packaged and the
/// tr-web checkout root in source mode, where <see cref="ApiProject"/> is the engine project to build.
/// </summary>
internal sealed record EngineLocation(EngineMode Mode, string Folder, string? ApiProject = null);

/// <summary>The result of looking for an engine; <see cref="SearchedFolder"/> is where a packaged engine was expected.</summary>
internal sealed record EngineLookup(EngineLocation? Location, string SearchedFolder);

/// <summary>One step of starting an engine (build or launch); <see cref="Failure"/> says why it did not work.</summary>
internal sealed record EngineStep(bool Ok, string? Failure = null)
{
    public static EngineStep Success { get; } = new(true);

    public static EngineStep Fail(string failure) => new(false, failure);
}
