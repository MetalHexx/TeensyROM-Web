using FluentAssertions;
using NSubstitute;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Games;
using TeensyRom.Core.Music;
using TeensyRom.Core.Music.DeepSid;
using TeensyRom.Core.Music.Hvsc;
using TeensyRom.Core.Music.Sid;
using TeensyRom.Core.Storage.Index;
using TeensyRom.Core.Storage.Index.Search;
using TeensyRom.Core.ValueObjects;
using Xunit;
using Xunit.Abstractions;

namespace TeensyRom.Core.Storage.Tests.Integration
{
    /// <summary>
    /// Asserts <see cref="SqliteIndexStore.SearchAsync"/> — the new store's real FTS-backed search — against
    /// the committed <c>search-oracle.json</c>.
    /// </summary>
    /// <remarks>
    /// The oracle was meant to run against the real 270,972-file collection, seeded the same way as
    /// <see cref="QueryEquivalenceTests"/>. That collection is a personal, git-ignored fixture, and neither it
    /// nor a matching real index file exists on this machine (the same gap <see cref="FixtureAvailability"/>
    /// reports for the equivalence suite). Reusing <see cref="SeededCollectionFixture"/> as-is would not have
    /// closed that gap even on a machine that has the real fixture: its projection deliberately stubs HVSC and
    /// DeepSID to no-ops, because the equivalence assertions never read a metadata field — but every
    /// metadata-dependent case here (creator-only, title-only, genuine commentary) needs real enrichment
    /// output to exist at all. So this suite seeds its own small, synthetic-but-schema-faithful collection
    /// through the exact same production path (<see cref="SqliteIndexStore"/>, <see cref="MetadataProjection"/>,
    /// <see cref="FtsQuery"/>) with controlled HVSC/game enrichment standing in for the real databases, proving
    /// the real mechanism rather than an unverifiable claim about it. It is not gated behind
    /// <see cref="FixtureFactAttribute"/>: it needs no local fixture, so it always runs. Once a real fixture,
    /// index file, and HVSC/DeepSID data are available on a machine, <c>search-oracle.json</c> should be
    /// re-curated with terms drawn from that real collection and pointed at
    /// <see cref="SeededCollectionFixture"/> instead, per the original design.
    /// </remarks>
    [Collection(SearchOracleCollection.Name)]
    public sealed class SearchOracleTests
    {
        private static readonly CancellationToken Ct = CancellationToken.None;

        private readonly SearchOracleFixture _fixture;
        private readonly ITestOutputHelper _output;

        public SearchOracleTests(SearchOracleFixture fixture, ITestOutputHelper output)
        {
            _fixture = fixture;
            _output = output;
        }

        public static IEnumerable<object[]> Cases() => SearchOracleFixture.OracleCases.Select(c => new object[] { c });

        [Theory]
        [MemberData(nameof(Cases))]
        public async Task Search_ForEachOracleCase_MatchesExpectedPaths_ExcludesForbiddenPaths_AndStaysWithinBounds(SearchOracleCase oracleCase)
        {
            var results = await _fixture.Store.SearchAsync(
                _fixture.Scope, oracleCase.Term, SearchOracleFixture.ExcludePaths, [], SearchOracleFixture.GenerousLimit, Ct);

            var paths = results.Select(r => r.Path.Value).ToList();
            _output.WriteLine($"'{oracleCase.Term}' ({oracleCase.Intent}): {paths.Count} result(s) -> {string.Join(", ", paths)}");

            foreach (var expected in oracleCase.ExpectedPaths)
            {
                paths.Should().Contain(expected,
                    "'{0}' ({1}) must find '{2}'", oracleCase.Term, oracleCase.Intent, expected);
            }

            foreach (var forbidden in oracleCase.MustNotMatch)
            {
                paths.Should().NotContain(forbidden,
                    "'{0}' ({1}) must not find '{2}'", oracleCase.Term, oracleCase.Intent, forbidden);
            }

            paths.Count.Should().BeInRange(oracleCase.MinResults, oracleCase.MaxResults,
                "'{0}' ({1}) must return between {2} and {3} results, not {4}",
                oracleCase.Term, oracleCase.Intent, oracleCase.MinResults, oracleCase.MaxResults, paths.Count);
        }

        [Fact]
        public async Task Search_ForTheOperatorCharacterCase_DoesNotThrow()
        {
            var operatorCase = SearchOracleFixture.OracleCases.Single(c => c.Term.Any(ch => ch is '"' or '-' or '*'));

            Func<Task> act = async () => await _fixture.Store.SearchAsync(
                _fixture.Scope, operatorCase.Term, SearchOracleFixture.ExcludePaths, [], SearchOracleFixture.GenerousLimit, Ct);

            await act.Should().NotThrowAsync("a search term with FTS5 operator characters must be handled, not throw");
        }

