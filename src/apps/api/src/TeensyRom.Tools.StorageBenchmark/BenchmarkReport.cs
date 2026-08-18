using System.Runtime.InteropServices;
using System.Text;

namespace TeensyRom.Tools.StorageBenchmark;

/// <summary>
/// One index file the run read, with the provenance needed to judge whether a result is comparable to
/// a prior baseline.
/// </summary>
public record IndexFileInfo(string Path, long SizeBytes, int FileCount);

/// <summary>
/// One operation's legacy-vs-store comparison. A side missing a counterpart carries a
/// <see langword="null"/> - never a zero - since "not measured" and "no difference" are different claims.
/// </summary>
public record ComparisonRow(
    string Operation,
    double? LegacyMedianMs,
    double? StoreMedianMs,
    double? DeltaMs,
    long? LegacyPeakWorkingSetBytes,
    long? StorePeakWorkingSetBytes,
    string Expectation);

/// <summary>
/// Renders a <see cref="BenchmarkRunner"/> run as a markdown report: a provenance header followed by either
/// one table per scenario (single scenario set) or a side-by-side legacy/store comparison table.
/// </summary>
public static class BenchmarkReport
{
    /// <summary>
    /// The claim each operation is expected to demonstrate, keyed by the scenario's exact operation name, so
    /// a reader of the comparison sees the claim and the measured result together.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, string> ExpectationByOperation = new Dictionary<string, string>
    {
        ["Cold start to queryable"] =
            "Explicit target: time from opening the database to answering the first directory listing.",
        ["Directory listing by path"] =
            "The one at risk. May be a fraction slower in absolute terms; must stay imperceptible.",
        ["Search"] =
            "Materially faster: today is a full scan of every file with several substring comparisons each.",
        ["Random by scope (Storage)"] =
            "Materially faster; the allocation of the whole matching set disappears.",
        ["Random by scope (DirDeep)"] =
            "Materially faster; the allocation of the whole matching set disappears.",
        ["Random by scope (DirShallow)"] =
            "Materially faster; the allocation of the whole matching set disappears.",
        ["Parent lookup by identity"] =
            "Materially faster; unaffected by concurrent writes, unlike the map rebuilt on every upsert.",
        ["Sibling lookup by identity"] =
            "Materially faster; unaffected by concurrent writes, unlike the map rebuilt on every upsert.",
        ["Single upsert"] =
            "Materially faster - the workload that motivates the rewrite.",
        ["Bulk upsert (500) + parent lookup (identity map rebuild)"] =
            "Materially faster - the workload that motivates the rewrite.",
        ["Peak memory with every discovered index loaded"] =
            "Explicit target: the index is not resident - nothing requires the full collection in memory."
    };

    public static string Build(
        BenchmarkOptions options,
        IReadOnlyList<ScenarioResult> results,
        IReadOnlyList<IndexFileInfo> indexFiles,
        TimeSpan? seedElapsed = null)
    {
        var sb = new StringBuilder();
        AppendHeader(sb, options, indexFiles, seedElapsed);

        sb.AppendLine("## Scenario results");
        sb.AppendLine();
        sb.AppendLine("| Operation | Iterations | Median (ms) | Min (ms) | Max (ms) | Managed delta (bytes) | Peak working set (bytes) |");
        sb.AppendLine("|---|---|---|---|---|---|---|");

        foreach (var result in results)
        {
            sb.AppendLine(
                $"| {result.Operation} | {result.Iterations} | {result.MedianMs:F3} | {result.MinMs:F3} | " +
                $"{result.MaxMs:F3} | {result.ManagedBytesDelta:N0} | {result.PeakWorkingSetBytes:N0} |");
        }

        return sb.ToString();
    }

