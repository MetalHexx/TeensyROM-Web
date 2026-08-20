using FluentAssertions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage.Index;
using TeensyRom.Core.Storage.Index.Fixtures;
using TeensyRom.Core.Storage.Index.Search;
using Xunit;
using Xunit.Abstractions;

namespace TeensyRom.Core.Storage.Tests.Integration
{
    /// <summary>
    /// Asserts <see cref="SqliteIndexStore.SearchAsync"/> — the new store's real FTS-backed search — against
    /// the committed <c>search-oracle.json</c>, over the same real collection
    /// <see cref="QueryEquivalenceTests"/> compares: the local fixture seeded through the production write and
    /// projection paths, with the real HVSC database supplying creators and STIL commentary.
    /// </summary>
    /// <remarks>
    /// The oracle's expected paths and exact counts belong to one collection, so every test here is an
    /// <see cref="OracleFactAttribute"/>: a machine with no fixture, no HVSC database, or a different
    /// collection is told which of the three it is and skipped, rather than failed against numbers that were
    /// never about its card.
    /// </remarks>
    [Collection(SeededCollection.Name)]
    public sealed class SearchOracleTests
    {
        private const int Generous_Limit = 5000;

        private static readonly CancellationToken Ct = CancellationToken.None;

        private readonly SeededCollectionFixture _fixture;
        private readonly ITestOutputHelper _output;

        public SearchOracleTests(SeededCollectionFixture fixture, ITestOutputHelper output)
        {
            _fixture = fixture;
            _output = output;
        }

        public static IEnumerable<object[]> Cases() => CommittedOracle.Cases.Select(c => new object[] { c });

        [OracleTheory]
        [MemberData(nameof(Cases))]
        public async Task Search_ForEachOracleCase_MatchesExpectedPaths_ExcludesForbiddenPaths_AndStaysWithinBounds(SearchOracleCase oracleCase)
        {
            var results = await _fixture.Store.SearchAsync(
                _fixture.Scope, oracleCase.Term, SeededCollectionFixture.ExcludePaths, [], Generous_Limit, Ct);

            var paths = results.Select(r => r.Path.Value).ToList();
            _output.WriteLine($"'{oracleCase.Term}' ({oracleCase.Intent}): {paths.Count} result(s)");

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

        [OracleFact]
        public async Task Search_ForTheOperatorCharacterCase_DoesNotThrow()
        {
            var operatorCase = CommittedOracle.Cases.Single(c => c.Term.Any(ch => ch is '"' or '-' or '*'));

            Func<Task> act = async () => await _fixture.Store.SearchAsync(
                _fixture.Scope, operatorCase.Term, SeededCollectionFixture.ExcludePaths, [], Generous_Limit, Ct);

            await act.Should().NotThrowAsync("a search term with FTS5 operator characters must be handled, not throw");
        }

        /// <summary>
        /// The comparison the oracle exists for: today's predicate reads a generated fallback description off
        /// every unenriched entity, so a word from that boilerplate matches a large fraction of the whole
        /// collection, while the new store — which never indexes the fallback — answers with the handful of
        /// files whose commentary genuinely says it. Both numbers are measured here, live, against the same
        /// card. <c>SEARCH-ORACLE.md</c> records the run.
        /// </summary>
        [OracleFact]
        public async Task Search_ForTheBoilerplateTerm_AnswersOrdersOfMagnitudeSmallerThanTodaysPredicate()
        {
            var boilerplateCase = CommittedOracle.BoilerplateCase;

            var fromStore = await _fixture.Store.SearchAsync(
                _fixture.Scope, boilerplateCase.Term, SeededCollectionFixture.ExcludePaths, [], Generous_Limit, Ct);

            var fromToday = _fixture.Cache
                .Search(boilerplateCase.Term, SeededCollectionFixture.ExcludePaths, TeensyFileTypeExtensions.GetLaunchFileTypes())
                .ToList();

            _output.WriteLine($"'{boilerplateCase.Term}': new store {fromStore.Count}, today's predicate {fromToday.Count}, " +
                              $"of {await _fixture.Store.GetFileCountAsync(_fixture.Scope, Ct)} indexed files");

            fromToday.Count.Should().BeGreaterThan(fromStore.Count * 100,
                "the boilerplate term only proves anything if today's predicate over-matches by orders of magnitude");
        }
    }

