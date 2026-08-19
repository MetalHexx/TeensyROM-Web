using Microsoft.Data.Sqlite;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage.Index;

namespace TeensyRom.Core.Storage.Tests.Index
{
    /// <summary>
    /// Writing one file must touch a bounded number of rows no matter how many rows the collection holds.
    /// Microsoft.Data.Sqlite exposes no per-statement row-visit counter, and elapsed time is exactly the
    /// unstable signal a defect like this must not depend on someone remembering to measure, so every
    /// assertion here reads the query plan instead: a statement that seeks at every step is what "bounded"
    /// looks like in the one currency SQLite guarantees to hold steady across versions and machines.
    /// <para>
    /// Every statement is seeded against a few hundred rows first — few enough to stay a fast unit test, many
    /// enough that SQLite's planner prefers an index over a sequential scan on its own, so a real regression
    /// shows up as a genuine "SCAN", not as the planner's legitimate choice on a handful of rows.
    /// </para>
    /// </summary>
    public class WriteCostShapeTests
    {
        private static readonly CancellationToken Ct = CancellationToken.None;

        private const int Seed_File_Count = 300;

        [Fact]
        public async Task UpsertFileAsync_FileUpsert_NeverNeedsToScanForItsConflictRow()
        {
            using var fixture = await SeedAsync();

            // A literal VALUES upsert addresses its row purely through the UNIQUE(storage_id, path) constraint
            // used for ON CONFLICT — there is no FROM clause for the planner to scan, so the bounded-rows claim
            // shows up as an empty plan rather than a SEARCH line.
            var plan = fixture.QueryPlan(IndexSql.FileUpsert, bind =>
            {
                bind.Parameters.AddWithValue("$storage", fixture.StorageId);
                bind.Parameters.AddWithValue("$directory", fixture.RootDirectoryId);
                bind.Parameters.AddWithValue("$path", "/music/target.sid");
                bind.Parameters.AddWithValue("$parent", "/music/");
                bind.Parameters.AddWithValue("$name", "target.sid");
                bind.Parameters.AddWithValue("$size", 100L);
                bind.Parameters.AddWithValue("$fileType", 0);
                bind.Parameters.AddWithValue("$contentId", fixture.TargetFile.Id);
                bind.Parameters.AddWithValue("$isCompatible", 1);
            });

            plan.Should().BeEmpty();
        }

        [Fact]
        public async Task UpsertFileAsync_DirectoryChainUpsert_SeeksTheFkChildCheckInsteadOfScanningFile()
        {
            using var fixture = await SeedAsync();

            // directory is a foreign-key parent of file (file.directory_id, ON DELETE CASCADE), so its own
            // upsert compiles a child-table check alongside the row write. Without ix_file_directory that
            // check is a full "SCAN file"; this is the regression ix_file_directory exists to close.
            var plan = fixture.QueryPlan(IndexSql.DirectoryUpsert, bind =>
            {
                bind.Parameters.AddWithValue("$storage", fixture.StorageId);
                bind.Parameters.AddWithValue("$path", "/music/");
                bind.Parameters.AddWithValue("$parent", "/");
                bind.Parameters.AddWithValue("$name", "music");
            });

            AssertNoUnboundedScan(plan);
            plan.Should().Contain(line => line.Contains("ix_file_directory"));
        }

        [Fact]
        public async Task UpsertFileAsync_FileSearchDelete_IsARowidLookup_NotAnUnindexedScan()
        {
            using var fixture = await SeedAsync();

            var plan = fixture.QueryPlan(IndexSql.FileSearchDelete, bind =>
            {
                bind.Parameters.AddWithValue("$fileId", fixture.TargetFileId);
            });

            // FTS5 always reports "SCAN ... VIRTUAL TABLE" for itself — there is no "SEARCH" wording for a
            // virtual table. What distinguishes a rowid seek from a full index scan is the constraint fts5
            // reports back: "INDEX 0:=" means the rowid equality reached the module; reverting file_id back
            // to UNINDEXED (its old, addressed-by-file_id shape) drops that suffix and this assertion catches it.
            plan.Should().ContainSingle(line => line.Contains("VIRTUAL TABLE INDEX 0:="));
        }

        [Fact]
        public async Task UpsertFileAsync_FileSearchInsert_NeverNeedsToScanForItsRow()
        {
            using var fixture = await SeedAsync();

            var plan = fixture.QueryPlan(IndexSql.FileSearchInsert, bind =>
            {
                bind.Parameters.AddWithValue("$fileId", fixture.TargetFileId);
                bind.Parameters.AddWithValue("$name", "target.sid");
                bind.Parameters.AddWithValue("$path", "/music/target.sid");
            });

            plan.Should().BeEmpty();
        }

