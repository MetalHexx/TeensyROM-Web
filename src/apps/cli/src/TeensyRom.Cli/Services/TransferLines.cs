using TeensyRom.Cli.Api.Generated;

namespace TeensyRom.Cli.Services;

/// <summary>
/// The text of the lines the menu prints when a transfer starts or ends, worded and judged like the web app's alerts.
/// </summary>
internal static class TransferLines
{
    private const string Dot = " \u00B7 ";

    /// <summary>The line for a transfer that began. Never an error; the count is left out when the engine hasn't one yet.</summary>
    public static (bool IsError, string Text) Start(TransferJobDto job, string deviceName)
    {
        var folder = job.Origin.Kind == TransferOriginKind.WatchFolder ? LastSegment(job.Origin.WatchFolderPath) : null;
        var count = job.TotalFiles is { } total ? Files(total) : "files";
        var source = string.IsNullOrEmpty(folder) ? string.Empty : $" from {folder}";

        return (false, $"Sending {count}{source} to {deviceName}");
    }

    /// <summary>
    /// The line for a transfer that finished. A success only when it completed with nothing failed and no launch
    /// problem; every other ending is an error.
    /// </summary>
    public static (bool IsError, string Text) End(TransferJobDto job, string deviceName)
    {
        var sent = Files(job.FilesSent);

        return job.State switch
        {
            TransferJobState.Completed => Completed(job, deviceName),
            TransferJobState.Cancelled => (true, $"Transfer to {deviceName} cancelled{Dot}{sent} sent"),
            TransferJobState.Aborted => (true, $"Transfer to {deviceName} stopped{(job.Error is null ? "" : $": {job.Error}")}{Dot}{sent} sent"),
            TransferJobState.Abandoned => (true, $"Transfer to {deviceName} stopped: the sender went away{Dot}{sent} sent"),
            _ => throw new ArgumentOutOfRangeException(nameof(job), job.State, "The transfer hasn't ended.")
        };
    }

    private static (bool IsError, string Text) Completed(TransferJobDto job, string deviceName)
    {
        var text = job.FilesFailed == 0
            ? $"Sent {Files(job.FilesSent)} to {deviceName}"
            : $"Sent {job.FilesSent} of {Files(job.FilesSent + job.FilesFailed)} to {deviceName}{Dot}{job.FilesFailed} didn't arrive";
        var file = LastSegment(job.LaunchedPath);

        text += job.LaunchState switch
        {
            TransferLaunchState.Launched => $"{Dot}launched {file}",
            TransferLaunchState.Failed => $"{Dot}couldn't launch {file}{(job.LaunchError is null ? "" : $": {job.LaunchError}")}",
            TransferLaunchState.Incompatible => $"{Dot}{file} can't run on the TeensyROM",
            _ => string.Empty
        };

        var isError = job.FilesFailed > 0 || job.LaunchState is not (TransferLaunchState.None or TransferLaunchState.Launched);
        return (isError, text);
    }

    private static string Files(int count) => count == 1 ? "1 file" : $"{count} files";

    private static string? LastSegment(string? path) =>
        path?.TrimEnd('/', '\\').Split('/', '\\').LastOrDefault();
}
