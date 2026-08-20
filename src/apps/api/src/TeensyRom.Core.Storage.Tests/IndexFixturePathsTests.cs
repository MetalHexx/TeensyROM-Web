using TeensyRom.Core.Storage.Index.Fixtures;

namespace TeensyRom.Core.Storage.Tests
{
    public class IndexFixturePathsTests
    {
        private const string EnvironmentVariable = "TEENSYROM_FIXTURE_DIR";

        [Fact]
        public void ResolveDirectory_Honours_FixtureDirEnvironmentVariable()
        {
            // Arrange
            var previousValue = Environment.GetEnvironmentVariable(EnvironmentVariable);
            var expectedPath = Path.Combine(Path.GetTempPath(), "teensyrom-fixture-dir-test");
            Environment.SetEnvironmentVariable(EnvironmentVariable, expectedPath);

            try
            {
                // Act
                var resolved = IndexFixturePaths.ResolveDirectory();

                // Assert
                resolved.Should().Be(expectedPath);
            }
            finally
            {
                Environment.SetEnvironmentVariable(EnvironmentVariable, previousValue);
            }
        }

        [Fact]
        public void ResolveDirectory_FallsBack_ToRepoLocalFixturesDirectory_WhenEnvironmentVariableUnset()
        {
            // Arrange
            var previousValue = Environment.GetEnvironmentVariable(EnvironmentVariable);
            Environment.SetEnvironmentVariable(EnvironmentVariable, null);

            try
            {
                // Act
                var resolved = IndexFixturePaths.ResolveDirectory();

                // Assert
                resolved.Should().EndWith(Path.Combine("src", "apps", "api", ".local-fixtures"));
            }
            finally
            {
                Environment.SetEnvironmentVariable(EnvironmentVariable, previousValue);
            }
        }
    }
}
