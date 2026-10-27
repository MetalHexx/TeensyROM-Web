using MediatR;
using TeensyRom.Api.Tests.Unit.Endpoints;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Games;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Music;
using TeensyRom.Core.Settings;
using TeensyRom.Core.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Storage;

public class StorageBanFilteringTests
{
    private static SearchSettings Bans(string[] directories, string[] files) =>
        new() { BannedDirectories = [.. directories], BannedFiles = [.. files] };

    private static FileItem File(string path) =>
        new() { Name = new FilePath(path).FileName, Path = new FilePath(path) };

    private static SongItem Song(string path) =>
        new() { Name = new FilePath(path).FileName, Path = new FilePath(path) };

    public class ReadTimeFiltering
    {
        private readonly IStorageCache _cache = Substitute.For<IStorageCache>();
        private readonly IMediator _mediator = Substitute.For<IMediator>();
        private SearchSettings _bans = Bans([], []);

        private StorageService NewService()
        {
            var sidMetadata = Substitute.For<ISidMetadataService>();
            sidMetadata.EnrichSong(Arg.Any<SongItem>()).Returns(call => call.Arg<SongItem>());

            return new(
                _cache,
                new StorageSettings
                {
                    CartStorage = new CartStorage(TeensyStorageType.SD, available: true) { DeviceId = "device-1" },
                    BanSource = () => _bans
                },
                _mediator,
                Substitute.For<ILoggingService>(),
                sidMetadata,
                Substitute.For<IGameMetadataService>(),
                Substitute.For<ICommunicationPort>(),
                LeaseDoubles.Free());
        }

        private static StorageCacheItem CachedMusicDirectory() => new()
        {
            Path = new DirectoryPath("/music"),
            Directories = [new DirectoryItem("/music/Docs"), new DirectoryItem("/music/tunes")],
            Files = [File("/music/1.sid"), File("/music/Commando_1.sid")]
        };

        [Fact]
        public async Task GetDirectory_CacheHit_DropsFileBannedAfterCachingAndLeavesCachedObjectIntact()
        {
            var cached = CachedMusicDirectory();
            _cache.GetByDirPath(Arg.Any<DirectoryPath>()).Returns(cached);
            _bans = Bans([], ["1.sid"]);

            var result = await NewService().GetDirectory(new DirectoryPath("/music"));

            result!.Files.Select(f => f.Name).Should().Equal("Commando_1.sid");
            cached.Files.Select(f => f.Name).Should().Equal("1.sid", "Commando_1.sid");
            result.Should().NotBeSameAs(cached);
        }

        [Fact]
        public async Task GetDirectory_CacheHit_DropsBannedSubdirectoriesByWholeSegment()
        {
            _cache.GetByDirPath(Arg.Any<DirectoryPath>()).Returns(CachedMusicDirectory());
            _bans = Bans(["Docs"], []);

            var result = await NewService().GetDirectory(new DirectoryPath("/music"));

            result!.Directories.Select(d => d.Path.Value).Should().Equal("/music/tunes/");
        }

        [Fact]
        public async Task GetDirectory_BannedDirectory_ReturnsNull()
        {
            _cache.GetByDirPath(Arg.Any<DirectoryPath>()).Returns(CachedMusicDirectory());
            _bans = Bans(["/music"], []);

            var result = await NewService().GetDirectory(new DirectoryPath("/music/tunes"));

            result.Should().BeNull();
        }

        [Fact]
        public async Task GetDirectory_BanSourceChangesBetweenCalls_SecondCallReflectsNewBans()
        {
            _cache.GetByDirPath(Arg.Any<DirectoryPath>()).Returns(CachedMusicDirectory());
            var service = NewService();

            var before = await service.GetDirectory(new DirectoryPath("/music"));
            _bans = Bans([], ["1.sid"]);
            var after = await service.GetDirectory(new DirectoryPath("/music"));

            before!.Files.Select(f => f.Name).Should().Equal("1.sid", "Commando_1.sid");
            after!.Files.Select(f => f.Name).Should().Equal("Commando_1.sid");
        }

        [Fact]
        public async Task GetDirectory_FreshFetch_CachesTheFullListingButReturnsItWithoutBannedFiles()
        {
            _cache.GetByDirPath(Arg.Any<DirectoryPath>()).Returns((IStorageCacheItem?)null);
            _mediator.Send(Arg.Any<GetDirectoryRecursiveCommand>(), Arg.Any<CancellationToken>())
                .Returns(new GetDirectoryRecursiveResult
                {
                    DirectoryContent =
                    [
                        new DirectoryContent
                        {
                            Path = new DirectoryPath("/music"),
                            Files = [File("/music/a.txt"), File("/music/b.txt")]
                        }
                    ]
                });
            _bans = Bans([], ["a.txt"]);

            var result = await NewService().GetDirectory(new DirectoryPath("/music"));

            result!.Files.Select(f => f.Name).Should().Equal("b.txt");
            _cache.Received(1).UpsertDirectory(
                Arg.Any<DirectoryPath>(),
                Arg.Is<IStorageCacheItem>(c => c.Files.Select(f => f.Name).SequenceEqual(new[] { "a.txt", "b.txt" })));
        }