    /// <summary>
    /// Renders the <c>--scenarios both</c> report: one row per operation with a legacy column, a store
    /// column, an absolute delta in milliseconds, and the expectation for that operation. Judged in absolute
    /// time, not ratios - an operation going from a fraction of a millisecond to a few milliseconds is a large
    /// ratio and an invisible change.
    /// </summary>
    public static string BuildComparison(
        BenchmarkOptions options,
        IReadOnlyList<ScenarioResult> legacyResults,
        IReadOnlyList<ScenarioResult> storeResults,
        IReadOnlyList<IndexFileInfo> indexFiles,
        TimeSpan seedElapsed)
    {
        var sb = new StringBuilder();
        AppendHeader(sb, options, indexFiles, seedElapsed);

        sb.AppendLine("## Legacy vs. store comparison");
        sb.AppendLine();
        sb.AppendLine(
            "| Operation | Legacy median (ms) | Store median (ms) | Delta (ms) | Legacy peak working set (bytes) | " +
            "Store peak working set (bytes) | Expectation |");
        sb.AppendLine("|---|---|---|---|---|---|---|");

        foreach (var row in BuildComparisonRows(legacyResults, storeResults))
        {
            sb.AppendLine(
                $"| {row.Operation} | {FormatMs(row.LegacyMedianMs)} | {FormatMs(row.StoreMedianMs)} | " +
                $"{FormatMs(row.DeltaMs)} | {FormatBytes(row.LegacyPeakWorkingSetBytes)} | " +
                $"{FormatBytes(row.StorePeakWorkingSetBytes)} | {row.Expectation} |");
        }

        return sb.ToString();
    }

    /// <summary>
    /// Pairs legacy and store results by operation name into one row per operation seen on either side. A
    /// side missing a counterpart contributes <see langword="null"/> fields rather than zeros, and the delta
    /// is only computed when both sides have a measurement.
    /// </summary>
    public static IReadOnlyList<ComparisonRow> BuildComparisonRows(
        IReadOnlyList<ScenarioResult> legacyResults, IReadOnlyList<ScenarioResult> storeResults)
    {
        var legacyByOperation = legacyResults.ToDictionary(r => r.Operation);
        var storeByOperation = storeResults.ToDictionary(r => r.Operation);

        var operations = legacyResults.Select(r => r.Operation)
            .Concat(storeResults.Select(r => r.Operation))
            .Distinct();

        var rows = new List<ComparisonRow>();

        foreach (var operation in operations)
        {
            legacyByOperation.TryGetValue(operation, out var legacy);
            storeByOperation.TryGetValue(operation, out var store);

            double? legacyMedian = legacy?.MedianMs;
            double? storeMedian = store?.MedianMs;
            double? delta = legacyMedian is { } l && storeMedian is { } s ? s - l : null;
            var expectation = ExpectationByOperation.TryGetValue(operation, out var text) ? text : string.Empty;

            rows.Add(new ComparisonRow(
                operation, legacyMedian, storeMedian, delta,
                legacy?.PeakWorkingSetBytes, store?.PeakWorkingSetBytes, expectation));
        }

        return rows;
    }

    private static void AppendHeader(
        StringBuilder sb, BenchmarkOptions options, IReadOnlyList<IndexFileInfo> indexFiles, TimeSpan? seedElapsed)
    {
        sb.AppendLine("# Storage Benchmark Report");
        sb.AppendLine();
        sb.AppendLine("## Run header");
        sb.AppendLine();
        sb.AppendLine($"- Generated (UTC): {DateTime.UtcNow:O}");
        sb.AppendLine($"- OS: {RuntimeInformation.OSDescription}");
        sb.AppendLine($"- Processor count: {Environment.ProcessorCount}");
        sb.AppendLine($"- .NET runtime: {RuntimeInformation.FrameworkDescription}");
        sb.AppendLine($"- Iterations per scenario (warm-up excluded): {options.Iterations}");
        sb.AppendLine($"- Data directory: {options.DataDir}");
        sb.AppendLine($"- Device: {options.DeviceId} ({options.Storage})");
        sb.AppendLine($"- Scenario set: {options.Scenarios}");

        if (seedElapsed is { } elapsed)
        {
            sb.AppendLine(
                $"- Store seeding time (setup, excluded from every measured operation): {elapsed.TotalMilliseconds:F3} ms");
        }

        sb.AppendLine();
        sb.AppendLine("### Index files read");
        sb.AppendLine();
        sb.AppendLine("| Path | Size (bytes) | File count |");
        sb.AppendLine("|---|---|---|");

        foreach (var file in indexFiles)
        {
            sb.AppendLine($"| {file.Path} | {file.SizeBytes:N0} | {file.FileCount:N0} |");
        }

        sb.AppendLine();
    }

    private static string FormatMs(double? value) => value is { } v ? v.ToString("F3") : "—";

    private static string FormatBytes(long? value) => value is { } v ? v.ToString("N0") : "—";
}
