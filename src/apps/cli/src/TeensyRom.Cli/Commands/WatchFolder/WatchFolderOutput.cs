using System.Text.Json;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Output;

namespace TeensyRom.Cli.Commands.WatchFolder;

/// <summary>One watch folder as <c>trom watch-folder --json</c> writes it; <paramref name="State"/> is <c>watching</c>, <c>off</c> or <c>unavailable</c>.</summary>
internal sealed record WatchFolderJson(string Id, string Path, bool Enabled, string State, IReadOnlyList<WatchFolderDestinationJson> Destinations);

/// <summary>Where a watch folder's files go: <paramref name="Storage"/> is <c>sd</c> or <c>usb</c>.</summary>
internal sealed record WatchFolderDestinationJson(string Id, string DeviceId, string? DeviceName, string Storage, string Path, bool Launch);

/// <summary>What <c>trom watch-folder add --json</c> writes; <paramref name="Created"/> is false when the folder was already watched.</summary>
internal sealed record WatchFolderAddJson(bool Created, WatchFolderJson Folder);

/// <summary>What <c>trom watch-folder remove --json</c> writes; <paramref name="DeviceId"/> is absent when the whole folder was removed.</summary>
internal sealed record WatchFolderRemoveJson(string Path, string? DeviceId, bool FolderRemoved);

/// <summary>Maps tr-web's watch folders to the CLI's JSON and shows them the way every watch-folder verb does.</summary>
internal static class WatchFolderOutput
{
    /// <summary>An enum's name in lower camel case, as <c>--json</c> writes enums.</summary>
    public static string Name<TEnum>(TEnum value) where TEnum : struct, Enum => JsonNamingPolicy.CamelCase.ConvertName(value.ToString());

    public static string StorageName(TeensyStorageType storage) => storage.ToString().ToLowerInvariant();

    public static WatchFolderJson ToJson(WatchFolderDto folder) => ToJson(folder.Id, folder.Path, folder.Enabled, folder.State, folder.Destinations);

    public static WatchFolderJson ToJson(WatchFolderDto2 folder) => ToJson(folder.Id, folder.Path, folder.Enabled, folder.State, folder.Destinations);

    /// <summary>One watch folder: JSON, or its fields for a person or a pipe.</summary>
    public static void Show(ICliOutput output, WatchFolderJson folder)
    {
        if (output.Mode == OutputMode.Json)
        {
            output.Json(folder);
            return;
        }
        var fields = new List<(string Label, string Value)> { ("Folder", folder.Path), ("State", folder.State) };

        if (output.Mode == OutputMode.Plain)
        {
            fields.Add(("Destinations", Destinations(folder)));
        }
        else
        {
            foreach (var destination in folder.Destinations)
            {
                fields.Add(("Device", destination.DeviceName ?? destination.DeviceId));
                fields.Add(("Storage", destination.Storage.ToUpperInvariant()));
                fields.Add(("Send to", destination.Path));
                fields.Add(("Launch", destination.Launch ? "Yes" : "No"));
            }
        }
        output.Fields(fields);
    }

    public static void ShowList(ICliOutput output, IReadOnlyList<WatchFolderJson> folders)
    {
        switch (output.Mode)
        {
            case OutputMode.Json:
                output.Json(folders);
                break;
            case OutputMode.Plain:
                output.Lines(folders.Select(folder => folder.Path));
                break;
            default:
                if (folders.Count == 0)
                {
                    output.Notice("No watch folders.");
                    break;
                }
                output.Out.Write(WatchFolderTable.Build(folders));
                break;
        }
    }

    private static string Destinations(WatchFolderJson folder) =>
        string.Join(", ", folder.Destinations.Select(destination =>
            $"{destination.DeviceName ?? destination.DeviceId}: {destination.Storage} {destination.Path}{(destination.Launch ? " (launches)" : string.Empty)}"));

    private static WatchFolderJson ToJson(string id, string path, bool enabled, WatchFolderState state, IEnumerable<WatchFolderDestinationDto> destinations) =>
        new(id, path, enabled, Name(state),
            destinations.Select(d => new WatchFolderDestinationJson(d.Id, d.DeviceId, d.DeviceName, StorageName(d.StorageType), d.Path, d.Launch)).ToList());
}
