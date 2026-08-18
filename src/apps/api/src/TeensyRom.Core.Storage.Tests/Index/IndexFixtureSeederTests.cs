using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Games;
using TeensyRom.Core.Music;
using TeensyRom.Core.Music.DeepSid;
using TeensyRom.Core.Music.Hvsc;
using TeensyRom.Core.Storage.Index;
using TeensyRom.Core.Storage.Index.Fixtures;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Storage.Tests.Index
{
    public class IndexFixtureSeederTests
    {
        private static readonly CancellationToken Ct = CancellationToken.None;

        [Fact]
        public async Task SeedAsync_SmallFixture_ProducesExpectedDirectoryFileAndFavoriteCounts()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var fixturePath = WriteFixture(
                "#teensyrom-index-fixture\tv1\tdevice=dev\tstorage=sd\tfiles=5\n" +
                "/music/mob/monty.sid\tmonty.sid\t100\n" +
                "/music/mob/commando.sid\tcommando.sid\t200\n" +
                "/favorites/music/monty.sid\tmonty.sid\t100\n" +
                "/games/game.prg\tgame.prg\t300\n" +
                "/root.sid\troot.sid\t50\n");

            try
            {
                var seeder = CreateSeeder(fixture, projection: null);

                var result = await seeder.SeedAsync(fixture.Scope, fixturePath, new SeedOptions(RunProjection: false), null, Ct);

                result.Directories.Should().Be(6);
                result.Files.Should().Be(5);
                result.MetadataRows.Should().Be(0);

                // The bulk upsert already maintains the invariant per batch, so the dedicated repair pass that
                // follows it has nothing left to correct — its value is the read-back below, not this count.
                result.FavoritesMarked.Should().Be(0);

                var original = await fixture.Store.GetFileByPathAsync(fixture.Scope, new FilePath("/music/mob/monty.sid"), Ct);
                var favorite = await fixture.Store.GetFileByPathAsync(fixture.Scope, new FilePath("/favorites/music/monty.sid"), Ct);

                original!.IsFavorite.Should().BeTrue();
                favorite!.IsFavorite.Should().BeTrue();
            }
            finally
            {
                File.Delete(fixturePath);
            }
        }

        [Fact]
        public async Task SeedAsync_NestedAndRootPaths_DerivesEveryAncestorDirectoryOnce()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var fixturePath = WriteFixture(
                "#teensyrom-index-fixture\tv1\tdevice=dev\tstorage=sd\tfiles=2\n" +
                "/music/mob/monty.sid\tmonty.sid\t100\n" +
                "/root.sid\troot.sid\t50\n");

            try
            {
                var seeder = CreateSeeder(fixture, projection: null);

                await seeder.SeedAsync(fixture.Scope, fixturePath, new SeedOptions(RunProjection: false), null, Ct);

                fixture.Strings("SELECT path FROM directory ORDER BY path;")
                    .Should().Equal("/", "/music/", "/music/mob/");
            }
            finally
            {
                File.Delete(fixturePath);
            }
        }

        [Fact]
        public async Task SeedAsync_ARecordWithAnInvalidPath_IsSkippedRatherThanAbortingTheRun()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var fixturePath = WriteFixture(
                "#teensyrom-index-fixture\tv1\tdevice=dev\tstorage=sd\tfiles=2\n" +
                "/music/valid.sid\tvalid.sid\t100\n" +
                "C:\\bad\\windows.sid\twindows.sid\t100\n");

            try
            {
                var seeder = CreateSeeder(fixture, projection: null);

                var result = await seeder.SeedAsync(fixture.Scope, fixturePath, new SeedOptions(RunProjection: false), null, Ct);

                result.Files.Should().Be(1);
                fixture.Count("SELECT COUNT(*) FROM file;").Should().Be(1);
            }
            finally
            {
                File.Delete(fixturePath);
            }
        }

        [Fact]
        public async Task SeedAsync_MaxFiles_TruncatesTheRunToThatManyValidFiles()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var fixturePath = WriteFixture(
                "#teensyrom-index-fixture\tv1\tdevice=dev\tstorage=sd\tfiles=5\n" +
                "/music/a.sid\ta.sid\t1\n" +
                "/music/b.sid\tb.sid\t2\n" +
                "/music/c.sid\tc.sid\t3\n" +
                "/music/d.sid\td.sid\t4\n" +
                "/music/e.sid\te.sid\t5\n");

            try
            {
                var seeder = CreateSeeder(fixture, projection: null);

                var result = await seeder.SeedAsync(fixture.Scope, fixturePath, new SeedOptions(RunProjection: false, MaxFiles: 3), null, Ct);

                result.Files.Should().Be(3);
                fixture.Count("SELECT COUNT(*) FROM file;").Should().Be(3);
            }
            finally
            {
                File.Delete(fixturePath);
            }
        }

        [Fact]
        public async Task SeedAsync_RunProjectionFalse_ProducesFilesButNoMetadataRows()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var fixturePath = WriteFixture(
                "#teensyrom-index-fixture\tv1\tdevice=dev\tstorage=sd\tfiles=1\n" +
                "/music/a.sid\ta.sid\t1\n");

            try
            {
                var seeder = CreateSeeder(fixture, CreateProjection(fixture));

                var result = await seeder.SeedAsync(fixture.Scope, fixturePath, new SeedOptions(RunProjection: false), null, Ct);

                result.Files.Should().Be(1);
                result.MetadataRows.Should().Be(0);
                fixture.Count("SELECT COUNT(*) FROM content_metadata;").Should().Be(0);
            }
            finally
            {
                File.Delete(fixturePath);
            }
        }

        [Fact]
        public async Task SeedAsync_RunProjectionTrue_ProducesFilesAndMetadataRows()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var fixturePath = WriteFixture(
                "#teensyrom-index-fixture\tv1\tdevice=dev\tstorage=sd\tfiles=1\n" +
                "/music/a.sid\ta.sid\t1\n");

            try
            {
                var seeder = CreateSeeder(fixture, CreateProjection(fixture));

                var result = await seeder.SeedAsync(fixture.Scope, fixturePath, new SeedOptions(RunProjection: true), null, Ct);

                result.Files.Should().Be(1);
                result.MetadataRows.Should().Be(1);
                fixture.Count("SELECT COUNT(*) FROM content_metadata;").Should().Be(1);
            }
            finally
            {
                File.Delete(fixturePath);
            }
        }

        [Fact]
        public async Task SeedAsync_TwoSeedsOfTheSameFixtureIntoFreshDatabases_AgreeOnCountsAndFavoriteFlags()
        {
            using var first = await IndexTestFixture.CreateReadyAsync();
            using var second = await IndexTestFixture.CreateReadyAsync();
            var fixturePath = WriteFixture(
                "#teensyrom-index-fixture\tv1\tdevice=dev\tstorage=sd\tfiles=4\n" +
                "/music/mob/monty.sid\tmonty.sid\t100\n" +
                "/favorites/music/monty.sid\tmonty.sid\t100\n" +
                "/games/game.prg\tgame.prg\t300\n" +
                "/root.sid\troot.sid\t50\n");

            try
            {
                var firstResult = await CreateSeeder(first, projection: null)
                    .SeedAsync(first.Scope, fixturePath, new SeedOptions(RunProjection: false), null, Ct);
                var secondResult = await CreateSeeder(second, projection: null)
                    .SeedAsync(second.Scope, fixturePath, new SeedOptions(RunProjection: false), null, Ct);

                firstResult.Directories.Should().Be(secondResult.Directories);
                firstResult.Files.Should().Be(secondResult.Files);
                firstResult.FavoritesMarked.Should().Be(secondResult.FavoritesMarked);

                var firstFlags = first.Strings("SELECT path || ':' || is_favorite FROM file ORDER BY path;");
                var secondFlags = second.Strings("SELECT path || ':' || is_favorite FROM file ORDER BY path;");

                firstFlags.Should().Equal(secondFlags);
            }
            finally
            {
                File.Delete(fixturePath);
            }
        }

        private static IndexFixtureSeeder CreateSeeder(IndexTestFixture fixture, IMetadataProjection? projection) =>
            new(fixture.Store, fixture.Database, projection);

        private static MetadataProjection CreateProjection(IndexTestFixture fixture)
        {
            var hvsc = Substitute.For<IHvscDatabase>();
            var deepSid = Substitute.For<IDeepSidDatabase>();
            var gameMetadata = Substitute.For<IGameMetadataService>();
            gameMetadata.EnrichGame(Arg.Any<GameItem>()).Returns(callInfo => callInfo.Arg<GameItem>());

            var sourceVersion = Substitute.For<IMetadataSourceVersion>();
            sourceVersion.Current.Returns("v1");

            return new MetadataProjection(fixture.Database, new SidMetadataService(hvsc, deepSid), gameMetadata, sourceVersion);
        }

        private static string WriteFixture(string contents)
        {
            var path = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}.tsv");
            File.WriteAllText(path, contents);
            return path;
        }
    }
}
