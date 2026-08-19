using TeensyRom.Core.Entities.Storage;
using TeensyRom.Tools.StorageBenchmark;

namespace TeensyRom.Core.Storage.Tests
{
    public class BenchmarkReportTests
    {
        [Fact]
        public void Build_EmitsARowForEveryScenario()
        {
            // Arrange
            var options = new BenchmarkOptions(
                DataDir: "C:/fake/data",
                DeviceId: "TEST01",
                Storage: TeensyStorageType.SD,
                Iterations: 3,
                OutPath: null,
                Scenarios: "legacy");

            var results = new List<ScenarioResult>
            {
                new("Directory listing by path", 3, 1.1, 0.9, 1.4, 1024, 2048),
                new("Search", 3, 5.5, 5.0, 6.0, 4096, 8192),
                new("Cold start to queryable", 3, 120.0, 100.0, 150.0, 32768, 65536)
            };

            // Act
            var report = BenchmarkReport.Build(options, results, []);

            // Assert
            results.Should().OnlyContain(result => report.Contains(result.Operation));
        }

        [Fact]
        public void BuildComparisonRows_WithAPriorMedianForAnOperation_PopulatesPriorMedianAndDeltaAgainstIt()
        {
            var legacyResults = new List<ScenarioResult> { new("Search", 3, 50.0, 45.0, 55.0, 0, 0) };
            var storeResults = new List<ScenarioResult> { new("Search", 3, 40.0, 35.0, 45.0, 0, 0) };
            var priorMedians = new Dictionary<string, double> { ["Search"] = 30.0 };

            var rows = BenchmarkReport.BuildComparisonRows(legacyResults, storeResults, priorMedians);

            var row = rows.Should().ContainSingle().Subject;
            row.PriorMedianMs.Should().Be(30.0);
            row.PriorDeltaMs.Should().Be(10.0);
        }

        [Fact]
        public void BuildComparisonRows_WhenAnOperationHasNoPriorEntry_LeavesItsPriorFieldsNull()
        {
            var legacyResults = new List<ScenarioResult>
            {
                new("Search", 3, 50.0, 45.0, 55.0, 0, 0),
                new("Single upsert", 3, 5.0, 4.0, 6.0, 0, 0)
            };
            var storeResults = new List<ScenarioResult>
            {
                new("Search", 3, 40.0, 35.0, 45.0, 0, 0),
                new("Single upsert", 3, 3.0, 2.0, 4.0, 0, 0)
            };
            var priorMedians = new Dictionary<string, double> { ["Search"] = 30.0 };

            var rows = BenchmarkReport.BuildComparisonRows(legacyResults, storeResults, priorMedians);

            var upsertRow = rows.Single(r => r.Operation == "Single upsert");
            upsertRow.PriorMedianMs.Should().BeNull();
            upsertRow.PriorDeltaMs.Should().BeNull();
        }

        [Fact]
        public void BuildComparisonRows_WhenAPriorKeyMatchesNoOperation_ThrowsNamingTheKey()
        {
            var legacyResults = new List<ScenarioResult> { new("Search", 3, 50.0, 45.0, 55.0, 0, 0) };
            var storeResults = new List<ScenarioResult> { new("Search", 3, 40.0, 35.0, 45.0, 0, 0) };
            var priorMedians = new Dictionary<string, double> { ["Nonexistent operation"] = 1.0 };

            var act = () => BenchmarkReport.BuildComparisonRows(legacyResults, storeResults, priorMedians);

            act.Should().Throw<InvalidOperationException>().WithMessage("*Nonexistent operation*");
        }

        [Fact]
        public void BuildComparison_WithoutPrior_RendersTodaysTwoColumnTableUnchanged()
        {
            var options = new BenchmarkOptions(
                DataDir: "C:/fake/data", DeviceId: "TEST01", Storage: TeensyStorageType.SD,
                Iterations: 3, OutPath: null, Scenarios: "both");

            var legacyResults = new List<ScenarioResult> { new("Search", 3, 50.0, 45.0, 55.0, 0, 0) };
            var storeResults = new List<ScenarioResult> { new("Search", 3, 40.0, 35.0, 45.0, 0, 0) };

            var report = BenchmarkReport.BuildComparison(options, legacyResults, storeResults, [], TimeSpan.Zero);

            report.Should().NotContain("STORAGE-1");
            report.Should().Contain("| Operation | Legacy median (ms) | Store median (ms) | Delta (ms) |");
        }

        [Fact]
        public void BuildComparison_WithPriorMissingAnOperation_RendersAnEmDashForItsPriorColumns()
        {
            var options = new BenchmarkOptions(
                DataDir: "C:/fake/data", DeviceId: "TEST01", Storage: TeensyStorageType.SD,
                Iterations: 3, OutPath: null, Scenarios: "both");

            var legacyResults = new List<ScenarioResult> { new("Single upsert", 3, 5.0, 4.0, 6.0, 0, 0) };
            var storeResults = new List<ScenarioResult> { new("Single upsert", 3, 3.0, 2.0, 4.0, 0, 0) };
            var priorMedians = new Dictionary<string, double>();

            var report = BenchmarkReport.BuildComparison(options, legacyResults, storeResults, [], TimeSpan.Zero, priorMedians);

            report.Should().Contain("| Single upsert | 5.000 | — | 3.000 | -2.000 | — |");
        }
    }
}
