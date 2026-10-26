using Spectre.Console;
using TeensyRom.Cli.Helpers;

namespace TeensyRom.Cli.Commands.WatchFolder;

/// <summary>One row of the folders table; <paramref name="Folder"/> and <paramref name="State"/> are empty after a folder's first row.</summary>
internal sealed record WatchFolderRow(string Folder, string State, string Device, string Storage, string SendTo, string Launch);

/// <summary>The watch folders as one table row per destination, shared by the Watch Folders screen and <c>trom watch-folder list</c>.</summary>
internal static class WatchFolderTable
{
    public static IReadOnlyList<WatchFolderRow> Rows(IEnumerable<WatchFolderJson> folders)
    {
        var rows = new List<WatchFolderRow>();

        foreach (var folder in folders)
        {
            var state = Capitalised(folder.State);

            if (folder.Destinations.Count == 0)
            {
                rows.Add(new WatchFolderRow(folder.Path, state, string.Empty, string.Empty, string.Empty, string.Empty));
                continue;
            }
            for (var i = 0; i < folder.Destinations.Count; i++)
            {
                var destination = folder.Destinations[i];

                rows.Add(new WatchFolderRow(
                    i == 0 ? folder.Path : string.Empty,
                    i == 0 ? state : string.Empty,
                    destination.DeviceName ?? destination.DeviceId,
                    destination.Storage.ToUpperInvariant(),
                    destination.Path,
                    destination.Launch ? "Yes" : "No"));
            }
        }
        return rows;
    }

    public static Table Build(IEnumerable<WatchFolderJson> folders)
    {
        var table = new Table().BorderColor(RadHelper.Theme.Secondary.Color).Border(TableBorder.Rounded);

        foreach (var header in new[] { "Folder", "State", "Device", "Storage", "Send to", "Launch" }) table.AddColumn(header);

        foreach (var row in Rows(folders))
        {
            table.AddRow(new Text(row.Folder), new Text(row.State), new Text(row.Device), new Text(row.Storage), new Text(row.SendTo), new Text(row.Launch));
        }
        return table;
    }

    private static string Capitalised(string value) => value.Length == 0 ? value : char.ToUpperInvariant(value[0]) + value[1..];
}
