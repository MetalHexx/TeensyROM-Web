using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Storage;

/// <summary>
/// The cache is one dictionary shared by the transfer pump, which upserts each file it has written, and by whoever
/// persists it: a finalizing or cancelled job calls <see cref="BaseStorageCache.WriteToDisk"/>. Persisting must never
/// enumerate the dictionary while an upsert is rewriting an entry.
/// </summary>
public sealed class BaseStorageCacheConcurrencyTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), $"tr-cache-{Guid.NewGuid():N}");

    private sealed class TempFileCache(string cacheFilePath) : BaseStorageCache
    {
        protected override string CacheFilePath => cacheFilePath;
        protected override BanLists Bans => new([], []);
    }

    private static FileItem File(string path) =>
        new() { Name = new FilePath(path).FileName, Path = new FilePath(path) };

    [Fact]
    public async Task WriteToDisk_WhileAnotherThreadUpsertsFiles_NeverEnumeratesTheCacheMidChange()
    {
        var cache = new TempFileCache(Path.Combine(_directory, "cache.json"));
        using var stop = new CancellationTokenSource();

        // Each upsert removes and re-adds its directory's entry, the change that breaks an enumeration under way.
        // The names repeat, so the cache stays small and every persist is quick.
        var upserter = Task.Run(() =>
        {
            for (var i = 0; !stop.IsCancellationRequested; i++)
            {
                cache.UpsertFile(File($"/music/dir{i % 8}/file{i % 40}.sid"));
            }
        });

        try
        {
            var persist = () =>
            {
                for (var i = 0; i < 300; i++) cache.WriteToDisk();
            };

            persist.Should().NotThrow();
        }
        finally
        {
            stop.Cancel();
            await upserter;
        }
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory)) Directory.Delete(_directory, recursive: true);
    }
}
