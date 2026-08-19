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

            var plan = fixture.QueryPlan(IndexSql.GetFileByPath, bind =>
            {
                bind.Parameters.AddWithValue("$storage", storageId);
                bind.Parameters.AddWithValue("$path", "/music/monty.sid");
                bind.Parameters.AddWithValue("$storageType", (long)fixture.Scope.StorageType);
            });

            plan.Should().NotBeEmpty();
            // Should use the UNIQUE(storage_id, path) index for the file table lookup, not a table scan
            plan.Should().Contain(line => line.StartsWith("SEARCH f USING") && line.Contains("storage_id") && line.Contains("path"));
        }

        [Fact]
        public async Task IndexSchema_HasIxFileIdentityIndex()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            // Verify that ix_file_identity index exists and ix_file_content does not
            var indexes = fixture.Strings("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='file' ORDER BY name");

            indexes.Should().Contain("ix_file_identity");
            indexes.Should().NotContain("ix_file_content");
        }

        [Fact]
        public async Task ParentLookup_Plan_UsesIndexedAccess()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            // Seed many files to encourage efficient index use
            var file0 = IndexTestFixture.CreateFile("/music/file0.sid");
            for (int i = 0; i < 1000; i++)
            {
                await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile($"/music/file{i}.sid"), Ct);
            }

            // Verify the composite index is in place by testing a simple query
            var plan = fixture.QueryPlan(
                "SELECT f.id FROM file f WHERE f.storage_id = $storage AND f.content_id = $contentId LIMIT 1",
                bind =>
                {
                    bind.Parameters.AddWithValue("$storage", storageId);
                    bind.Parameters.AddWithValue("$contentId", file0.Id);
                }
            );

            plan.Should().NotBeEmpty();
            plan.Should().Contain(line => line.Contains("ix_file_identity"));
        }

        [Fact]
        public async Task SiblingLookup_Plan_UsesIndexedAccess()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            // Seed many files to encourage efficient index use
            var file0 = IndexTestFixture.CreateFile("/music/file0.sid");
            for (int i = 0; i < 1000; i++)
            {
                await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile($"/music/file{i}.sid"), Ct);
            }

            // Verify the composite index is in place by testing a simple query
            var plan = fixture.QueryPlan(
                "SELECT f.id FROM file f WHERE f.storage_id = $storage AND f.content_id = $contentId LIMIT 10",
                bind =>
                {
                    bind.Parameters.AddWithValue("$storage", storageId);
                    bind.Parameters.AddWithValue("$contentId", file0.Id);
                }
            );

            plan.Should().NotBeEmpty();
            plan.Should().Contain(line => line.Contains("ix_file_identity"));
        }

        [Fact]
        public async Task StaleIdentities_Plan_UsesIxFileIdentityIndexForGrouping()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            // Seed files so the planner has enough data to use the index efficiently
            for (int i = 0; i < 1000; i++)
            {
                await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile($"/music/file{i}.sid"), Ct);
            }

            var plan = fixture.QueryPlan(IndexSql.StaleIdentities, bind =>
            {
                bind.Parameters.AddWithValue("$storage", storageId);
                bind.Parameters.AddWithValue("$sourceVersion", "1.0");
            });

            plan.Should().NotBeEmpty();
            // The grouping subquery should use the ix_file_identity index
            plan.Should().Contain(line => line.Contains("ix_file_identity"));
        }

        [Fact]
        public async Task FavoriteRecompute_Plan_UsesIxFileIdentityIndex()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            // Seed files so the planner has enough data to use the index efficiently
            var file0 = IndexTestFixture.CreateFile("/music/file0.sid");
            for (int i = 0; i < 1000; i++)
            {
                await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile($"/music/file{i}.sid"), Ct);
            }

            var plan = fixture.QueryPlan(IndexSql.FavoriteRecompute(), bind =>
            {
                bind.Parameters.AddWithValue("$storage", storageId);
                bind.Parameters.AddWithValue("$contentId", file0.Id);
            });

            plan.Should().NotBeEmpty();
            plan.Should().Contain(line => line.Contains("ix_file_identity"));
        }
    }
}