        /// <summary>
        /// Not an assertion on the new store — it documents, with a verified number rather than an estimate,
        /// what today's predicate (<c>BaseStorageCache.Search</c>) would return for the boilerplate term
        /// against this fixture's corpus. See <c>SEARCH-ORACLE.md</c> for the recorded count.
        /// </summary>
        [Fact]
        public async Task TodaysPredicate_ForTheBoilerplateTerm_MatchesEveryFileWhoseDescriptionWasNeverOverridden()
        {
            var boilerplateCase = SearchOracleFixture.OracleCases.Single(c => c.Term == "demoscene");

            var matches = await _fixture.TodaysPredicateMatches(boilerplateCase.Term);

            _output.WriteLine($"Today's predicate matches {matches.Count} of {_fixture.AllPaths.Count} seeded files for '{boilerplateCase.Term}':");
            _output.WriteLine(string.Join(Environment.NewLine, matches));

            matches.Should().NotBeEmpty("the boilerplate case only proves anything if today's predicate actually over-matches");
        }
    }

    [CollectionDefinition(SearchOracleCollection.Name)]
    public sealed class SearchOracleCollection : ICollectionFixture<SearchOracleFixture>
    {
        public const string Name = "search-oracle-synthetic-collection";
    }

    /// <summary>
    /// Seeds a small, self-contained synthetic collection once for the whole suite, through the real
    /// production write, projection, and search paths — see the remarks on <see cref="SearchOracleTests"/> for
    /// why this stands in for the real 270,972-file collection.
    /// </summary>
    public sealed class SearchOracleFixture : IAsyncLifetime
    {
        public const int GenerousLimit = 200;
        private const int Filler_Count = 50;

        private static readonly IndexScope Fixed_Scope = new("search-oracle-device", TeensyStorageType.SD);

        public static IReadOnlyList<DirectoryPath> ExcludePaths { get; } =
            [.. StorageHelper.FavoritePaths, new DirectoryPath(StorageHelper.Playlist_Path)];

        /// <summary>
        /// The nine behaviours <c>search-oracle.json</c> pins, resolved once against the loaded oracle so
        /// every case's term, intent, and bounds are read from the committed document rather than duplicated
        /// here.
        /// </summary>
        public static IReadOnlyList<SearchOracleCase> OracleCases { get; } = SearchOracle.Load(ResolveOraclePath());

        private static readonly CancellationToken Ct = CancellationToken.None;

        private TemporaryIndex? _index;

        public SqliteIndexStore Store => _index?.Store ?? throw NotSeeded();

        public IndexScope Scope => _index?.Scope ?? throw NotSeeded();

        /// <summary>Every path this fixture seeded — the corpus <see cref="TodaysPredicateMatches"/> scans.</summary>
        public IReadOnlyList<string> AllPaths { get; private set; } = [];

        public async Task InitializeAsync()
        {
            _index = TemporaryIndex.Create(Fixed_Scope);
            await _index.Database.EnsureCreatedAsync(Ct);

            var store = _index.Store;

            var namedFiles = new (string Path, long Size)[]
            {
                ("/music/mob/theme1.sid", 1001),
                ("/music/mob/opus7.sid", 1002),
                ("/music/mob/zorbatron.sid", 1003),
                ("/music/mob/twilight.sid", 1004),
                ("/games/GALAXIANS/blaster.prg", 2001),
                ("/games/NEBULA/quantum.prg", 2002),
            };

            var fillerPaths = Enumerable.Range(1, Filler_Count).Select(i => $"/music/filler/track{i:000}.sid").ToArray();

            foreach (var (path, size) in namedFiles)
            {
                await store.UpsertFileAsync(Fixed_Scope, CreateFile(path, size), Ct);
            }

            foreach (var path in fillerPaths)
            {
                await store.UpsertFileAsync(Fixed_Scope, CreateFile(path, 100), Ct);
            }

            AllPaths = [.. namedFiles.Select(f => f.Path), .. fillerPaths];

            await RunProjectionAsync();
            await OverrideTitleOnlyCaseAsync();
        }

