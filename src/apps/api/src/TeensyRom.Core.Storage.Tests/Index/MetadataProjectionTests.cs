using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Games;
using TeensyRom.Core.Music;
using TeensyRom.Core.Music.DeepSid;
using TeensyRom.Core.Music.Hvsc;
using TeensyRom.Core.Music.Sid;
using TeensyRom.Core.Storage.Index;

namespace TeensyRom.Core.Storage.Tests.Index
{
    public class MetadataProjectionTests
    {
        private static readonly CancellationToken Ct = CancellationToken.None;

        [Fact]
        public async Task ProjectAsync_SidWithGenuineCommentary_KeepsDescriptionCreatorReleaseInfoAndSourcePathVerbatim()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/real.sid", size: 100), Ct);

            var hvsc = Substitute.For<IHvscDatabase>();
            hvsc.GetRecord("100real.sid").Returns(new SidRecord
            {
                Filename = "real.sid",
                Filepath = "/MUSICIANS/H/Hubbard_Rob/real.sid",
                Author = "Rob Hubbard",
                Released = "1987 Firebird",
                StilEntry = "Genuine commentary drawn from the local STIL dataset."
            });

            var projection = CreateSidProjection(fixture, hvsc, Substitute.For<IDeepSidDatabase>());

            await projection.ProjectAsync(fixture.Scope, null, Ct);

            fixture.Scalar("SELECT description FROM content_metadata;").Should().Be("Genuine commentary drawn from the local STIL dataset.");
            fixture.Scalar("SELECT creator FROM content_metadata;").Should().Be("Rob Hubbard");
            fixture.Scalar("SELECT release_info FROM content_metadata;").Should().Be("1987 Firebird");
            fixture.Scalar("SELECT metadata_source_path FROM content_metadata;").Should().Be("/MUSICIANS/H/Hubbard_Rob/real.sid");

            var file = await fixture.Store.GetFileByPathAsync(fixture.Scope, new ValueObjects.FilePath("/music/real.sid"), Ct);

            file.Should().BeOfType<SongItem>();
            file!.Description.Should().Be("Genuine commentary drawn from the local STIL dataset.");
            file.Creator.Should().Be("Rob Hubbard");
        }

        [Fact]
        public async Task ProjectAsync_SidWithNoLocalEntry_StoresNulls_AndReadingBackStillSurfacesTheEntitysFallback()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/unknown.sid", size: 200), Ct);

            var projection = CreateSidProjection(fixture, Substitute.For<IHvscDatabase>(), Substitute.For<IDeepSidDatabase>());

            await projection.ProjectAsync(fixture.Scope, null, Ct);

            fixture.Scalar("SELECT description FROM content_metadata;").Should().BeNull();
            fixture.Scalar("SELECT creator FROM content_metadata;").Should().BeNull();
            fixture.Scalar("SELECT title FROM content_metadata;").Should().BeNull();

            var file = await fixture.Store.GetFileByPathAsync(fixture.Scope, new ValueObjects.FilePath("/music/unknown.sid"), Ct);

