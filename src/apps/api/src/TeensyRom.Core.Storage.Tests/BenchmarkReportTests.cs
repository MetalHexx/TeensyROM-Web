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
    }
}