    /// <summary>The committed oracle, read once for the whole suite from the repository's docs directory.</summary>
    public static class CommittedOracle
    {
        private static readonly SearchOracleDocument Document = SearchOracle.Load(ResolvePath());

        public static SearchOracleCollection Collection => Document.Collection;

        public static IReadOnlyList<SearchOracleCase> Cases => Document.Cases;

        /// <summary>
        /// The case whose term comes from a type's generated fallback description. It is the one case whose
        /// meaning is a comparison against today rather than a bound, so the suite has to be able to name it.
        /// </summary>
        public static SearchOracleCase BoilerplateCase => Cases.Single(c => c.Intent.Contains("boilerplate", StringComparison.OrdinalIgnoreCase));

        /// <summary>
        /// Whether <paramref name="header"/> and <paramref name="hvscCsvPath"/> are the pair the oracle was
        /// curated against. Terms and counts drawn from one card say nothing about another, and the creator
        /// and commentary counts move with the HVSC export too.
        /// </summary>
        public static bool DescribesCollection(IndexFixtureHeader header, string hvscCsvPath) =>
            string.Equals(header.DeviceId, Collection.DeviceId, StringComparison.OrdinalIgnoreCase) &&
            header.StorageType == Collection.StorageType &&
            header.FileCount == Collection.FileCount &&
            string.Equals(Path.GetFileName(hvscCsvPath), Collection.MetadataSource, StringComparison.OrdinalIgnoreCase);

        private static string ResolvePath() =>
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
    }

    /// <summary>
    /// Resolves whether this machine can be asked the oracle's questions at all: it needs the fixture/index
    /// pair, the HVSC database the projection draws real creators and commentary from, and the very
    /// collection the oracle was curated against.
    /// </summary>
    internal static class OracleAvailability
    {
        public static string? WhyUnavailable()
        {
            if (!FixtureAvailability.HasFixtureAndIndex(out var noFixture))
            {
                return noFixture;
            }

            if (!MetadataSourceAvailability.HasHvsc(out var noHvsc))
            {
                return $"{noHvsc} The oracle's creator and commentary cases need real enrichment to mean anything.";
            }

            var header = FixtureAvailability.Require().Header;
            var hvscCsvPath = MetadataSourceAvailability.TryResolve()!.HvscCsvPath;

            if (!CommittedOracle.DescribesCollection(header, hvscCsvPath))
            {
                var oracle = CommittedOracle.Collection;

                return $"The local inputs (device '{header.DeviceId}', {header.StorageType}, {header.FileCount} files, " +
                       $"'{Path.GetFileName(hvscCsvPath)}') are not what the oracle was curated against (device " +
                       $"'{oracle.DeviceId}', {oracle.StorageType}, {oracle.FileCount} files, '{oracle.MetadataSource}'). " +
                       $"Re-curate the oracle against this collection to assert it here.";
            }

            return null;
        }
    }

    /// <summary>A fact that skips — rather than fails — when this machine is not the oracle's collection.</summary>
    public sealed class OracleFactAttribute : FactAttribute
    {
        public OracleFactAttribute() => Skip = OracleAvailability.WhyUnavailable();
    }

    /// <summary>A theory that skips — rather than fails — when this machine is not the oracle's collection.</summary>
    public sealed class OracleTheoryAttribute : TheoryAttribute
    {
        public OracleTheoryAttribute() => Skip = OracleAvailability.WhyUnavailable();
    }
}
