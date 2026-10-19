namespace TeensyRom.Cli.Engine;

/// <summary>Time and waiting for the engine control's polling loops, so tests can run them instantly.</summary>
internal interface IEngineClock
{
    DateTimeOffset UtcNow { get; }

    Task DelayAsync(TimeSpan delay, CancellationToken ct);
}

internal sealed class SystemEngineClock : IEngineClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;

    public Task DelayAsync(TimeSpan delay, CancellationToken ct) => Task.Delay(delay, ct);
}
