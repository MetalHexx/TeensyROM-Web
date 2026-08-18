using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage.Index;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Storage.Tests.Index
{
    public class SqliteIndexStoreReadsTests
    {
        private static readonly CancellationToken Ct = CancellationToken.None;

        // === GetDirectoryAsync ===

        [Fact]
        public async Task GetDirectoryAsync_ReturnsChildDirectoriesAndFilesOrderedByName()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/b.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/a.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/sub/x.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/aaa/y.sid"), Ct);

            var directory = await fixture.Store.GetDirectoryAsync(fixture.Scope, new DirectoryPath("/music/"), Ct);

            directory.Should().NotBeNull();
            directory!.Path.Should().Be(new DirectoryPath("/music/"));
            directory.Files.Select(f => f.Name).Should().Equal("a.sid", "b.sid");
            directory.Directories.Select(d => d.Name).Should().Equal("aaa", "sub");
        }

        [Fact]
        public async Task GetDirectoryAsync_ReturnsNull_ForAMissingDirectory()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            var directory = await fixture.Store.GetDirectoryAsync(fixture.Scope, new DirectoryPath("/nope/"), Ct);

            directory.Should().BeNull();
        }

        [Fact]
        public async Task GetDirectoryAsync_ReturnsEmptyLists_ForAnIndexedButEmptyDirectory()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertDirectoryAsync(fixture.Scope, new DirectoryPath("/empty/"), Ct);

            var directory = await fixture.Store.GetDirectoryAsync(fixture.Scope, new DirectoryPath("/empty/"), Ct);

            directory.Should().NotBeNull();
            directory!.Files.Should().BeEmpty();
            directory.Directories.Should().BeEmpty();
        }

        // === GetFileByPathAsync ===

        [Fact]
        public async Task GetFileByPathAsync_FindsAFileCaseInsensitively()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            var file = await fixture.Store.GetFileByPathAsync(fixture.Scope, new FilePath("/MUSIC/MONTY.SID"), Ct);

            file.Should().NotBeNull();
            file!.Name.Should().Be("monty.sid");
        }

        [Fact]
        public async Task GetFileByPathAsync_ReturnsNull_WhenTheFileIsNotIndexed()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            var file = await fixture.Store.GetFileByPathAsync(fixture.Scope, new FilePath("/music/monty.sid"), Ct);

            file.Should().BeNull();
        }

        // === GetFilesByNameAsync ===

        [Fact]
        public async Task GetFilesByNameAsync_ReturnsEveryFileSharingTheNameAcrossDirectories()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/a/song.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/b/song.sid", size: 200), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/c/other.sid", size: 100), Ct);

            var files = await fixture.Store.GetFilesByNameAsync(fixture.Scope, "song.sid", Ct);

            files.Select(f => f.Path.Value).Should().BeEquivalentTo("/music/a/song.sid", "/music/b/song.sid");
        }

        [Fact]
        public async Task GetFilesByNameAsync_MatchesCaseInsensitively()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            var files = await fixture.Store.GetFilesByNameAsync(fixture.Scope, "MONTY.SID", Ct);

            files.Should().ContainSingle();
        }

        // === SearchAsync ===

        [Fact]
        public async Task SearchAsync_FindsAFileByATermDrawnFromItsName()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/monty.sid"), Ct);

            var results = await fixture.Store.SearchAsync(fixture.Scope, "monty", [], [], 10, Ct);

            results.Select(r => r.Path.Value).Should().Contain("/music/mob/monty.sid");
        }

        [Fact]
        public async Task SearchAsync_FindsAFileByATermDrawnFromItsPath()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/monty.sid"), Ct);

            var results = await fixture.Store.SearchAsync(fixture.Scope, "mob", [], [], 10, Ct);

            results.Select(r => r.Path.Value).Should().Contain("/music/mob/monty.sid");
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public async Task SearchAsync_ReturnsNothingWithoutThrowing_ForEmptyInput(string searchText)
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            var results = await fixture.Store.SearchAsync(fixture.Scope, searchText, [], [], 10, Ct);

            results.Should().BeEmpty();
        }

        [Fact]
        public async Task SearchAsync_ReturnsNothingWithoutThrowing_ForALoneQuote()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            var results = await fixture.Store.SearchAsync(fixture.Scope, "\"", [], [], 10, Ct);

            results.Should().BeEmpty();
        }

        [Theory]
        [InlineData("-")]
        [InlineData(":")]
        [InlineData("AND")]
        public async Task SearchAsync_ReturnsNothingWithoutThrowing_ForAnOperatorOnlyTerm(string searchText)
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            var results = await fixture.Store.SearchAsync(fixture.Scope, searchText, [], [], 10, Ct);

            results.Should().BeEmpty();
        }

        [Fact]
        public async Task SearchAsync_MultiWordTerm_RequiresEveryWordToMatch()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty python.sid"), Ct);

            var matching = await fixture.Store.SearchAsync(fixture.Scope, "monty python", [], [], 10, Ct);
            var nonMatching = await fixture.Store.SearchAsync(fixture.Scope, "monty zznotfound", [], [], 10, Ct);

            matching.Select(r => r.Path.Value).Should().Contain("/music/monty python.sid");
            nonMatching.Should().BeEmpty();
        }

        [Fact]
        public async Task SearchAsync_ReturnsNothing_ForATermMatchingNothing()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            var results = await fixture.Store.SearchAsync(fixture.Scope, "doesnotexist", [], [], 10, Ct);

            results.Should().BeEmpty();
        }

        [Fact]
        public async Task SearchAsync_RespectsTheFileTypeFilter()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/widget.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/games/widget.prg"), Ct);

            var results = await fixture.Store.SearchAsync(fixture.Scope, "widget", [], [TeensyFileType.Sid], 10, Ct);

            results.Select(r => r.Path.Value).Should().Equal("/music/widget.sid");
        }

        [Fact]
        public async Task SearchAsync_EmptyFileTypesArray_MeansEveryLaunchableType()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/beacon.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/firmware/beacon.hex"), Ct);

            var results = await fixture.Store.SearchAsync(fixture.Scope, "beacon", [], [], 10, Ct);

            results.Select(r => r.Path.Value).Should().Equal("/music/beacon.sid");
        }

        [Fact]
        public async Task SearchAsync_ExcludePaths_RemovesMatchesUnderThem()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/favorites/music/rocket.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/other/rocket.sid", size: 200), Ct);

            var results = await fixture.Store.SearchAsync(
                fixture.Scope, "rocket", [new DirectoryPath("/favorites/")], [], 10, Ct);

            results.Select(r => r.Path.Value).Should().Equal("/music/other/rocket.sid");
        }

        [Fact]
        public async Task SearchAsync_Limit_TruncatesTheResultSet()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/track1.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/track2.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/track3.sid"), Ct);

            var results = await fixture.Store.SearchAsync(fixture.Scope, "track", [], [], 2, Ct);

            results.Should().HaveCount(2);
        }

        // === GetRandomFileAsync ===

        [Fact]
        public async Task GetRandomFileAsync_Storage_ReturnsAFileFromTheRequestedSubtree()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            var file = await fixture.Store.GetRandomFileAsync(
                fixture.Scope, StorageScope.Storage, new DirectoryPath("/"), [], [], Ct);

            file.Should().NotBeNull();
            file!.Path.Value.Should().Be("/music/monty.sid");
        }

        [Fact]
        public async Task GetRandomFileAsync_DirDeep_RestrictsToTheSubtree()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/monty.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/games/boulder.prg"), Ct);

            var file = await fixture.Store.GetRandomFileAsync(
                fixture.Scope, StorageScope.DirDeep, new DirectoryPath("/music/"), [], [], Ct);

            file.Should().NotBeNull();
            file!.Path.Value.Should().StartWith("/music/");
        }

        [Fact]
        public async Task GetRandomFileAsync_DirShallow_RestrictsToImmediateChildrenOnly()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/commando.sid"), Ct);

            var file = await fixture.Store.GetRandomFileAsync(
                fixture.Scope, StorageScope.DirShallow, new DirectoryPath("/music/"), [], [], Ct);

            file.Should().NotBeNull();
            file!.Path.Value.Should().Be("/music/monty.sid");
        }

        [Fact]
        public async Task GetRandomFileAsync_RespectsTheFileTypeFilter()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/a/song.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/a/game.prg"), Ct);

            var file = await fixture.Store.GetRandomFileAsync(
                fixture.Scope, StorageScope.Storage, new DirectoryPath("/"), [], [TeensyFileType.Prg], Ct);

            file.Should().NotBeNull();
            file!.Path.Value.Should().Be("/a/game.prg");
        }

        [Fact]
        public async Task GetRandomFileAsync_RespectsExcludePaths()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/favorites/music/rocket.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/other/rocket.sid", size: 200), Ct);

            var file = await fixture.Store.GetRandomFileAsync(
                fixture.Scope, StorageScope.Storage, new DirectoryPath("/"), [new DirectoryPath("/favorites/")], [], Ct);

            file.Should().NotBeNull();
            file!.Path.Value.Should().Be("/music/other/rocket.sid");
        }

        [Fact]
        public async Task GetRandomFileAsync_EmptyFileTypesArray_MeansEveryLaunchableType()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/song.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/firmware/update.hex"), Ct);

            var file = await fixture.Store.GetRandomFileAsync(
                fixture.Scope, StorageScope.Storage, new DirectoryPath("/"), [], [], Ct);

            file.Should().NotBeNull();
            file!.Path.Value.Should().Be("/music/song.sid");
        }

        [Fact]
        public async Task GetRandomFileAsync_ReturnsNull_WhenNothingMatches()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            var file = await fixture.Store.GetRandomFileAsync(
                fixture.Scope, StorageScope.Storage, new DirectoryPath("/"), [], [], Ct);

            file.Should().BeNull();
        }

        // === FindParentFileAsync / FindSiblingsAsync ===

        [Fact]
        public async Task FindParentFileAsync_ReturnsTheOriginalOutsideFavoriteAndPlaylistTrees()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/monty.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/favorites/music/monty.sid", size: 100), Ct);

            var favorite = IndexTestFixture.CreateFile("/favorites/music/monty.sid", size: 100);

            var parent = await fixture.Store.FindParentFileAsync(fixture.Scope, favorite, Ct);

            parent.Should().NotBeNull();
            parent!.Path.Value.Should().Be("/music/mob/monty.sid");
        }

        [Fact]
        public async Task FindParentFileAsync_ReturnsNull_WhenNoOriginalExists()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/favorites/music/monty.sid", size: 100), Ct);

            var favorite = IndexTestFixture.CreateFile("/favorites/music/monty.sid", size: 100);

            var parent = await fixture.Store.FindParentFileAsync(fixture.Scope, favorite, Ct);

            parent.Should().BeNull();
        }

        [Fact]
        public async Task FindSiblingsAsync_ReturnsFavoriteAndPlaylistCopiesExcludingItsOwnPath()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/monty.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/favorites/music/monty.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/playlists/mymix/monty.sid", size: 100), Ct);

            var original = IndexTestFixture.CreateFile("/music/mob/monty.sid", size: 100);

            var siblings = await fixture.Store.FindSiblingsAsync(fixture.Scope, original, Ct);

            siblings.Select(s => s.Path.Value).Should().Equal("/favorites/music/monty.sid", "/playlists/mymix/monty.sid");
        }

        // === GetFavoriteFilesAsync / GetPlaylistFilesAsync ===

        [Fact]
        public async Task GetFavoriteFilesAsync_ReturnsFilesUnderAnyFavoriteTree()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/favorites/music/x.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/favorites/games/y.prg"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/z.sid"), Ct);

            var favorites = await fixture.Store.GetFavoriteFilesAsync(fixture.Scope, Ct);

            favorites.Select(f => f.Path.Value).Should().BeEquivalentTo("/favorites/music/x.sid", "/favorites/games/y.prg");
        }

        [Fact]
        public async Task GetPlaylistFilesAsync_ReturnsFilesUnderThePlaylistTree()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/playlists/mix/a.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/b.sid"), Ct);

            var playlistFiles = await fixture.Store.GetPlaylistFilesAsync(fixture.Scope, Ct);

            playlistFiles.Select(f => f.Path.Value).Should().Equal("/playlists/mix/a.sid");
        }

        // === GetFileCountAsync ===

        [Fact]
        public async Task GetFileCountAsync_CountsEveryIndexedFileInTheScope()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/a.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/b.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/games/c.prg"), Ct);

            (await fixture.Store.GetFileCountAsync(fixture.Scope, Ct)).Should().Be(3);
        }

        [Fact]
        public async Task GetFileCountAsync_ReturnsZero_WhenTheScopeHasNoStorageYet()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            (await fixture.Store.GetFileCountAsync(fixture.Scope, Ct)).Should().Be(0);
        }

        // === Subtype mapping ===

        [Theory]
        [InlineData("/x.sid", typeof(SongItem))]
        [InlineData("/x.crt", typeof(GameItem))]
        [InlineData("/x.prg", typeof(GameItem))]
        [InlineData("/x.p00", typeof(GameItem))]
        [InlineData("/x.hex", typeof(HexItem))]
        [InlineData("/x.kla", typeof(ImageItem))]
        [InlineData("/x.koa", typeof(ImageItem))]
        [InlineData("/x.art", typeof(ImageItem))]
        [InlineData("/x.aas", typeof(ImageItem))]
        [InlineData("/x.hpi", typeof(ImageItem))]
        [InlineData("/x.seq", typeof(ImageItem))]
        [InlineData("/x.txt", typeof(ImageItem))]
        [InlineData("/x.d64", typeof(FileItem))]
        [InlineData("/x.xyz", typeof(FileItem))]
        public async Task GetFileByPathAsync_MapsEachFileTypeToItsExpectedSubtype(string path, Type expectedType)
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile(path), Ct);

            var file = await fixture.Store.GetFileByPathAsync(fixture.Scope, new FilePath(path), Ct);

            file.Should().NotBeNull();
            file!.GetType().Should().Be(expectedType);
        }
    }
}