        /// <summary>
        /// Replicates <c>BaseStorageCache.Search</c>'s predicate verbatim — case-insensitive
        /// <c>Contains</c> over Title, Name, Creator, Path, and Description — against the live entities this
        /// fixture seeded, read back through the same store. Used only to document, honestly, what today's
        /// predicate would return for the boilerplate case against this synthetic corpus; it plays no part in
        /// the assertions against the new store.
        /// </summary>
        public async Task<IReadOnlyList<string>> TodaysPredicateMatches(string term)
        {
            var matches = new List<string>();

            foreach (var path in AllPaths)
            {
                var file = await Store.GetFileByPathAsync(Scope, new FilePath(path), Ct);

                if (file is null)
                {
                    continue;
                }

                var isMatch = file.Title.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                              file.Name.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                              file.Creator.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                              file.Path.Value.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                              file.Description.Contains(term, StringComparison.OrdinalIgnoreCase);

                if (isMatch)
                {
                    matches.Add(path);
                }
            }

            return matches;
        }

        public Task DisposeAsync()
        {
            _index?.Dispose();
            _index = null;

            return Task.CompletedTask;
        }

        private static FileItem CreateFile(string path, long size)
        {
            var filePath = new FilePath(path);

            return new FileItem { Path = filePath, Name = filePath.FileName, Size = size };
        }

        /// <summary>
        /// Runs the real <see cref="MetadataProjection"/> with a controlled HVSC stub: one record supplies a
        /// creator with no commentary (the creator-only case), one supplies genuine STIL commentary (the
        /// commentary case), and every other file is left unenriched so its description falls back to the
        /// type's own generated boilerplate — which <see cref="MetadataProjection"/> then recognises as
        /// derived and drops, rather than persisting it into the search index. That drop is the mechanism the
        /// boilerplate case exists to pin.
        /// </summary>
        private async Task RunProjectionAsync()
        {
            var hvsc = Substitute.For<IHvscDatabase>();

            hvsc.GetRecord("1001theme1.sid").Returns(new SidRecord { Filename = "theme1.sid", Author = "Rob Hubbard" });
            hvsc.GetRecord("1004twilight.sid").Returns(new SidRecord
            {
                Filename = "twilight.sid",
                StilEntry = "A composition remembered for its icy synth motif, nicknamed Frostbyte among collectors."
            });

            var gameMetadata = Substitute.For<IGameMetadataService>();
            gameMetadata.EnrichGame(Arg.Any<GameItem>()).Returns(call => call.Arg<GameItem>());

            var sourceVersion = Substitute.For<IMetadataSourceVersion>();
            sourceVersion.Current.Returns("search-oracle");

            var sidMetadata = new SidMetadataService(hvsc, Substitute.For<IDeepSidDatabase>());
            var projection = new MetadataProjection(_index!.Database, sidMetadata, gameMetadata, sourceVersion);

            await projection.ProjectAsync(Fixed_Scope, null, Ct);
        }

        /// <summary>
        /// A title that lives only in projected metadata cannot be produced through
        /// <see cref="MetadataProjection"/> today: <c>SongItem.Title</c> and <c>GameItem.Title</c> are both
        /// computed from the filename with no settable backing field, so <c>Title</c> is always "derived" and
        /// always dropped (see <c>MetadataProjectionTests.ProjectAsync_TitleAndMeta1_AreNeverPersisted...</c>).
        /// The <c>content_search.title</c> column is real schema, so this writes it directly for the
        /// title-only case rather than skip a behaviour the format has to support.
        /// </summary>
        private Task OverrideTitleOnlyCaseAsync() => _index!.Database.WriteAsync(async (connection, transaction) =>
        {
            const string ContentId = "1002opus7.sid";

            await using var metadata = connection.CreateCommand();
            metadata.Transaction = transaction;
            metadata.CommandText = "UPDATE content_metadata SET title = $title WHERE content_id = $id;";
            metadata.Parameters.AddWithValue("$title", "Stardust Reverie");
            metadata.Parameters.AddWithValue("$id", ContentId);
            await metadata.ExecuteNonQueryAsync(Ct);

            await using var search = connection.CreateCommand();
            search.Transaction = transaction;
            search.CommandText = "UPDATE content_search SET title = $title WHERE content_id = $id;";
            search.Parameters.AddWithValue("$title", "Stardust Reverie");
            search.Parameters.AddWithValue("$id", ContentId);
            await search.ExecuteNonQueryAsync(Ct);

            return true;
        }, Ct);

        private static string ResolveOraclePath() =>
            Path.Combine(FindRepositoryRoot(), "src", "apps", "api", "docs", "storage", "search-oracle.json");

        private static string FindRepositoryRoot()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);

            while (directory is not null)
            {
                if (File.Exists(Path.Combine(directory.FullName, "src", "apps", "api", "TeensyRom.Ui.sln")))
                {
                    return directory.FullName;
                }

                directory = directory.Parent;
            }

            throw new DirectoryNotFoundException($"Could not locate the repository root above '{AppContext.BaseDirectory}'.");
        }

        private static InvalidOperationException NotSeeded() =>
            new("The search oracle fixture was never initialised.");
    }
}
