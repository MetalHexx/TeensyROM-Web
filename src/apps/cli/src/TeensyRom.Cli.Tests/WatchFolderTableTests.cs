using TeensyRom.Cli.Commands.WatchFolder;

namespace TeensyRom.Cli.Tests;

/// <summary>The rows the Watch Folders screen and <c>trom watch-folder list</c> both render.</summary>
public sealed class WatchFolderTableTests
{
    private static WatchFolderDestinationJson Destination(string deviceId, string? name, string storage, string path, bool launch) =>
        new($"d-{deviceId}", deviceId, name, storage, path, launch);

    private static WatchFolderJson Folder(string path, string state, params WatchFolderDestinationJson[] destinations) =>
        new("wf-" + path, path, state == "watching", state, destinations);

    [Fact]
    public void AFolderWithTwoDestinations_ShowsItsPathAndStateOnTheFirstRowOnly()
    {
        var rows = WatchFolderTable.Rows(
        [
            Folder("/roms", "watching", Destination("a-1", "Alpha", "sd", "/auto-transfer", true), Destination("b-1", null, "usb", "/games", false))
        ]);

        rows.Should().Equal(
            new WatchFolderRow("/roms", "Watching", "Alpha", "SD", "/auto-transfer", "Yes"),
            new WatchFolderRow(string.Empty, string.Empty, "b-1", "USB", "/games", "No"));
    }

    [Fact]
    public void AFolderWithNoDestinations_StillGetsOneRow()
    {
        var rows = WatchFolderTable.Rows([Folder("/roms", "unavailable")]);

        rows.Should().Equal(new WatchFolderRow("/roms", "Unavailable", string.Empty, string.Empty, string.Empty, string.Empty));
    }

    [Fact]
    public void EachFolder_StartsItsOwnFirstRow()
    {
        var rows = WatchFolderTable.Rows(
        [
            Folder("/one", "watching", Destination("a-1", "Alpha", "sd", "/x", false)),
            Folder("/two", "off", Destination("a-1", "Alpha", "sd", "/x", false))
        ]);

        rows.Select(row => (row.Folder, row.State)).Should().Equal(("/one", "Watching"), ("/two", "Off"));
    }
}
