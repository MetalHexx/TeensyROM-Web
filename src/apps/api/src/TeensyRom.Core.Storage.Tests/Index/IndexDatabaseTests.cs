using TeensyRom.Core.Storage.Index;

namespace TeensyRom.Core.Storage.Tests.Index
{
    public class IndexDatabaseTests
    {
        [Fact]
        public async Task EnsureCreatedAsync_CreatesTheFileAndEveryTable()
        {
            using var fixture = IndexTestFixture.Create();

            await fixture.Database.EnsureCreatedAsync(CancellationToken.None);

            File.Exists(fixture.DatabasePath).Should().BeTrue();

            var tables = fixture.Strings("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;");

            tables.Should().Contain(["storage", "directory", "file", "content_metadata", "file_search", "content_search"]);
        }

        [Fact]
        public async Task EnsureCreatedAsync_SwitchesTheFileToWriteAheadLogging()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            fixture.Scalar("PRAGMA journal_mode;").Should().Be("wal");
        }

        [Fact]
        public async Task EnsureCreatedAsync_IsSafeToCallRepeatedly()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Database.EnsureCreatedAsync(CancellationToken.None);

            fixture.Count("SELECT COUNT(*) FROM storage;").Should().Be(0);
        }

        [Fact]
        public async Task OpenRead_AppliesForeignKeyEnforcementToEveryConnection()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            fixture.Count("PRAGMA foreign_keys;").Should().Be(1);
        }

        [Fact]
        public async Task WriteAsync_WhenTheWorkThrows_LeavesThePreviousState()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            var write = async () => await fixture.Database.WriteAsync<int>(async (connection, transaction) =>
            {
                await using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = "INSERT INTO storage (device_id, storage_type) VALUES ('half-written', 0);";
                await command.ExecuteNonQueryAsync(CancellationToken.None);

                throw new InvalidOperationException("The write was interrupted.");
            }, CancellationToken.None);

            await write.Should().ThrowAsync<InvalidOperationException>();

            fixture.Count("SELECT COUNT(*) FROM storage;").Should().Be(0);
        }

        [Fact]
        public async Task WriteAsync_CommitsBeforeItReturns()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            await fixture.Database.WriteAsync(async (connection, transaction) =>
            {
                await using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = "INSERT INTO storage (device_id, storage_type) VALUES ('committed', 0);";

                return await command.ExecuteNonQueryAsync(CancellationToken.None);
            }, CancellationToken.None);

            fixture.Count("SELECT COUNT(*) FROM storage;").Should().Be(1);
        }
    }
}
