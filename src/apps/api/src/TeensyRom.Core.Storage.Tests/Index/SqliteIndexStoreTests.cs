using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage.Index;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Storage.Tests.Index
{
    public class SqliteIndexStoreTests
    {
        private static readonly CancellationToken Ct = CancellationToken.None;

        [Fact]
        public async Task EnsureStorageAsync_CalledTwice_ReturnsTheSameIdAndLeavesOneRow()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            var first = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);
            var second = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            second.Should().Be(first);
            fixture.Count("SELECT COUNT(*) FROM storage;").Should().Be(1);
        }

        [Fact]
        public async Task EnsureStorageAsync_SeparatesStoragesOnTheSameDevice()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            var sd = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);
            var usb = await fixture.Store.EnsureStorageAsync(fixture.Scope with { StorageType = TeensyStorageType.USB }, Ct);

            usb.Should().NotBe(sd);
        }

        [Fact]
        public async Task UpsertFileAsync_StoresTheDerivedIdentityTypeAndParent()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/monty.sid", size: 4321), Ct);

            fixture.Scalar("SELECT content_id FROM file WHERE path = $path;", ("$path", "/music/mob/monty.sid"))
                .Should().Be("4321monty.sid");
            fixture.Scalar("SELECT parent_path FROM file WHERE path = $path;", ("$path", "/music/mob/monty.sid"))
                .Should().Be("/music/mob/");
            fixture.Count("SELECT file_type FROM file WHERE path = $path;", ("$path", "/music/mob/monty.sid"))
                .Should().Be((long)TeensyFileType.Sid);
        }

        [Fact]
        public async Task UpsertFileAsync_CreatesTheParentDirectoryChainUpToRoot()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/monty.sid"), Ct);

            fixture.Strings("SELECT path FROM directory ORDER BY path;")
                .Should().Equal("/", "/music/", "/music/mob/");
            fixture.Scalar("SELECT parent_path FROM directory WHERE path = '/';").Should().BeNull();
            fixture.Scalar("SELECT parent_path FROM directory WHERE path = '/music/mob/';").Should().Be("/music/");
        }

        [Fact]
        public async Task UpsertFileAsync_MakesTheFileFindableByNameInTheSearchIndex()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/monty.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/commando.sid"), Ct);

            var matches = fixture.Strings(
                "SELECT path FROM file_search WHERE file_search MATCH $term;",
                ("$term", "monty"));

            matches.Should().Equal("/music/mob/monty.sid");
        }

        [Fact]
        public async Task UpsertFileAsync_CalledTwice_UpdatesTheSingleRowAndItsSearchEntry()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid", size: 200), Ct);

            fixture.Count("SELECT COUNT(*) FROM file;").Should().Be(1);
            fixture.Count("SELECT size FROM file;").Should().Be(200);
            fixture.Count("SELECT COUNT(*) FROM file_search;").Should().Be(1);
        }

        [Fact]
        public async Task UpsertFileAsync_MatchesAnExistingPathCaseInsensitively()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/x.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/Music/X.SID", size: 900), Ct);

            fixture.Count("SELECT COUNT(*) FROM file;").Should().Be(1);
            fixture.Count("SELECT size FROM file WHERE path = '/music/x.sid';").Should().Be(900);
        }

        [Fact]
        public async Task EnsureParentsAsync_CreatesTheAncestorsWithoutTheDirectoryItself()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.EnsureParentsAsync(fixture.Scope, new DirectoryPath("/music/mob/"), Ct);

            fixture.Strings("SELECT path FROM directory ORDER BY path;").Should().Equal("/", "/music/");
        }

        [Fact]
        public async Task UpsertDirectoryAsync_CreatesTheDirectoryAndItsAncestorsOnce()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertDirectoryAsync(fixture.Scope, new DirectoryPath("/music/mob/"), Ct);
            await fixture.Store.UpsertDirectoryAsync(fixture.Scope, new DirectoryPath("/music/mob/"), Ct);

            fixture.Strings("SELECT path FROM directory ORDER BY path;").Should().Equal("/", "/music/", "/music/mob/");
        }

        [Fact]
        public async Task DeleteFileAsync_RemovesTheRowAndItsSearchEntry()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);
            await fixture.Store.DeleteFileAsync(fixture.Scope, new FilePath("/MUSIC/MONTY.SID"), Ct);

            fixture.Count("SELECT COUNT(*) FROM file;").Should().Be(0);
            fixture.Count("SELECT COUNT(*) FROM file_search;").Should().Be(0);
        }

        [Fact]
        public async Task DeleteDirectoryAsync_RemovesTheDirectoryAndTheFilesDirectlyInside()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/games/boulder.prg"), Ct);

            await fixture.Store.DeleteDirectoryAsync(fixture.Scope, new DirectoryPath("/music/"), Ct);

            fixture.Strings("SELECT path FROM file;").Should().Equal("/games/boulder.prg");
            fixture.Strings("SELECT path FROM file_search;").Should().Equal("/games/boulder.prg");
        }

        [Fact]
        public async Task DeleteDirectoryWithChildrenAsync_RemovesTheSubtreeAndLeavesSiblings()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/monty.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/deep/commando.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/other/jane.sid"), Ct);

            await fixture.Store.DeleteDirectoryWithChildrenAsync(fixture.Scope, new DirectoryPath("/music/mob/"), Ct);

            fixture.Strings("SELECT path FROM file ORDER BY path;").Should().Equal("/music/other/jane.sid");
            fixture.Strings("SELECT path FROM file_search;").Should().Equal("/music/other/jane.sid");
            fixture.Strings("SELECT path FROM directory ORDER BY path;").Should().Equal("/", "/music/", "/music/other/");
        }

        [Theory]
        [InlineData("/music_a/", "/musicZa/")]
        [InlineData("/100%/", "/1000/")]
        public async Task DeleteDirectoryWithChildrenAsync_DoesNotTreatWildcardsInThePathAsWildcards(string doomed, string sibling)
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile($"{doomed}monty.sid"), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile($"{sibling}jane.sid"), Ct);

            await fixture.Store.DeleteDirectoryWithChildrenAsync(fixture.Scope, new DirectoryPath(doomed), Ct);

            fixture.Strings("SELECT path FROM file;").Should().Equal($"{sibling}jane.sid");
        }

        [Fact]
        public async Task ClearAsync_EmptiesTheScopeButKeepsItsStorageId()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            await fixture.Store.ClearAsync(fixture.Scope, Ct);

            fixture.Count("SELECT COUNT(*) FROM file;").Should().Be(0);
            fixture.Count("SELECT COUNT(*) FROM file_search;").Should().Be(0);
            fixture.Count("SELECT COUNT(*) FROM directory;").Should().Be(0);
            (await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct)).Should().Be(storageId);
        }

        [Fact]
        public async Task UpsertFileAsync_UnderAFavouritePath_FlagsEveryCopySharingTheContentIdentity()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/monty.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/other/jane.sid", size: 100), Ct);

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/favorites/music/monty.sid", size: 100), Ct);

            fixture.Strings("SELECT path FROM file WHERE is_favorite = 1 ORDER BY path;")
                .Should().Equal("/favorites/music/monty.sid", "/music/mob/monty.sid");
        }

        [Fact]
        public async Task UpsertFileAsync_AfterItsFavouriteCopyWasIndexedFirst_StillFlagsTheOriginal()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/favorites/music/monty.sid", size: 100), Ct);

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/monty.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/other/jane.sid", size: 100), Ct);

            fixture.Strings("SELECT path FROM file WHERE is_favorite = 1 ORDER BY path;")
                .Should().Equal("/favorites/music/monty.sid", "/music/mob/monty.sid");
        }

        [Fact]
        public async Task UpsertFilesAsync_AfterItsFavouriteCopyWasIndexedFirst_StillFlagsTheOriginal()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFilesAsync(fixture.Scope, [IndexTestFixture.CreateFile("/favorites/music/monty.sid", size: 100)], Ct);

            await fixture.Store.UpsertFilesAsync(
                fixture.Scope,
                [
                    IndexTestFixture.CreateFile("/music/mob/monty.sid", size: 100),
                    IndexTestFixture.CreateFile("/music/other/jane.sid", size: 100)
                ],
                Ct);

            fixture.Strings("SELECT path FROM file WHERE is_favorite = 1 ORDER BY path;")
                .Should().Equal("/favorites/music/monty.sid", "/music/mob/monty.sid");
        }

        [Fact]
        public async Task DeleteFileAsync_OfTheFavouriteCopy_ClearsTheFlagOnTheRemainingCopies()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/monty.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/favorites/music/monty.sid", size: 100), Ct);

            await fixture.Store.DeleteFileAsync(fixture.Scope, new FilePath("/favorites/music/monty.sid"), Ct);

            fixture.Count("SELECT COUNT(*) FROM file WHERE is_favorite = 1;").Should().Be(0);
        }

        [Fact]
        public async Task DeleteDirectoryWithChildrenAsync_OfTheFavouriteTree_ClearsTheFlagOnTheOriginals()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/monty.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/favorites/music/monty.sid", size: 100), Ct);

            await fixture.Store.DeleteDirectoryWithChildrenAsync(fixture.Scope, new DirectoryPath("/favorites/music/"), Ct);

            fixture.Count("SELECT COUNT(*) FROM file WHERE is_favorite = 1;").Should().Be(0);
        }

        [Fact]
        public async Task RepairFavoritesAsync_ReestablishesTheInvariantAndReportsTheRowsItCorrected()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/monty.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/favorites/music/monty.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/other/jane.sid", size: 100), Ct);

            await fixture.ExecuteAsync("UPDATE file SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END;");

            var corrected = await fixture.Store.RepairFavoritesAsync(fixture.Scope, Ct);

            corrected.Should().Be(3);
            fixture.Strings("SELECT path FROM file WHERE is_favorite = 1 ORDER BY path;")
                .Should().Equal("/favorites/music/monty.sid", "/music/mob/monty.sid");
        }

        [Fact]
        public async Task RepairFavoritesAsync_OnAHealthyIndex_CorrectsNothing()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/monty.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/favorites/music/monty.sid", size: 100), Ct);

            (await fixture.Store.RepairFavoritesAsync(fixture.Scope, Ct)).Should().Be(0);
        }

        [Fact]
        public async Task UpsertFilesAsync_WritesEveryFileAndItsDirectories()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            var files = new[]
            {
                IndexTestFixture.CreateFile("/music/mob/monty.sid"),
                IndexTestFixture.CreateFile("/music/mob/commando.sid"),
                IndexTestFixture.CreateFile("/games/boulder.prg")
            };

            await fixture.Store.UpsertFilesAsync(fixture.Scope, files, Ct);

            fixture.Count("SELECT COUNT(*) FROM file;").Should().Be(3);
            fixture.Count("SELECT COUNT(*) FROM file_search;").Should().Be(3);
            fixture.Strings("SELECT path FROM directory ORDER BY path;")
                .Should().Equal("/", "/games/", "/music/", "/music/mob/");
        }

        [Fact]
        public async Task UpsertFilesAsync_WhenInterrupted_LeavesWholeBatchesRatherThanNothing()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            var store = new SqliteIndexStore(new InterruptedIndexDatabase(fixture.Database, allowedWrites: 1));

            var files = Enumerable.Range(0, 1500)
                .Select(index => IndexTestFixture.CreateFile($"/bulk/track-{index}.sid", size: index + 1))
                .ToArray();

            var load = async () => await store.UpsertFilesAsync(fixture.Scope, files, Ct);

            await load.Should().ThrowAsync<IOException>();

            fixture.Count("SELECT COUNT(*) FROM file;").Should().Be(1000);
            fixture.Count("SELECT COUNT(*) FROM file_search;").Should().Be(1000);
        }
    }
}
