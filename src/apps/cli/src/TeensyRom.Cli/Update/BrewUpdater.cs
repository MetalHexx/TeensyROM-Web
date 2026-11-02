namespace TeensyRom.Cli.Update;

/// <param name="Problem">Why Homebrew couldn't upgrade, as a sentence; null when it did.</param>
internal sealed record BrewResult(bool Ok, string? Problem);

internal interface IBrewUpdater
{
    /// <summary>Runs <c>brew update</c> then <c>brew upgrade teensyrom-suite</c> from <paramref name="prefix"/>, passing each line of Homebrew's output to <paramref name="onLine"/>.</summary>
    Task<BrewResult> UpgradeAsync(string prefix, Action<string> onLine, CancellationToken ct = default);

    /// <summary>The version <c>&lt;prefix&gt;/bin/trom</c> reports now; null when it can't be read.</summary>
    Task<SemVersion?> InstalledVersionAsync(string prefix, CancellationToken ct = default);
}

/// <summary>Updates through the Homebrew that installed the suite, using that prefix's own <c>brew</c> and <c>trom</c>.</summary>
internal sealed class BrewUpdater(IProcessRunner runner) : IBrewUpdater
{
    internal const string Formula = "teensyrom-suite";

    public static readonly TimeSpan UpdateTimeout = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan UpgradeTimeout = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan VersionTimeout = TimeSpan.FromSeconds(10);

    public async Task<BrewResult> UpgradeAsync(string prefix, Action<string> onLine, CancellationToken ct = default)
    {
        var brew = Path.Combine(prefix, "bin", "brew");

        var update = await runner.RunAsync(brew, ["update"], UpdateTimeout, onLine, ct);

        if (!update.Succeeded) return new BrewResult(false, $"`brew update` failed: {update.Describe()}.");

        var upgrade = await runner.RunAsync(brew, ["upgrade", Formula], UpgradeTimeout, onLine, ct);

        return upgrade.Succeeded ? new BrewResult(true, null) : new BrewResult(false, $"`brew upgrade {Formula}` failed: {upgrade.Describe()}.");
    }

    public async Task<SemVersion?> InstalledVersionAsync(string prefix, CancellationToken ct = default)
    {
        var result = await runner.RunAsync(Path.Combine(prefix, "bin", "trom"), ["--version"], VersionTimeout, null, ct);

        return result.Succeeded ? result.ReportedTromVersion : null;
    }
}
