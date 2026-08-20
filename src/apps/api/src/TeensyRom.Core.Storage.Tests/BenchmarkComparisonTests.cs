using TeensyRom.Tools.StorageBenchmark;
using TeensyRom.Tools.StorageBenchmark.Scenarios;

namespace TeensyRom.Core.Storage.Tests
{
    public class BenchmarkComparisonTests
    {
        [Fact]
        public void BuildComparisonRows_BothSidesMeasureTheOperation_ComputesAbsoluteDelta()
        {
            // Arrange
            var legacy = new List<ScenarioResult> { new("Search", 5, 10.0, 9.0, 11.0, 100, 1000) };
            var store = new List<ScenarioResult> { new("Search", 5, 2.5, 2.0, 3.0, 50, 900) };

            // Act
            var rows = BenchmarkReport.BuildComparisonRows(legacy, store);

            // Assert
            var row = rows.Should().ContainSingle().Subject;
            row.LegacyMedianMs.Should().Be(10.0);
            row.StoreMedianMs.Should().Be(2.5);
            row.DeltaMs.Should().Be(-7.5);
        }

        [Fact]
        public void BuildComparisonRows_OperationMissingFromStore_RendersStoreSideAsAbsentNotZero()
        {
            // Arrange - a zero delta would falsely claim "no measurable difference" for an operation nobody
            // measured on the store side.
            var legacy = new List<ScenarioResult> { new("Cold start to queryable", 5, 386.1, 346.9, 755.3, 0, 0) };
            var store = new List<ScenarioResult>();

            // Act
            var rows = BenchmarkReport.BuildComparisonRows(legacy, store);

            // Assert
            var row = rows.Should().ContainSingle().Subject;
            row.LegacyMedianMs.Should().Be(386.1);
            row.StoreMedianMs.Should().BeNull();
            row.DeltaMs.Should().BeNull();
        }

        [Fact]
        public void BuildComparisonRows_OperationMissingFromLegacy_RendersLegacySideAsAbsentNotZero()
        {
            // Arrange
            var legacy = new List<ScenarioResult>();
            var store = new List<ScenarioResult> { new("Search", 5, 2.5, 2.0, 3.0, 50, 900) };

            // Act
            var rows = BenchmarkReport.BuildComparisonRows(legacy, store);

            // Assert
            var row = rows.Should().ContainSingle().Subject;
            row.LegacyMedianMs.Should().BeNull();
            row.StoreMedianMs.Should().Be(2.5);
            row.DeltaMs.Should().BeNull();
        }

        [Fact]
        public void StoreScenarioSet_NamesTheSameOperationsAsTheLegacySet()
        {
            // Arrange - the legacy set's own operation names, as emitted by LegacyCacheScenarios.Run: one
            // "Cold start to queryable", one directory listing, one search, one "Random by scope" per
            // StorageScope value, a parent and a sibling lookup, a single upsert, a bulk upsert plus its
            // trailing parent lookup, and the peak-memory scan.
            var legacyOperationNames = new[]
            {
                "Cold start to queryable",
                "Directory listing by path",
                "Search",
                "Random by scope (Storage)",
                "Random by scope (DirDeep)",
                "Random by scope (DirShallow)",
                "Parent lookup by identity",
                "Sibling lookup by identity",
                "Single upsert",
                "Bulk upsert (500) + parent lookup (identity map rebuild)",
                "Peak memory with every discovered index loaded"
            };

            // Act & Assert - keeping the comparison honest as scenarios are added to either side.
            IndexStoreScenarios.OperationNames.Should().Equal(legacyOperationNames);
        }
    }
}