        [Fact]
        public void UpsertTransferredFile_TwoLevelsBelowBannedDirectory_IsCachedWithoutThrowing()
        {
            _bans = Bans(["Docs"], []);

            var act = () => NewService().UpsertTransferredFile(new FilePath("/Docs/manuals/x.txt"), 10);

            act.Should().NotThrow();
            _cache.Received(1).UpsertFile(Arg.Is<FileItem>(f => f.Path.Value == "/Docs/manuals/x.txt"));
        }

        [Fact]
        public void UpsertTransferredFile_BannedFileName_IsCachedSoUnbanningShowsIt()
        {
            _bans = Bans([], ["1.sid"]);

            NewService().UpsertTransferredFile(new FilePath("/music/1.sid"), 10);

            _cache.Received(1).UpsertFile(Arg.Is<FileItem>(f => f.Name == "1.sid"));
        }
    }

    public class FactoryWiring : IDisposable
    {
        private readonly ISearchSettingsProvider _settingsProvider = Substitute.For<ISearchSettingsProvider>();
        private readonly IMediator _mediator = Substitute.For<IMediator>();
        private readonly ISidMetadataService _sidMetadata = Substitute.For<ISidMetadataService>();
        private readonly CartStorage _cart = new(TeensyStorageType.SD, available: true)
        {
            DeviceId = $"ban-wiring-{Guid.NewGuid():N}"
        };
        private SearchSettings _settings = Bans([], []);
        private IStorageService? _service;

        public FactoryWiring()
        {
            _settingsProvider.GetSearchSettings().Returns(_ => _settings);
            _sidMetadata.EnrichSong(Arg.Any<SongItem>()).Returns(call => call.Arg<SongItem>());
            _mediator.Send(Arg.Any<GetDirectoryRecursiveCommand>(), Arg.Any<CancellationToken>())
                .Returns(new GetDirectoryRecursiveResult
                {
                    DirectoryContent =
                    [
                        new DirectoryContent
                        {
                            Path = new DirectoryPath("/music"),
                            Files = [File("/music/1.sid"), File("/music/Commando_1.sid")]
                        }
                    ]
                });
        }

        public void Dispose() => _service?.ClearCache();

        private IStorageService CreateStorageService()
        {
            var factory = new StorageFactory(
                _mediator,
                Substitute.For<IGameMetadataService>(),
                _sidMetadata,
                Substitute.For<ILoggingService>(),
                _settingsProvider,
                LeaseDoubles.Free());

            _service = factory.Create(_cart, Substitute.For<ICommunicationPort>());
            return _service;
        }

        [Fact]
        public async Task GetDirectory_FileBannedAfterCreate_HiddenOnNextListing()
        {
            var service = CreateStorageService();

            var before = await service.GetDirectory(new DirectoryPath("/music"));
            _settings = Bans([], ["1.sid"]);
            var after = await service.GetDirectory(new DirectoryPath("/music"));

            before!.Files.Select(f => f.Name).Should().Equal("1.sid", "Commando_1.sid");
            after!.Files.Select(f => f.Name).Should().Equal("Commando_1.sid");
        }

        [Fact]
        public async Task GetDirectory_DirectoryBannedAfterCreate_ReturnsNullOnNextListing()
        {
            var service = CreateStorageService();

            var before = await service.GetDirectory(new DirectoryPath("/music"));
            _settings = Bans(["/music"], []);
            var after = await service.GetDirectory(new DirectoryPath("/music"));

            before.Should().NotBeNull();
            after.Should().BeNull();
        }

        private void DeviceListing(Func<string, DirectoryContent?> listing) =>
            _mediator.Send(Arg.Any<GetDirectoryRecursiveCommand>(), Arg.Any<CancellationToken>())
                .Returns(call =>
                {
                    var content = listing(call.Arg<GetDirectoryRecursiveCommand>().Path.Value);
                    return new GetDirectoryRecursiveResult { DirectoryContent = content is null ? [] : [content] };
                });

        [Fact]
        public async Task GetDirectory_FileBannedWhenFetched_ReappearsWhenBanIsRemoved()
        {
            var service = CreateStorageService();
            _settings = Bans([], ["1.sid"]);

            var whileBanned = await service.GetDirectory(new DirectoryPath("/music"));
            _settings = Bans([], []);
            var afterUnban = await service.GetDirectory(new DirectoryPath("/music"));

            whileBanned!.Files.Select(f => f.Name).Should().Equal("Commando_1.sid");
            afterUnban!.Files.Select(f => f.Name).Should().Equal("1.sid", "Commando_1.sid");
        }