        [Fact]
        public async Task UpsertFileAsync_FavoriteRecompute_AndItsInnerExists_BothSeekIxFileIdentity()
        {
            using var fixture = await SeedAsync();

            var plan = fixture.QueryPlan(IndexSql.FavoriteRecompute(), bind =>
            {
                bind.Parameters.AddWithValue("$storage", fixture.StorageId);
                bind.Parameters.AddWithValue("$contentId", fixture.TargetFile.Id);
            });

            AssertNoUnboundedScan(plan);

            // The outer UPDATE ... WHERE and the inner EXISTS subquery are two separate seeks against the
            // same index; losing either one back to ix_file_identity being dropped collapses it to "SCAN file".
            plan.Count(line => line.Contains("ix_file_identity")).Should().Be(2);
        }

        [Fact]
        public async Task UpsertFilesAsync_BatchPath_SharesTheSameBoundedStatementsAndDedupesTheRecompute()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            var batch = new List<FileItem>();

            for (var i = 0; i < Seed_File_Count; i++)
            {
                batch.Add(IndexTestFixture.CreateFile($"/music/batch{i}.sid"));
            }

            // Two files under different directories sharing one size and name share one content identity,
            // which is what makes the favourite recompute's per-identity dedup worth proving here rather than
            // trivially true because every file in the batch was already distinct.
            var original = IndexTestFixture.CreateFile("/music/original/shared.sid", size: 4321);
            var linkedCopy = IndexTestFixture.CreateFile("/music/copy/shared.sid", size: 4321);
            batch.Add(original);
            batch.Add(linkedCopy);

            await fixture.Store.UpsertFilesAsync(fixture.Scope, batch, Ct);

            original.Id.Should().Be(linkedCopy.Id);

            var directoryPlan = fixture.QueryPlan(IndexSql.DirectoryUpsert, bind =>
            {
                bind.Parameters.AddWithValue("$storage", storageId);
                bind.Parameters.AddWithValue("$path", "/music/");
                bind.Parameters.AddWithValue("$parent", "/");
                bind.Parameters.AddWithValue("$name", "music");
            });
            AssertNoUnboundedScan(directoryPlan);

            var recomputePlan = fixture.QueryPlan(IndexSql.FavoriteRecompute(), bind =>
            {
                bind.Parameters.AddWithValue("$storage", storageId);
                bind.Parameters.AddWithValue("$contentId", original.Id);
            });
            AssertNoUnboundedScan(recomputePlan);
            recomputePlan.Count(line => line.Contains("ix_file_identity")).Should().Be(2);
        }

        private static readonly string[] Forbidden_Scans = ["SCAN file_search", "SCAN content_search", "SCAN file"];

        private static void AssertNoUnboundedScan(IReadOnlyList<string> plan)
        {
            foreach (var forbidden in Forbidden_Scans)
            {
                plan.Should().NotContain(line => line.Contains(forbidden));
            }
        }

        private static async Task<SeededFixture> SeedAsync()
        {
            var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            var filler = new List<FileItem>();

            for (var i = 0; i < Seed_File_Count; i++)
            {
                filler.Add(IndexTestFixture.CreateFile($"/music/filler{i}.sid"));
            }

            await fixture.Store.UpsertFilesAsync(fixture.Scope, filler, Ct);

            var target = IndexTestFixture.CreateFile("/music/target.sid");
            await fixture.Store.UpsertFileAsync(fixture.Scope, target, Ct);

            var targetFileId = Convert.ToInt64(fixture.Scalar("SELECT id FROM file WHERE path = $path;", ("$path", "/music/target.sid")));
            var rootDirectoryId = Convert.ToInt64(fixture.Scalar("SELECT id FROM directory WHERE path = '/';"));

            return new SeededFixture(fixture, storageId, target, targetFileId, rootDirectoryId);
        }

        /// <summary>Bundles a ready fixture with the ids its seeding already resolved, so tests bind real values.</summary>
        private sealed class SeededFixture(IndexTestFixture fixture, int storageId, FileItem targetFile, long targetFileId, long rootDirectoryId) : IDisposable
        {
            public int StorageId { get; } = storageId;

            public FileItem TargetFile { get; } = targetFile;

            public long TargetFileId { get; } = targetFileId;

            public long RootDirectoryId { get; } = rootDirectoryId;

            public IReadOnlyList<string> QueryPlan(string sql, Action<SqliteCommand>? bind = null) =>
                fixture.QueryPlan(sql, bind);

            public object? Scalar(string sql, params (string Name, object Value)[] parameters) => fixture.Scalar(sql, parameters);

            public void Dispose() => fixture.Dispose();
        }
    }
}
