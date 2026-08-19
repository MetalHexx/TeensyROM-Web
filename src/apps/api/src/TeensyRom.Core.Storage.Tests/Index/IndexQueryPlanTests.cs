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
        public async Task RandomCandidate_Storage_Plan_SeeksByPathRangeInsteadOfScanningTheFile()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            var plan = fixture.QueryPlan(IndexSql.RandomCandidate(StorageScope.Storage, 1, 0), bind =>
            {
                bind.Parameters.AddWithValue("$storage", storageId);
                bind.Parameters.AddWithValue("$scopePrefix", IndexPathPatterns.PrefixPattern("/"));
                bind.Parameters.AddWithValue("$type0", (long)TeensyFileType.Sid);
                bind.Parameters.AddWithValue("$offset", 0L);
            });

            plan.Should().NotBeEmpty();
            // The prefix LIKE optimization turns the path predicate into a range scan against the
            // UNIQUE(storage_id, path) autoindex; a genuine regression to a bare table scan reads
            // "SCAN f" instead, which this line can actually catch.
            plan.Should().Contain(line => line.StartsWith("SEARCH f USING INDEX") && line.Contains("path"));
        }

        [Fact]
        public async Task RandomCandidate_DirDeep_Plan_SeeksByPathRangeInsteadOfScanningTheFile()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            var plan = fixture.QueryPlan(IndexSql.RandomCandidate(StorageScope.DirDeep, 1, 0), bind =>
            {
                bind.Parameters.AddWithValue("$storage", storageId);
                bind.Parameters.AddWithValue("$scopePrefix", IndexPathPatterns.PrefixPattern("/music/"));
                bind.Parameters.AddWithValue("$type0", (long)TeensyFileType.Sid);
                bind.Parameters.AddWithValue("$offset", 0L);
            });

            plan.Should().NotBeEmpty();
            plan.Should().Contain(line => line.StartsWith("SEARCH f USING INDEX") && line.Contains("path"));
        }

        [Fact]
        public async Task RandomCandidate_DirShallow_Plan_SeeksIxFileParent()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            // Seed one file under the scoped directory against many sharing its file type under other
            // directories. Without ANALYZE — production's actual condition, never exercised here — SQLite's
            // planner defaults this predicate to ix_file_type, the same shared, unselective index Search's own
            // no-ANALYZE blind spot picks; IndexSql.RandomTable pins DirShallow to ix_file_parent so the plan
            // this asserts is the one production gets, not one that only appears after a statistics pass
            // production never runs.
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            for (int i = 0; i < 1000; i++)
            {
                await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile($"/other{i}/file{i}.sid"), Ct);
            }

            var plan = fixture.QueryPlan(IndexSql.RandomCandidate(StorageScope.DirShallow, 1, 0), bind =>
            {
                bind.Parameters.AddWithValue("$storage", storageId);
                bind.Parameters.AddWithValue("$scopePath", "/music/");
                bind.Parameters.AddWithValue("$type0", (long)TeensyFileType.Sid);
                bind.Parameters.AddWithValue("$offset", 0L);
            });

            plan.Should().NotBeEmpty();
            plan.Should().Contain(line => line.Contains("ix_file_parent"));
        }

        [Fact]
        public async Task RandomCount_DirShallow_Plan_SeeksIxFileParent()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            // RandomCount and RandomCandidate share one predicate so they never see different candidate
            // sets; pinning only the offset query would leave the count still driving off ix_file_type,
            // costing every file of the requested type storage-wide on every draw.
            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            for (int i = 0; i < 1000; i++)
            {
                await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile($"/other{i}/file{i}.sid"), Ct);
            }

            var plan = fixture.QueryPlan(IndexSql.RandomCount(StorageScope.DirShallow, 1, 0), bind =>
            {
                bind.Parameters.AddWithValue("$storage", storageId);
                bind.Parameters.AddWithValue("$scopePath", "/music/");
                bind.Parameters.AddWithValue("$type0", (long)TeensyFileType.Sid);
            });

            plan.Should().NotBeEmpty();
            plan.Should().Contain(line => line.Contains("ix_file_parent"));
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
        public async Task ParentLookup_Plan_SeeksIxFileIdentity()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            // Seed many files, ordered ahead of the match in path order, so a regression back to the
            // path-ordered UNIQUE(storage_id, path) autoindex shows up as that index's name in the plan
            // rather than as the planner's legitimate choice on a handful of rows.
            var file0 = IndexTestFixture.CreateFile("/music/file0.sid");
            for (int i = 0; i < 1000; i++)
            {
                await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile($"/music/file{i}.sid"), Ct);
            }

            var plan = fixture.QueryPlan(IndexSql.ParentLookup(), bind =>
            {
                bind.Parameters.AddWithValue("$storage", storageId);
                bind.Parameters.AddWithValue("$contentId", file0.Id);
                bind.Parameters.AddWithValue("$storageType", (long)fixture.Scope.StorageType);
                IndexPathPatterns.BindLinkedCopyParameters(bind);
            });

            plan.Should().NotBeEmpty();
            plan.Should().Contain(line => line.Contains("ix_file_identity"));
            plan.Should().NotContain(line => line.Contains("sqlite_autoindex_file"));
        }

        [Fact]
        public async Task SiblingLookup_Plan_SeeksIxFileIdentity()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            // Seed many files, ordered ahead of the match in path order, so a regression back to the
            // path-ordered UNIQUE(storage_id, path) autoindex shows up as that index's name in the plan
            // rather than as the planner's legitimate choice on a handful of rows.
            var file0 = IndexTestFixture.CreateFile("/music/file0.sid");
            for (int i = 0; i < 1000; i++)
            {
                await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile($"/music/file{i}.sid"), Ct);
            }

            var plan = fixture.QueryPlan(IndexSql.SiblingLookup(), bind =>
            {
                bind.Parameters.AddWithValue("$storage", storageId);
                bind.Parameters.AddWithValue("$contentId", file0.Id);
                bind.Parameters.AddWithValue("$ownPath", "/music/file0.sid");
                bind.Parameters.AddWithValue("$storageType", (long)fixture.Scope.StorageType);
                IndexPathPatterns.BindLinkedCopyParameters(bind);
            });

            plan.Should().NotBeEmpty();
            plan.Should().Contain(line => line.Contains("ix_file_identity"));
            plan.Should().NotContain(line => line.Contains("sqlite_autoindex_file"));
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
        public async Task Search_Plan_PinsContentBranchToIxFileIdentity()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile("/music/monty.sid"), Ct);

            var plan = fixture.QueryPlan(IndexSql.Search(1, 0), bind =>
            {
                bind.Parameters.AddWithValue("$storage", storageId);
                bind.Parameters.AddWithValue("$match", "\"mon\"*");
                bind.Parameters.AddWithValue("$limit", 200L);
                bind.Parameters.AddWithValue("$type0", (long)TeensyFileType.Sid);
            });

            plan.Should().NotBeEmpty();
            // SEARCH-PLAN-FINDING.md: with no ANALYZE statistics, SQLite's planner never switches off the
            // shared ix_file_type scan to reach ix_file_identity for the content_id branch on its own, so an
            // OR of the two full-text subqueries falls back to one unselective scan probing both. The UNION
            // rewrite pins the content_id branch with INDEXED BY, which is what this plan line proves took.
            plan.Should().Contain(line => line.Contains("SEARCH f USING INDEX ix_file_identity") && line.Contains("content_id"));
        }

        [Fact]
        public async Task Search_WhenAFileMatchesBothTheNameAndContentBranches_ReturnsItExactlyOnce()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            // A file whose name matches "zelda" via file_search and whose (directly seeded) content_search
            // row also carries "zelda": one row satisfies both UNION branches. UNION — not UNION ALL — is
            // what keeps it from surfacing twice; that dedup behavior is the failure mode the OR-to-UNION
            // rewrite could plausibly introduce, so it earns its own case per the task's testing guidance.
            var file = IndexTestFixture.CreateFile("/music/zelda.sid");
            await fixture.Store.UpsertFileAsync(fixture.Scope, file, Ct);

            await fixture.ExecuteAsync(
                "INSERT INTO content_search (title, creator, description, content_id) VALUES ($title, '', '', $contentId);",
                ("$title", "Zelda Tribute"),
                ("$contentId", file.Id));

            var results = await fixture.Store.SearchAsync(
                fixture.Scope, "zelda", [], [TeensyFileType.Sid], 10, Ct);

            results.Should().ContainSingle(r => r.Path.Value == file.Path.Value);
        }

        /// <summary>
        /// <c>SearchOracleTests</c> is the real contract for search's results, but it does not execute in
        /// every environment — it skips wherever the seeded real-collection fixture and index cache it needs
        /// are absent. This is the guard that runs everywhere: it seeds a small mixed collection right
        /// here and shows the shipped UNION statement answers exactly what the pre-fix OR statement answered,
        /// in the same order, for a term that exercises a name-only match, a content-only match, a match on
        /// both branches at once (the UNION's own new dedup concern), and non-matching noise.
        /// </summary>
        [Fact]
        public async Task Search_UnionRewrite_ReturnsTheSameOrderedResultsAsTheOriginalOrStatement()
        {
            using var fixture = await IndexTestFixture.CreateReadyAsync();
            var storageId = await fixture.Store.EnsureStorageAsync(fixture.Scope, Ct);

            var nameOnlyMatches = new[] { "riverquest.sid", "riverside.sid", "riverboat.sid" };
            var contentOnlyMatches = new[] { "alpha.sid", "beta.sid" };
            var bothBranchesMatch = new[] { "riverdance.sid" };
            var noMatch = new[] { "unrelated1.sid", "unrelated2.sid", "unrelated3.sid" };

            foreach (var name in nameOnlyMatches.Concat(contentOnlyMatches).Concat(bothBranchesMatch).Concat(noMatch))
            {
                await fixture.Store.UpsertFileAsync(fixture.Scope, IndexTestFixture.CreateFile($"/music/{name}"), Ct);
            }

            foreach (var name in contentOnlyMatches.Concat(bothBranchesMatch))
            {
                var file = IndexTestFixture.CreateFile($"/music/{name}");

                await fixture.ExecuteAsync(
                    "INSERT INTO content_search (title, creator, description, content_id) VALUES ($title, '', '', $contentId);",
                    ("$title", "river tributary"),
                    ("$contentId", file.Id));
            }

            const string OldOrStatement = """
                SELECT f.path
                  FROM file f LEFT JOIN content_metadata m ON m.content_id = f.content_id
                 WHERE f.storage_id = $storage
                   AND f.file_type IN ($type0)
                   AND ( f.id         IN (SELECT file_id    FROM file_search    WHERE file_search    MATCH $match)
                      OR f.content_id IN (SELECT content_id FROM content_search WHERE content_search MATCH $match) )
                 ORDER BY f.name
                 LIMIT $limit;
                """;

            void Bind(SqliteCommand command)
            {
                command.Parameters.AddWithValue("$storage", storageId);
                command.Parameters.AddWithValue("$match", "\"river\"*");
                command.Parameters.AddWithValue("$limit", 200L);
                command.Parameters.AddWithValue("$type0", (long)TeensyFileType.Sid);
                command.Parameters.AddWithValue("$storageType", (long)fixture.Scope.StorageType);
            }

            var oldPaths = ReadColumn(fixture, OldOrStatement, "path", Bind);
            var newPaths = ReadColumn(fixture, IndexSql.Search(1, 0), "path", Bind);

            newPaths.Should().NotBeEmpty();
            newPaths.Should().OnlyHaveUniqueItems();
            newPaths.Should().Equal(oldPaths, "the UNION rewrite must answer exactly what the OR statement it replaced answered, in the same order");
        }

        private static List<string> ReadColumn(IndexTestFixture fixture, string sql, string column, Action<SqliteCommand> bind)
        {
            using var connection = fixture.Database.OpenRead();
            using var command = connection.CreateCommand();
            command.CommandText = sql;
            bind(command);

            using var reader = command.ExecuteReader();
            var ordinal = -1;
            var values = new List<string>();

            while (reader.Read())
            {
                if (ordinal < 0)
                {
                    ordinal = reader.GetOrdinal(column);
                }

                values.Add(reader.GetString(ordinal));
            }

            return values;
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