        [Fact]
        public async Task GetDirectory_SubdirectoryBannedWhenFetched_ReappearsWhenBanIsRemoved()
        {
            DeviceListing(path => path == new DirectoryPath("/music").Value
                ? new DirectoryContent { Path = new DirectoryPath("/music"), Directories = [new DirectoryItem("/music/Docs")] }
                : null);
            var service = CreateStorageService();
            _settings = Bans(["Docs"], []);

            var whileBanned = await service.GetDirectory(new DirectoryPath("/music"));
            _settings = Bans([], []);
            var afterUnban = await service.GetDirectory(new DirectoryPath("/music"));

            whileBanned!.Directories.Should().BeEmpty();
            afterUnban!.Directories.Select(d => d.Path.Value).Should().Equal("/music/Docs/");
        }

        [Fact]
        public async Task ClearCache_WhileChildDirectoryBanned_EvictsTheChildSoUnbanningDoesNotServeStaleFiles()
        {
            var docsFiles = new List<FileItem> { File("/music/Docs/old.txt") };
            DeviceListing(path =>
                path == new DirectoryPath("/music").Value
                    ? new DirectoryContent { Path = new DirectoryPath("/music"), Directories = [new DirectoryItem("/music/Docs")] }
                : path == new DirectoryPath("/music/Docs").Value
                    ? new DirectoryContent { Path = new DirectoryPath("/music/Docs"), Files = [.. docsFiles] }
                    : null);
            var service = CreateStorageService();
            await service.GetDirectory(new DirectoryPath("/music"));
            await service.GetDirectory(new DirectoryPath("/music/Docs"));

            _settings = Bans(["Docs"], []);
            service.ClearCache(new DirectoryPath("/music"));
            docsFiles.Clear();
            _settings = Bans([], []);
            var docs = await service.GetDirectory(new DirectoryPath("/music/Docs"));

            docs!.Files.Should().BeEmpty();
        }
    }

    public class CacheFiltering
    {
        private SearchSettings _bans = Bans([], []);

        private sealed class TestCache(Func<SearchSettings> bans) : BaseStorageCache
        {
            protected override string CacheFilePath => Path.Combine(Path.GetTempPath(), "ban-filtering-tests-unused.json");
            protected override BanLists Bans { get { var b = bans(); return new(b.BannedDirectories, b.BannedFiles); } }
        }

        private TestCache NewCache(params (string Dir, FileItem[] Files)[] directories)
        {
            var cache = new TestCache(() => _bans);

            foreach (var (dir, files) in directories)
            {
                cache.Add(new DirectoryPath(dir).Value, new StorageCacheItem { Path = new DirectoryPath(dir), Files = [.. files] });
            }
            return cache;
        }

        private static readonly IEnumerable<DirectoryPath> NoExcludes = [];

        [Fact]
        public void Search_SkipsFilesWithBannedNameOrBannedDirectory()
        {
            var cache = NewCache(
                ("/music", [Song("/music/1.sid"), Song("/music/Commando_1.sid")]),
                ("/music/Docs", [Song("/music/Docs/2.sid")]),
                ("/music/Docs/deep", [Song("/music/Docs/deep/3.sid")]));
            _bans = Bans(["Docs"], ["1.sid"]);

            var found = cache.Search("sid", NoExcludes, TeensyFileType.Sid);

            found.Select(f => f.Name).Should().Equal("Commando_1.sid");
        }

        [Fact]
        public void Search_ReflectsBanChangesWithoutRebuildingTheCache()
        {
            var cache = NewCache(("/music", [Song("/music/1.sid"), Song("/music/Commando_1.sid")]));

            var before = cache.Search("sid", NoExcludes, TeensyFileType.Sid).Select(f => f.Name).ToList();
            _bans = Bans([], ["1.sid"]);
            var after = cache.Search("sid", NoExcludes, TeensyFileType.Sid).Select(f => f.Name).ToList();

            before.Should().BeEquivalentTo("1.sid", "Commando_1.sid");
            after.Should().Equal("Commando_1.sid");
        }

        [Fact]
        public void GetRandomFile_NeverPicksBannedFilesOrFilesInBannedDirectories()
        {
            var cache = NewCache(
                ("/music", [Song("/music/1.sid"), Song("/music/Commando_1.sid")]),
                ("/music/Docs", [Song("/music/Docs/2.sid")]));
            _bans = Bans(["Docs"], ["1.sid"]);

            for (var i = 0; i < 25; i++)
            {
                var picked = cache.GetRandomFile(StorageScope.Storage, new DirectoryPath("/"), NoExcludes, TeensyFileType.Sid);
                picked!.Name.Should().Be("Commando_1.sid");
            }
        }

