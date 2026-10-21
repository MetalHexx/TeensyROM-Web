using System.Text.Json;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Storage.Entities;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// Banning goes through tr-web's ban endpoint, which needs an online device and a file that exists, so these scenarios
/// skip without a device. On CI the ban itself is covered by the endpoint's own unit tests in tr-web.
/// </summary>
[Collection(RealApiCollection.Name)]
public sealed class SettingsAndBanScenarios(SharedApiFixture api)
{
    private const int MaxDirectoriesWalked = 20;

    [SkippableFact]
    public async Task BanFile_AddsTheNameOnce_ReportsASecondBanAsAlreadyBanned_AndLeavesEverythingElseAlone()
    {
        var (cli, storage, storageType, found) = await ArrangeAsync();
        using var _ = cli;
        var original = await api.Api.GetSettingsAsync();

        try
        {
            var first = await storage.BanFile(found.File.Path, storageType);
            var second = await storage.BanFile(found.File.Path, storageType);

            first.AlreadyBanned.Should().BeFalse();
            second.AlreadyBanned.Should().BeTrue();
            second.BannedFileName.Should().Be(first.BannedFileName);

            var banned = await api.Api.GetSettingsAsync();

            banned.SearchSettings.BannedFiles.Count(name => name == first.BannedFileName).Should().Be(1);
            banned.SearchSettings.BannedFiles.Where(name => name != first.BannedFileName)
                .Should().BeEquivalentTo(original.SearchSettings.BannedFiles.Where(name => name != first.BannedFileName));
            UnrelatedSections(banned).Should().Be(UnrelatedSections(original));
        }
        finally
        {
            await RestoreAsync(original);
        }

        Json(await api.Api.GetSettingsAsync()).Should().Be(Json(original));
    }

    [SkippableFact]
    public async Task FileBan_ThroughTheCommandLine_ReportsASecondBanAsAlreadyBanned_WithCleanStdout()
    {
        var (services, _, storageType, found) = await ArrangeAsync();
        using var servicesScope = services;
        var original = await api.Api.GetSettingsAsync();
        var storageName = storageType == TeensyStorageType.USB ? "usb" : "sd";
        var args = new[] { "file", "ban", found.File.Path, "--device", api.OnlineDevices[0].DeviceId, "--storage", storageName, "--json" };

        try
        {
            using var first = new CliHarness();
            (await first.RunAsync(args)).Should().Be(0);
            using var second = new CliHarness();
            (await second.RunAsync(args)).Should().Be(0);

            Ban(first).GetProperty("alreadyBanned").GetBoolean().Should().BeFalse();
            Ban(second).GetProperty("alreadyBanned").GetBoolean().Should().BeTrue();
            Ban(second).GetProperty("path").GetString().Should().Be(found.File.Path);
        }
        finally
        {
            await RestoreAsync(original);
        }
    }

    private static JsonElement Ban(CliHarness cli)
    {
        using var document = JsonDocument.Parse(cli.Output);
        return document.RootElement.EnumerateArray().Single().Clone();
    }

    [SkippableFact]
    public async Task BanFile_HidesTheFileFromItsDirectoryListing()
    {
        var (cli, storage, storageType, found) = await ArrangeAsync();
        using var _ = cli;
        var original = await api.Api.GetSettingsAsync();

        try
        {
            await storage.BanFile(found.File.Path, storageType);

            var after = await storage.GetDirectory(found.Listing.Path);

            var expected = found.Listing.Files.Select(f => f.Name).Where(name => !name.Equals(found.File.Name, StringComparison.OrdinalIgnoreCase));
            after.Files.Select(f => f.Name).Should().BeEquivalentTo(expected);
        }
        finally
        {
            await RestoreAsync(original);
        }
    }

    /// <summary>Selects the first online device and finds a file on it that can be banned; skips when there is none.</summary>
    private async Task<(CliServices Cli, IStorageService Storage, TeensyStorageType StorageType, FoundFile Found)> ArrangeAsync()
    {
        Skip.If(api.OnlineDevices.Count == 0, "no TeensyROM is online in the test API");
        var device = api.OnlineDevices[0];
        var storageType = CliServices.AvailableStorageOrSkip(device);

        var cli = new CliServices();
        cli.SelectDevice(device);
        var storage = cli.Get<IStorageService>();
        storage.SwitchStorage(storageType);

        if (await FindDirectoryHoldingAFile(storage) is not { } found)
        {
            cli.Dispose();
            throw new SkipException($"no file within the first {MaxDirectoriesWalked} directories of {device.Name}'s storage");
        }
        return (cli, storage, storageType, found);
    }

    /// <summary>
    /// Walks breadth-first from the root for the first directory holding a file the CLI can ban (a launchable one).
    /// </summary>
    private static async Task<FoundFile?> FindDirectoryHoldingAFile(IStorageService storage)
    {
        var pending = new Queue<string>(["/"]);

        for (var walked = 0; walked < MaxDirectoriesWalked && pending.Count > 0; walked++)
        {
            var listing = await storage.GetDirectory(pending.Dequeue());

            if (listing.Files.OfType<ILaunchableItem>().FirstOrDefault() is { } file) return new FoundFile(listing, file);

            foreach (var directory in listing.Directories) pending.Enqueue(directory.Path);
        }
        return null;
    }

    private Task RestoreAsync(GetSettingsResponse original) => api.Api.SaveSettingsAsync(new SaveSettingsRequest
    {
        KnownDevices = original.KnownDevices,
        PlayerSettings = original.PlayerSettings,
        FileTransferSettings = original.FileTransferSettings,
        SearchSettings = original.SearchSettings,
        AppSettings = original.AppSettings
    });

    /// <summary>Everything a ban must not touch: all sections, and in search settings everything but the banned files.</summary>
    private static string UnrelatedSections(GetSettingsResponse settings) => Json(new
    {
        settings.KnownDevices,
        settings.PlayerSettings,
        settings.FileTransferSettings,
        settings.AppSettings,
        settings.SearchSettings.SearchWeights,
        settings.SearchSettings.SearchStopWords,
        settings.SearchSettings.BannedDirectories
    });

    private static string Json<T>(T value) => JsonSerializer.Serialize(value);

    private sealed record FoundFile(DirectoryListing Listing, ILaunchableItem File);
}
