using System.Runtime.InteropServices;
using System.Text;

namespace TeensyRom.Tools.StorageBenchmark;

/// <summary>
/// One index file the run read, with the provenance needed to judge whether a result is comparable to
/// a prior baseline.
/// </summary>
public record IndexFileInfo(string Path, long SizeBytes, int FileCount);

/// <summary>
/// Renders a <see cref="BenchmarkRunner"/> run as a markdown report: a provenance header followed by one
/// table row per scenario.
/// </summary>
public static class BenchmarkReport
{
    public static string Build(
        BenchmarkOptions options,
        IReadOnlyList<ScenarioResult> results,
        IReadOnlyList<IndexFileInfo> indexFiles)
    {
        var sb = new StringBuilder();

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
}
