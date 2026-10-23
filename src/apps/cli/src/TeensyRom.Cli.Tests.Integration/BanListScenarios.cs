using System.Text.Json;
using TeensyRom.Cli.Api.Generated;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// <c>file banned</c> and <c>file unban</c> against the real engine. Bans are engine-wide settings, so no device is needed.
/// </summary>
[Collection(RealApiCollection.Name)]
public sealed class BanListScenarios(SharedApiFixture api)
{
    private const string BannedFile = "CliBanListScenario.sid";
    private const string KeptFile = "CliBanListKept.sid";
    private const string BannedFolder = "/cli-ban-list-scenario/bad";
    private const string KeptFolder = "/cli-ban-list-scenario/kept";

    [Fact]
    public async Task BannedThenUnban_ListsTheSeededBans_AndLiftsOnlyTheNamedOnes()
    {
        var original = await api.Api.GetSettingsAsync();

        try
        {
            var search = JsonSerializer.Deserialize<SearchSettingsDto>(JsonSerializer.Serialize(original.SearchSettings))!;
            search.BannedFiles = [.. original.SearchSettings.BannedFiles, BannedFile, KeptFile];
            search.BannedDirectories = [.. original.SearchSettings.BannedDirectories, BannedFolder, KeptFolder];
            await Save(original, search);

            using var listing = new CliHarness();
            (await listing.RunAsync("file", "banned", "--json")).Should().Be(0, listing.Error);
            var listed = Entries(listing.Output);

            listed.Should().Contain([(BannedFolder, "folder"), (KeptFolder, "folder"), (BannedFile, "file"), (KeptFile, "file")]);

            using var unban = new CliHarness();
            (await unban.RunAsync("file", "unban", $"/music/{BannedFile}", BannedFolder, "--json")).Should().Be(0, unban.Error);

            using var document = JsonDocument.Parse(unban.Output);
            document.RootElement.EnumerateArray().Select(r => (r.GetProperty("kind").GetString(), r.GetProperty("lifted").GetBoolean()))
                .Should().Equal(("file", true), ("folder", true));

            var after = (await api.Api.GetSettingsAsync()).SearchSettings;

            after.BannedFiles.Should().BeEquivalentTo([.. original.SearchSettings.BannedFiles, KeptFile]);
            after.BannedDirectories.Should().BeEquivalentTo([.. original.SearchSettings.BannedDirectories, KeptFolder]);
        }
        finally
        {
            await Save(original, original.SearchSettings);
        }
    }

    [Fact]
    public async Task Unban_OfAnEntryThatIsNotBanned_ExitsZero_AndChangesNothing()
    {
        var original = await api.Api.GetSettingsAsync();

        try
        {
            using var cli = new CliHarness();

            (await cli.RunAsync("file", "unban", "CliNeverBanned.sid", "--json")).Should().Be(0, cli.Error);

            using var document = JsonDocument.Parse(cli.Output);
            var result = document.RootElement.EnumerateArray().Single();
            result.GetProperty("ok").GetBoolean().Should().BeTrue();
            result.GetProperty("lifted").GetBoolean().Should().BeFalse();
            (await api.Api.GetSettingsAsync()).SearchSettings.BannedFiles.Should().BeEquivalentTo(original.SearchSettings.BannedFiles);
        }
        finally
        {
            await Save(original, original.SearchSettings);
        }
    }

    private static (string?, string?)[] Entries(string json)
    {
        using var document = JsonDocument.Parse(json);

        return [.. document.RootElement.EnumerateArray().Select(e => (e.GetProperty("entry").GetString(), e.GetProperty("kind").GetString()))];
    }

    private Task Save(GetSettingsResponse original, SearchSettingsDto search) => api.Api.SaveSettingsAsync(new SaveSettingsRequest
    {
        KnownDevices = original.KnownDevices,
        PlayerSettings = original.PlayerSettings,
        FileTransferSettings = original.FileTransferSettings,
        SearchSettings = search,
        AppSettings = original.AppSettings
    });
}
