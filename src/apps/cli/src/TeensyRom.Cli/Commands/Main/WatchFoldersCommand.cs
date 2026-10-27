using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Rendering;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Commands.WatchFolder;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Services;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Commands.Main;

/// <summary>
/// The Watch Folders screen of the menu: the watch folders and the transfers running now, kept fresh while the user
/// picks what to change.
/// </summary>
internal class WatchFoldersCommand(IWatchFolderService watchFolders, ITransferService transfers, IDeviceService devices)
    : AsyncCommand<WatchFoldersSettings>
{
    private const string AddFolder = "Add Watch Folder";
    private const string AddDestination = "Add Destination";
    private const string EditDestination = "Edit Destination";
    private const string RemoveDestination = "Remove Destination";
    private const string ToggleFolder = "Turn Folder On/Off";
    private const string RemoveFolder = "Remove Watch Folder";
    private const string Back = "Back";
    private const string DefaultDeviceFolder = "/auto-transfer";
    private const string NoFolders = "No watch folders yet.";

    private static readonly TimeSpan RefreshInterval = TimeSpan.FromSeconds(1);

    private static readonly string[] Choices = [AddFolder, AddDestination, EditDestination, RemoveDestination, ToggleFolder, RemoveFolder, Back];

    public override async Task<int> ExecuteAsync(CommandContext context, WatchFoldersSettings settings)
    {
        string choice;

        do
        {
            choice = await LiveChoicePrompt.ShowAsync(AnsiConsole.Console, "Choose wisely", Choices, BuildHeaderAsync, RefreshInterval, CancellationToken.None);

            try
            {
                switch (choice)
                {
                    case AddFolder: await AddFolderAsync(); break;
                    case AddDestination: await AddDestinationAsync(); break;
                    case EditDestination: await EditDestinationAsync(); break;
                    case RemoveDestination: await RemoveDestinationAsync(); break;
                    case ToggleFolder: await ToggleFolderAsync(); break;
                    case RemoveFolder: await RemoveFolderAsync(); break;
                }
            }
            catch (TeensyApiException ex)
            {
                RadHelper.WriteError(ex.Message);
            }
        } while (choice != Back);

        RadHelper.WriteLine();
        return 0;
    }

    // ---- the live header ---------------------------------------------------------------------------------------------

    private async Task<IRenderable> BuildHeaderAsync(CancellationToken ct)
    {
        var folders = await watchFolders.ListAsync(ct);
        var running = (await transfers.ListAsync(ct))
            .Where(job => job.State is TransferJobState.Created or TransferJobState.Receiving or TransferJobState.Sealed)
            .ToList();
        var names = running.Count == 0
            ? new Dictionary<string, string>()
            : (await devices.GetDevicesAsync(ct)).ToDictionary(device => device.Id, device => device.Name);

        var rows = new List<IRenderable>
        {
            RadHelper.BuildMenu("Watch Folders", "Send files that land in a folder to your TeensyROM."),
            LiveChoicePrompt.BlankLine,
            FoldersTable(folders),
            LiveChoicePrompt.BlankLine,
            new Markup($"[{RadHelper.Theme.Primary}]Running transfers[/]"),
            running.Count == 0 ? new Markup("Nothing is being sent.") : TransfersTable(running, names)
        };
        return new Rows(rows);
    }

    private static IRenderable FoldersTable(IReadOnlyList<WatchFolderDto> folders)
    {
        if (folders.Count == 0) return new Markup(NoFolders);

        return WatchFolderTable.Build(folders.Select(WatchFolderOutput.ToJson));
    }

    private static IRenderable TransfersTable(IReadOnlyList<TransferJobDto> jobs, IReadOnlyDictionary<string, string> names)
    {
        var table = NewTable("Device", "From", "Files", "State");

        foreach (var job in jobs)
        {
            table.AddRow(
                new Text(names.GetValueOrDefault(job.DeviceId) ?? job.DeviceId),
                new Text(job.Origin.WatchFolderPath ?? "upload"),
                new Text($"{job.FilesSent} of {job.TotalFiles ?? job.FilesReceived}"),
                new Text(job.State == TransferJobState.Sealed ? "Sending" : "Receiving"));
        }
        return table;
    }

    private static Table NewTable(params string[] headers)
    {
        var table = new Table().BorderColor(RadHelper.Theme.Secondary.Color).Border(TableBorder.Rounded);

        foreach (var header in headers) table.AddColumn(header);
        return table;
    }

    private static string Storage(WatchFolderDestinationDto destination) => destination.StorageType.ToString().ToUpperInvariant();

    // ---- the actions -------------------------------------------------------------------------------------------------

    private async Task AddFolderAsync()
    {
        var path = PromptHelper.RequiredLengthTextPrompt("Folder to watch", 1).Trim();
        string folder;

        try
        {
            folder = Path.GetFullPath(path);
        }
        catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException)
        {
            RadHelper.WriteError($"{path} isn't a valid folder path.");
            return;
        }
        if (!Directory.Exists(folder))
        {
            RadHelper.WriteError($"{folder} isn't a folder on this computer.");
            return;
        }
        await AddDestinationToAsync(folder, new HashSet<string>());
    }

    private async Task AddDestinationAsync()
    {
        var folder = await PickFolderAsync();

        if (folder is null) return;

        await AddDestinationToAsync(folder.Path, folder.Destinations.Select(destination => destination.DeviceId).ToHashSet());
    }

    private async Task AddDestinationToAsync(string folder, IReadOnlySet<string> takenDeviceIds)
    {
        var online = (await devices.GetDevicesAsync()).Where(device => device.IsOnline).ToList();
        var offered = online.Where(device => !takenDeviceIds.Contains(device.Id)).ToList();

        if (offered.Count == 0)
        {
            if (online.Count == 0) RadHelper.WriteError("No TeensyROM is online. Connect one, then run `trom device discover`.");
            else RadHelper.WriteLine("Every online TeensyROM already receives this folder.");
            return;
        }
        var device = offered.Count == 1 ? offered[0] : PickDevice(offered);
        var storage = PickStorage(device);

        if (storage is null) return;

        var devicePath = PromptHelper.DefaultValueTextPrompt("Device folder", 1, DefaultDeviceFolder);
        var launch = PromptHelper.Confirm("Launch files sent here?", false);

        await watchFolders.AddAsync(folder, device.Id, storage.Value, devicePath, launch, CancellationToken.None);
    }

    private async Task EditDestinationAsync()
    {
        var folder = await PickFolderAsync();

        if (folder is null) return;

        var byDevice = DestinationsByDevice(folder);

        if (byDevice.Count == 0)
        {
            RadHelper.WriteLine("That folder has no destinations.");
            return;
        }
        var chosen = byDevice.Count == 1 ? byDevice.Values.Single() : byDevice[PromptHelper.FilePrompt("Edit destination", byDevice.Keys.ToList())];
        var current = chosen.First();

        var devicePath = PromptHelper.DefaultValueTextPrompt("Device folder", 1, current.Path).Trim();
        var launch = PromptHelper.Confirm("Launch files sent here?", current.Launch);

        var newPath = devicePath == current.Path ? null : devicePath;
        bool? newLaunch = launch == current.Launch ? null : launch;

        if (newPath is null && newLaunch is null)
        {
            RadHelper.WriteLine("Nothing changed.");
            return;
        }
        await watchFolders.SetDeviceAsync(folder.Id, current.DeviceId, newPath, newLaunch, CancellationToken.None);
    }

    private async Task RemoveDestinationAsync()
    {
        var folder = await PickFolderAsync();

        if (folder is null) return;

        var byDevice = DestinationsByDevice(folder);
        var label = PromptHelper.FilePrompt("Remove destination", byDevice.Keys.ToList());

        await watchFolders.RemoveDeviceAsync(folder.Id, byDevice[label].First().DeviceId, CancellationToken.None);
    }

    /// <summary>The folder's destinations grouped by device, keyed by the label a person picks from.</summary>
    private static Dictionary<string, List<WatchFolderDestinationDto>> DestinationsByDevice(WatchFolderDto folder) => folder.Destinations
        .GroupBy(destination => destination.DeviceId)
        .ToDictionary(
            group => $"{group.First().DeviceName ?? group.Key} ({string.Join(", ", group.Select(destination => $"{Storage(destination)} {destination.Path}"))})",
            group => group.ToList());

    private async Task ToggleFolderAsync()
    {
        var folder = await PickFolderAsync();

        if (folder is null) return;

        await watchFolders.SetEnabledAsync(folder.Id, !folder.Enabled, CancellationToken.None);
    }

    private async Task RemoveFolderAsync()
    {
        var folder = await PickFolderAsync();

        if (folder is null) return;
        if (!PromptHelper.Confirm(Markup.Escape($"Stop watching {folder.Path}?"), false)) return;

        await watchFolders.RemoveAsync(folder.Id, CancellationToken.None);
    }

    // ---- prompts -----------------------------------------------------------------------------------------------------

    private async Task<WatchFolderDto?> PickFolderAsync()
    {
        var folders = await watchFolders.ListAsync(CancellationToken.None);

        if (folders.Count == 0)
        {
            RadHelper.WriteLine(NoFolders);
            return null;
        }
        var path = PromptHelper.FilePrompt("Watch folder", folders.Select(folder => folder.Path).ToList());

        return folders.First(folder => folder.Path == path);
    }

    private static DeviceSummary PickDevice(IReadOnlyList<DeviceSummary> options)
    {
        var labels = options.ToDictionary(device => options.Count(other => other.Name == device.Name) > 1 ? $"{device.Name} ({device.Id})" : device.Name);

        return labels[PromptHelper.FilePrompt("Device", labels.Keys.ToList())];
    }

    private static TeensyStorageType? PickStorage(DeviceSummary device)
    {
        var available = new List<TeensyStorageType>();

        if (device.SdAvailable) available.Add(TeensyStorageType.SD);
        if (device.UsbAvailable) available.Add(TeensyStorageType.USB);

        switch (available.Count)
        {
            case 0:
                RadHelper.WriteError($"{device.Name} has no storage available.");
                return null;
            case 1:
                return available[0];
            default:
                var choice = PromptHelper.ChoicePrompt("Storage", available.Select(storage => storage.ToString()).ToList());
                return Enum.Parse<TeensyStorageType>(choice);
        }
    }
}
