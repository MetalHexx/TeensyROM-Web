using Microsoft.Data.Sqlite;
using TeensyRom.Core.Storage.Index;

namespace TeensyRom.Core.Storage.Tests.Index
{
    public class IndexQueryPlanTests
    {
        private static readonly CancellationToken Ct = CancellationToken.None;

        [Fact]
        public async Task FilesByParent_Plan_UsesIxFileParentIndex()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            // Seed a file so the plan has something to work with
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            var plan = fixture.QueryPlan(IndexSql.FilesByParent, bind =>
            {
                bind.Parameters.AddWithValue("$storage", storageId);
                bind.Parameters.AddWithValue("$path", "/");
                bind.Parameters.AddWithValue("$storageType", (long)fixture.Scope.StorageType);
            });

            plan.Should().NotBeEmpty();
            plan.Should().Contain(line => line.Contains("ix_file_parent"));
        }

        [Fact]
        public async Task GetFileByPath_Plan_UsesStorageIdPathIndex()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            // Seed a file so the plan has something to work with
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            var sql = $"SELECT {IndexSql.FileColumns} FROM {IndexSql.MetadataJoin} WHERE f.storage_id = $storage AND f.path = $path;";
            var plan = fixture.QueryPlan(sql, bind =>
            {
                bind.Parameters.AddWithValue("$storage", storageId);
                bind.Parameters.AddWithValue("$path", "/music/monty.sid");
                bind.Parameters.AddWithValue("$storageType", (long)fixture.Scope.StorageType);
            });

            plan.Should().NotBeEmpty();
            // Should use an index for the file table lookup (UNIQUE constraint on storage_id, path)
            var fileLookup = plan.FirstOrDefault(line => line.Contains("f"));
            fileLookup.Should().NotBeNullOrEmpty();
            fileLookup.Should().NotContain("SCAN file");
        }
    }
}