            file.Should().BeOfType<SongItem>();
            file!.Creator.Should().NotBeNullOrWhiteSpace();
            file.Description.Should().NotBeNullOrWhiteSpace();
        }

        [Fact]
        public async Task ProjectAsync_TitleAndMeta1_AreNeverPersisted_EvenWithGenuineMetadata()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/real.sid", size: 100), Ct);

            var hvsc = Substitute.For<IHvscDatabase>();
            hvsc.GetRecord("100real.sid").Returns(new SidRecord
            {
                Filename = "real.sid",
                Title = "A Real Composed Title",
                StilEntry = "Some commentary."
            });

            var projection = CreateSidProjection(fixture, hvsc, Substitute.For<IDeepSidDatabase>());

            await projection.ProjectAsync(fixture.Scope, null, Ct);

            fixture.Scalar("SELECT title FROM content_metadata;").Should().BeNull();
            fixture.Scalar("SELECT meta1 FROM content_metadata;").Should().BeNull();
        }

        [Fact]
        public async Task ProjectAsync_TwoFilesSharingAContentIdentity_ProduceOneRow_AndBothResolveToIt()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/mob/shared.sid", size: 100), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/favorites/music/shared.sid", size: 100), Ct);

            var hvsc = Substitute.For<IHvscDatabase>();
            hvsc.GetRecord("100shared.sid").Returns(new SidRecord
            {
                Filename = "shared.sid",
                Author = "Shared Author",
                StilEntry = "Shared commentary."
            });

            var projection = CreateSidProjection(fixture, hvsc, Substitute.For<IDeepSidDatabase>());

            var written = await projection.ProjectAsync(fixture.Scope, null, Ct);

            written.Should().Be(1);
            fixture.Count("SELECT COUNT(*) FROM content_metadata;").Should().Be(1);

            var original = await fixture.Store.GetFileByPathAsync(fixture.Scope, new ValueObjects.FilePath("/music/mob/shared.sid"), Ct);
            var favorite = await fixture.Store.GetFileByPathAsync(fixture.Scope, new ValueObjects.FilePath("/favorites/music/shared.sid"), Ct);

            original!.Creator.Should().Be("Shared Author");
            favorite!.Creator.Should().Be("Shared Author");
        }

        [Fact]
        public async Task ProjectAsync_ANonEnrichedType_StoresNothingReal_BecauseEveryFallbackIsAlwaysDerived()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/art/picture.kla", size: 50), Ct);

            var projection = CreateSidProjection(fixture, Substitute.For<IHvscDatabase>(), Substitute.For<IDeepSidDatabase>());

            await projection.ProjectAsync(fixture.Scope, null, Ct);

            fixture.Scalar("SELECT description FROM content_metadata;").Should().BeNull();
            fixture.Scalar("SELECT creator FROM content_metadata;").Should().BeNull();
            fixture.Scalar("SELECT title FROM content_metadata;").Should().BeNull();
            fixture.Scalar("SELECT meta1 FROM content_metadata;").Should().BeNull();
        }

        [Fact]
        public async Task ProjectAsync_GameEnrichmentThatSetsRealFields_PersistsThem()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/games/real.prg", size: 300), Ct);

            var gameMetadata = Substitute.For<IGameMetadataService>();
            gameMetadata.EnrichGame(Arg.Any<GameItem>()).Returns(callInfo =>
            {
                var game = callInfo.Arg<GameItem>();
                game.MetadataSource = "OneLoad64";
                game.ReleaseInfo = "1988 Real Game Co";

                return game;
            });

            var sourceVersion = new FakeSourceVersion("v1");
            var projection = new MetadataProjection(fixture.Database, Substitute.For<ISidMetadataService>(), gameMetadata, sourceVersion);

            await projection.ProjectAsync(fixture.Scope, null, Ct);

            fixture.Scalar("SELECT metadata_source FROM content_metadata;").Should().Be("OneLoad64");
            fixture.Scalar("SELECT release_info FROM content_metadata;").Should().Be("1988 Real Game Co");
        }

        [Fact]
        public async Task ProjectAsync_SourceVersionStamp_ANoOpOnUnchangedVersion_AndRewritesOnAChangedOne()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/a.sid", size: 100), Ct);

            var sourceVersion = new FakeSourceVersion("v1");
            var projection = CreateSidProjectionWithVersion(fixture, sourceVersion);

            var firstRun = await projection.ProjectAsync(fixture.Scope, null, Ct);
            firstRun.Should().Be(1);
            fixture.Scalar("SELECT source_version FROM content_metadata;").Should().Be("v1");

            var secondRun = await projection.ProjectAsync(fixture.Scope, null, Ct);
            secondRun.Should().Be(0);

            sourceVersion.Current = "v2";
            var thirdRun = await projection.ProjectAsync(fixture.Scope, null, Ct);
            thirdRun.Should().Be(1);
            fixture.Scalar("SELECT source_version FROM content_metadata;").Should().Be("v2");
        }

        [Fact]
        public async Task ProjectAsync_PlayLength_PersistedOnlyWhenItDiffersFromTheDefault_AndRoundTripsThroughAReadBack()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/long.sid", size: 400), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/default.sid", size: 500), Ct);

            var hvsc = Substitute.For<IHvscDatabase>();
            hvsc.GetRecord("400long.sid").Returns(new SidRecord { Filename = "long.sid", SongLengthSpan = TimeSpan.FromMinutes(5) });
            hvsc.GetRecord("500default.sid").Returns(new SidRecord { Filename = "default.sid", SongLengthSpan = TimeSpan.FromMinutes(3) });

            var projection = CreateSidProjection(fixture, hvsc, Substitute.For<IDeepSidDatabase>());

            await projection.ProjectAsync(fixture.Scope, null, Ct);

            fixture.Scalar("SELECT play_length FROM content_metadata WHERE content_id = '400long.sid';").Should().NotBeNull();
            fixture.Scalar("SELECT play_length FROM content_metadata WHERE content_id = '500default.sid';").Should().BeNull();

            var longSong = await fixture.Store.GetFileByPathAsync(fixture.Scope, new ValueObjects.FilePath("/music/long.sid"), Ct) as SongItem;
            var defaultSong = await fixture.Store.GetFileByPathAsync(fixture.Scope, new ValueObjects.FilePath("/music/default.sid"), Ct) as SongItem;

            longSong!.PlayLength.Should().Be(TimeSpan.FromMinutes(5));
            defaultSong!.PlayLength.Should().Be(TimeSpan.FromMinutes(3));
        }

        [Fact]
        public async Task ProjectAsync_ThenSearch_FindsAFileByATermThatAppearsOnlyInItsProjectedMetadata()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/anything.sid", size: 100), Ct);

            var hvsc = Substitute.For<IHvscDatabase>();
            hvsc.GetRecord("100anything.sid").Returns(new SidRecord
            {
                Filename = "anything.sid",
                StilEntry = "Mentions zzflibbertigibbet nowhere else in this test."
            });

            var projection = CreateSidProjection(fixture, hvsc, Substitute.For<IDeepSidDatabase>());
            await projection.ProjectAsync(fixture.Scope, null, Ct);

            var results = await fixture.Store.SearchAsync(fixture.Scope, "zzflibbertigibbet", [], [], 10, Ct);

            results.Select(r => r.Path.Value).Should().Contain("/music/anything.sid");
        }

        [Fact]
        public async Task ProjectAsync_ReportsProgress()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/a.sid", size: 1), Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/b.sid", size: 2), Ct);

            var projection = CreateSidProjection(fixture, Substitute.For<IHvscDatabase>(), Substitute.For<IDeepSidDatabase>());
            var reports = new List<int>();

            await projection.ProjectAsync(fixture.Scope, new Progress<int>(reports.Add), Ct);

            reports.Should().NotBeEmpty();
            reports.Last().Should().Be(2);
        }

        private static MetadataProjection CreateSidProjection(IndexTestFixture fixture, IHvscDatabase hvsc, IDeepSidDatabase deepSid) =>
            CreateSidProjectionWithVersion(fixture, new FakeSourceVersion("v1"), hvsc, deepSid);

        private static MetadataProjection CreateSidProjectionWithVersion(IndexTestFixture fixture, FakeSourceVersion sourceVersion,
            IHvscDatabase? hvsc = null, IDeepSidDatabase? deepSid = null)
        {
            var gameMetadata = Substitute.For<IGameMetadataService>();
            gameMetadata.EnrichGame(Arg.Any<GameItem>()).Returns(callInfo => callInfo.Arg<GameItem>());

            return new MetadataProjection(
                fixture.Database,
                new SidMetadataService(hvsc ?? Substitute.For<IHvscDatabase>(), deepSid ?? Substitute.For<IDeepSidDatabase>()),
                gameMetadata,
                sourceVersion);
        }

        private sealed class FakeSourceVersion(string current) : IMetadataSourceVersion
        {
            public string Current { get; set; } = current;
        }
    }
}