        [Fact]
        public void GetRandomFile_EverythingBanned_ReturnsNull()
        {
            var cache = NewCache(("/music", [Song("/music/1.sid")]));
            _bans = Bans([], ["1.sid"]);

            cache.GetRandomFile(StorageScope.Storage, new DirectoryPath("/"), NoExcludes, TeensyFileType.Sid)
                .Should().BeNull();
        }

        [Fact]
        public void GetByDirPath_BannedDirectoryAndItsDescendants_AreStillCached()
        {
            var cache = NewCache(("/Docs", []), ("/Docs/manuals", []), ("/music", []));
            _bans = Bans(["Docs"], []);

            cache.GetByDirPath(new DirectoryPath("/Docs")).Should().NotBeNull();
            cache.GetByDirPath(new DirectoryPath("/Docs/manuals")).Should().NotBeNull();
            cache.GetByDirPath(new DirectoryPath("/music")).Should().NotBeNull();
        }

        [Fact]
        public void EnsureParents_UnderBannedDirectory_BuildsTheDirectoryChain()
        {
            var cache = NewCache();
            _bans = Bans(["Docs"], []);

            cache.EnsureParents(new DirectoryPath("/Docs/manuals/more"));

            cache.GetByDirPath(new DirectoryPath("/Docs/manuals/more")).Should().NotBeNull();
        }

        [Fact]
        public void EnsureParents_OutsideBans_BuildsTheDirectoryChain()
        {
            var cache = NewCache();
            _bans = Bans(["Docs"], []);

            cache.EnsureParents(new DirectoryPath("/music/tunes"));

            cache.GetByDirPath(new DirectoryPath("/music/tunes")).Should().NotBeNull();
        }

        [Fact]
        public void UpsertFile_KeepsBannedFilesAndFilesInBannedDirectories_ButSearchHidesThem()
        {
            var cache = NewCache();
            _bans = Bans(["Docs"], ["1.sid"]);

            cache.UpsertFile(Song("/music/tunes/1.sid"));
            cache.UpsertFile(Song("/music/tunes/Commando_1.sid"));
            cache.UpsertFile(Song("/Docs/manuals/x.sid"));

            cache.GetByDirPath(new DirectoryPath("/music/tunes"))!.Files
                .Select(f => f.Name).Should().Equal("1.sid", "Commando_1.sid");
            cache.GetByDirPath(new DirectoryPath("/Docs/manuals"))!.Files
                .Select(f => f.Name).Should().Equal("x.sid");
            cache.Search("sid", NoExcludes, TeensyFileType.Sid).Select(f => f.Name).Should().Equal("Commando_1.sid");
        }

        [Fact]
        public void UpsertDirectory_KeepsBannedEntries_SoRemovingTheBanRestoresThem()
        {
            var cache = NewCache();
            _bans = Bans(["Docs"], ["1.sid"]);

            cache.UpsertDirectory(new DirectoryPath("/music"), new StorageCacheItem
            {
                Path = new DirectoryPath("/music"),
                Directories = [new DirectoryItem("/music/Docs")],
                Files = [Song("/music/1.sid"), Song("/music/Commando_1.sid")]
            });
            var whileBanned = cache.Search("sid", NoExcludes, TeensyFileType.Sid).Select(f => f.Name).ToList();
            _bans = Bans([], []);
            var afterUnban = cache.Search("sid", NoExcludes, TeensyFileType.Sid).Select(f => f.Name).ToList();

            cache.GetByDirPath(new DirectoryPath("/music"))!.Directories.Select(d => d.Path.Value).Should().Equal("/music/Docs/");
            whileBanned.Should().Equal("Commando_1.sid");
            afterUnban.Should().BeEquivalentTo("1.sid", "Commando_1.sid");
        }

        [Fact]
        public void DeleteDirectoryWithChildren_RemovesBannedSubdirectoriesToo()
        {
            var cache = NewCache(
                ("/music", [Song("/music/1.sid")]),
                ("/music/Docs", [Song("/music/Docs/2.sid")]),
                ("/music/Docs/deep", [Song("/music/Docs/deep/3.sid")]),
                ("/other", [Song("/other/4.sid")]));
            cache["/music/"].Directories = [new DirectoryItem("/music/Docs")];
            cache["/music/Docs/"].Directories = [new DirectoryItem("/music/Docs/deep")];
            _bans = Bans(["Docs"], []);

            cache.DeleteDirectoryWithChildren(new DirectoryPath("/music"));

            cache.Keys.Should().Equal("/other/");
        }
    }
}
