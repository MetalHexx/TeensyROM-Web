using Spectre.Console;
using Spectre.Console.Cli;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Commands.WatchFolder;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Commands.Transfer;

/// <summary>One transfer as <c>trom transfer list --json</c> writes it; <paramref name="State"/> is the job's state, such as <c>receiving</c>.</summary>
internal sealed record TransferJson(
    string JobId,
    string DeviceId,
    string? DeviceName,
    string Storage,
    string Destination,
    TransferFromJson From,
    string State,
    int FilesReceived,
    int FilesSent,
    int FilesFailed,
    int? TotalFiles,
    TransferLaunchJson Launch);

/// <summary>Where a transfer's files came from: <paramref name="Kind"/> is <c>upload</c> or <c>watchFolder</c>.</summary>
internal sealed record TransferFromJson(string Kind, string? WatchFolderId, string? WatchFolderPath);

/// <summary>How a transfer's launch went: <paramref name="State"/> is <c>none</c>, <c>pending</c>, <c>launched</c>, <c>incompatible</c> or <c>failed</c>.</summary>
internal sealed record TransferLaunchJson(string State, string? Path, string? Error);

internal sealed class TransferListSettings : TromSettings;

/// <summary><c>trom transfer list</c>: the transfers tr-web is running or has just finished, from uploads and watch folders alike.</summary>
internal sealed class TransferListCommand(ICliOutput output, IEngineControl engine, ITransferService transfers, IDeviceService devices)
    : EngineCommand<TransferListSettings>(output, engine)
{
    protected override async Task<int> RunAsync(CommandContext context, TransferListSettings settings, CancellationToken ct)
    {
        var jobs = await transfers.ListAsync(ct);
        var names = jobs.Count == 0
            ? new Dictionary<string, string>()
            : (await devices.GetDevicesAsync(ct)).ToDictionary(device => device.Id, device => device.Name);
        var listed = jobs.Select(job => ToJson(job, names.GetValueOrDefault(job.DeviceId))).ToList();

        switch (Output.Mode)
        {
            case OutputMode.Json:
                Output.Json(listed);
                break;
            case OutputMode.Plain:
                Output.Lines(listed.Select(job => job.JobId));
                break;
            default:
                if (listed.Count == 0)
                {
                    Output.Notice("No transfers.");
                    break;
                }
                Output.Out.Write(ToTable(listed));
                break;
        }
        return 0;
    }

    private static TransferJson ToJson(TransferJobDto job, string? deviceName) => new(
        job.JobId,
        job.DeviceId,
        deviceName,
        WatchFolderOutput.StorageName(job.StorageType),
        job.DestinationDirectory,
        new TransferFromJson(WatchFolderOutput.Name(job.Origin.Kind), job.Origin.WatchFolderId, job.Origin.WatchFolderPath),
        WatchFolderOutput.Name(job.State),
        job.FilesReceived,
        job.FilesSent,
        job.FilesFailed,
        job.TotalFiles,
        new TransferLaunchJson(WatchFolderOutput.Name(job.LaunchState), job.LaunchedPath, job.LaunchError));

    private static Table ToTable(IReadOnlyList<TransferJson> jobs)
    {
        var table = new Table().BorderColor(RadHelper.Theme.Secondary.Color).Border(TableBorder.Rounded);

        foreach (var header in new[] { "Device", "Destination", "From", "Files", "State" }) table.AddColumn(header);

        foreach (var job in jobs)
        {
            table.AddRow(
                new Text(job.DeviceName ?? job.DeviceId),
                new Text(job.Destination),
                new Text(job.From.WatchFolderPath ?? job.From.Kind),
                new Text($"{job.FilesSent} of {job.TotalFiles ?? job.FilesReceived}"),
                new Text(job.State));
        }
        return table;
    }
}
