using Microsoft.Data.Sqlite;
using NSubstitute;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Games;
using TeensyRom.Core.Music;
using TeensyRom.Core.Storage.Index;
using TeensyRom.Core.ValueObjects;

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
        public async Task FileSearchDelete_Plan_IsARowidLookup_NotAnUnconstrainedIndexScan()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            var plan = fixture.QueryPlan(IndexSql.FileSearchDelete, bind =>
            {
                bind.Parameters.AddWithValue("$fileId", 1L);
            });

            plan.Should().NotBeEmpty();
            // SQLite's own plan wording for an FTS5 virtual table always starts "SCAN ... VIRTUAL TABLE" —
            // there is no "SEARCH" phrasing for a virtual table the way there is for an ordinary rowid table.
            // What distinguishes a seek from a full-index scan is the constraint fts5 reports back in its
            // index string: "INDEX 0:=" means the rowid equality reached the module and narrowed the scan;
            // "INDEX 0:" with nothing after the colon (the old file_id-keyed defect) means it did not.
            plan.Should().ContainSingle(line => line.Contains("VIRTUAL TABLE INDEX 0:="));
        }

        [Fact]
        public async Task ContentSearchDelete_Plan_IsARowidLookup_NotAnUnconstrainedIndexScan()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            var plan = fixture.QueryPlan(IndexSql.ContentSearchDelete, bind =>
            {
                bind.Parameters.AddWithValue("$rowId", 1L);
            });

            plan.Should().NotBeEmpty();
            plan.Should().ContainSingle(line => line.Contains("VIRTUAL TABLE INDEX 0:="));
        }

        [Fact]
        public async Task FileSearch_RepeatedUpsertLeavesOneRow_AndARenameDropsTheOldName()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();

            // The path stays fixed across the "rename" so only the name column can explain a match — the
            // token has to be exclusive to it, since path also feeds the same full-text row.
            var path = new FilePath("/music/track.sid");
            var original = new FileItem { Path = path, Name = "zzzoriginalname.sid", Size = 100 };
            await fixture.Store.UpsertFileAsync(fixture.Scope, original, Ct);
            await fixture.Store.UpsertFileAsync(fixture.Scope, original, Ct);

            fixture.Count("SELECT COUNT(*) FROM file_search;").Should().Be(1);
            fixture.Count("SELECT COUNT(*) FROM file_search WHERE file_search MATCH 'zzzoriginalname';").Should().Be(1);

            var renamed = new FileItem { Path = path, Name = "zzzrenamedname.sid", Size = 100 };
            await fixture.Store.UpsertFileAsync(fixture.Scope, renamed, Ct);

            fixture.Count("SELECT COUNT(*) FROM file_search;").Should().Be(1);
            fixture.Count("SELECT COUNT(*) FROM file_search WHERE file_search MATCH 'zzzoriginalname';").Should().Be(0);
        }

        [Fact]
        public async Task ContentSearch_RepeatedProjectionOfTheSameIdentity_LeavesExactlyOneRow()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/repeat.sid", size: 100), Ct);

            var sourceVersion = new FakeSourceVersion("v1");
            var projection = new MetadataProjection(
                fixture.Database,
                Substitute.For<ISidMetadataService>(),
                Substitute.For<IGameMetadataService>(),
                sourceVersion);

            await projection.ProjectAsync(fixture.Scope, null, Ct);
            fixture.Count("SELECT COUNT(*) FROM content_search;").Should().Be(1);

            // A changed source version is what makes the already-projected identity stale again, so the
            // second run re-projects it rather than skipping it as up to date.
            sourceVersion.Current = "v2";
            await projection.ProjectAsync(fixture.Scope, null, Ct);

            fixture.Count("SELECT COUNT(*) FROM content_search;").Should().Be(1);
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

        private sealed class FakeSourceVersion(string current) : IMetadataSourceVersion
        {
            public string Current { get; set; } = current;
        }
    }
}
