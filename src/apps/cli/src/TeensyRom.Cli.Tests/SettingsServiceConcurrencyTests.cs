using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// Many <c>trom</c> processes start at once and each reads <c>Settings.json</c>; one may be saving it at the same time.
/// Threads over the test home's file stand in for the processes.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class SettingsServiceConcurrencyTests : IDisposable
{
    private readonly TeensySettings _original;

    public SettingsServiceConcurrencyTests()
    {
        _original = NewService().GetSettings();
    }

    public void Dispose() => NewService().SaveSettings(_original);

    private static SettingsService NewService() => new(new CliLoggingService());

    [Fact]
    public async Task GetSettings_FromManyReadersAtOnce_NeverFails()
    {
        NewService().SaveSettings(new TeensySettings { StorageType = TeensyStorageType.USB });
        using var start = new ManualResetEventSlim();

        var readers = Enumerable.Range(0, 16).Select(_ => Task.Run(() =>
        {
            start.Wait();
            return Enumerable.Range(0, 25).Select(__ => NewService().GetSettings().StorageType).ToList();
        })).ToList();

        start.Set();

        (await Task.WhenAll(readers)).SelectMany(reads => reads).Should().OnlyContain(storage => storage == TeensyStorageType.USB);
    }

    [Fact]
    public async Task GetSettings_WhileAnotherProcessSaves_NeverSeesAPartialFile()
    {
        NewService().SaveSettings(new TeensySettings { StorageType = TeensyStorageType.USB });
        using var stop = new CancellationTokenSource();

        var writer = Task.Run(() =>
        {
            var storage = TeensyStorageType.SD;
            while (!stop.IsCancellationRequested)
            {
                storage = storage == TeensyStorageType.SD ? TeensyStorageType.USB : TeensyStorageType.SD;
                NewService().SaveSettings(new TeensySettings { StorageType = storage });
            }
        });

        var readers = Enumerable.Range(0, 8).Select(_ => Task.Run(() =>
        {
            for (var read = 0; read < 100; read++) NewService().GetSettings();
        })).ToList();

        try { await Task.WhenAll(readers); }
        finally
        {
            stop.Cancel();
            await writer;
        }
    }

    [Fact]
    public void SaveSettings_LeavesNoTempFileBehind()
    {
        NewService().SaveSettings(new TeensySettings { StorageType = TeensyStorageType.SD });

        Directory.EnumerateFiles(Path.GetDirectoryName(SettingsConstants.SettingsPath)!, "*.tmp").Should().BeEmpty();
    }
}
