using System.Diagnostics;

namespace TeensyRom.Tools.StorageBenchmark;

/// <summary>
/// The result of timing and sampling memory around one benchmark scenario.
/// </summary>
public record ScenarioResult(
    string Operation,
    int Iterations,
    double MedianMs,
    double MinMs,
    double MaxMs,
    long ManagedBytesDelta,
    long PeakWorkingSetBytes);

/// <summary>
/// Pure duration statistics, dependency-free so the warm-up/median/min/max contract can be unit tested
/// without constructing a cache or touching a real index file.
/// </summary>
public static class TimingStatistics
{
    /// <summary>
    /// Treats <paramref name="allSamplesMs"/> as one discarded warm-up sample followed by the measured
    /// iterations, and returns the median/min/max of the measured iterations only.
    /// </summary>
    public static (double Median, double Min, double Max) ComputeExcludingWarmup(IReadOnlyList<double> allSamplesMs)
    {
        if (allSamplesMs.Count < 2)
        {
            throw new ArgumentException(
                "At least one warm-up sample plus one measured sample is required.", nameof(allSamplesMs));
        }

        var measured = allSamplesMs.Skip(1).OrderBy(ms => ms).ToList();

        return (Median(measured), measured[0], measured[^1]);
    }

    private static double Median(IReadOnlyList<double> sortedValues)
    {
        var count = sortedValues.Count;
        var mid = count / 2;

        return count % 2 == 0
            ? (sortedValues[mid - 1] + sortedValues[mid]) / 2.0
            : sortedValues[mid];
    }
}

/// <summary>
/// Times and memory-samples a scenario: one discarded warm-up iteration followed by the configured
/// number of measured iterations, with a forced-GC managed-memory delta and a process peak-working-set
/// reading taken around the whole run.
/// </summary>
public class BenchmarkRunner(int iterations)
{
    public int Iterations { get; } = iterations;

    public ScenarioResult Measure(string operation, Action action)
    {
        GC.Collect();
        GC.WaitForPendingFinalizers();
        GC.Collect();
        var managedBefore = GC.GetTotalMemory(true);

        var durationsMs = new List<double>(Iterations + 1);
        var stopwatch = new Stopwatch();

        for (var i = 0; i < Iterations + 1; i++)
        {
            stopwatch.Restart();
            action();
            stopwatch.Stop();
            durationsMs.Add(stopwatch.Elapsed.TotalMilliseconds);
        }

        GC.Collect();
        GC.WaitForPendingFinalizers();
        GC.Collect();
        var managedAfter = GC.GetTotalMemory(true);

        var (median, min, max) = TimingStatistics.ComputeExcludingWarmup(durationsMs);

        var process = Process.GetCurrentProcess();
        process.Refresh();

        return new ScenarioResult(
            operation,
            Iterations,
            median,
            min,
            max,
            managedAfter - managedBefore,
            process.PeakWorkingSet64);
    }
}
