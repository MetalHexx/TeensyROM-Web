using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Core.Storage.Index
{
    /// <summary>
    /// The SQL text behind the index store's and the metadata projection's performance-critical statements,
    /// gathered onto one seam so a test asserting a statement's shape reads the exact text that runs in
    /// production rather than a retyped copy that can silently drift from it.
    /// </summary>
    public static class IndexSql
    {
        /// <summary>
        /// The column list every file-selecting query shares, closed by a projection of the scope's storage
        /// type so <see cref="IndexRowMapper.MapFile"/> can read it off the row like every other field — the
        /// column itself does not exist on <c>file</c> because a scope is already exactly one storage type.
        /// Every query pairs this with a <c>content_metadata</c> left join keyed on content identity — usually
        /// <see cref="MetadataJoin"/> directly, though <see cref="Search"/> joins it against a derived table
        /// instead — so the content-identity columns ride along unconditionally.
        /// </summary>
        public const string FileColumns = """
            f.name, f.path, f.size, f.file_type, f.is_favorite, f.is_compatible, $storageType AS storage_type,
            m.title, m.creator, m.description, m.play_length, m.release_info,
            m.metadata_source, m.metadata_source_path, m.share_url, m.meta1, m.meta2
            """;

        /// <summary>
        /// The join every file-selecting query shares: filesystem facts and content metadata are separate
        /// tables joined on content identity, so two copies of the same content share one metadata row instead
        /// of each query varying the shape.
        /// </summary>
        public const string MetadataJoin = "file f LEFT JOIN content_metadata m ON m.content_id = f.content_id";

        /// <summary>
        /// The join <see cref="ParentLookup"/> and <see cref="SiblingLookup"/> share: identical to
        /// <see cref="MetadataJoin"/> except <c>f</c> is pinned to <c>ix_file_identity</c>. Both statements
        /// filter by <c>content_id</c> but also carry <c>ORDER BY f.path</c>, and without the pin SQLite's
        /// planner prefers the path-ordered <c>UNIQUE(storage_id, path)</c> autoindex because it satisfies that
        /// ordering for free — at the cost of a scan proportional to how many of the storage's files precede
        /// the matching row in path order, rather than to how many rows actually share the identity, which is
        /// exactly the collection-size-proportional cost this phase exists to remove.
        /// </summary>
        private const string IdentityMetadataJoin = "file f INDEXED BY ix_file_identity LEFT JOIN content_metadata m ON m.content_id = f.content_id";

        /// <summary>
        /// Inserts or updates a file row and returns its id. <c>is_favorite</c> is deliberately absent from
        /// the update list — it is maintained by the favourite invariant, not supplied by the caller.
        /// </summary>
        public const string FileUpsert = """
            INSERT INTO file (storage_id, directory_id, path, parent_path, name, size, file_type, content_id, is_compatible)
            VALUES ($storage, $directory, $path, $parent, $name, $size, $fileType, $contentId, $isCompatible)
            ON CONFLICT (storage_id, path) DO UPDATE SET
              directory_id  = excluded.directory_id,
              parent_path   = excluded.parent_path,
              name          = excluded.name,
              size          = excluded.size,
              file_type     = excluded.file_type,
              content_id    = excluded.content_id,
              is_compatible = excluded.is_compatible
            RETURNING id;
            """;

        /// <summary>
        /// Inserts or updates a directory's row and returns its id. <c>file.directory_id</c> references this
        /// table with <c>ON DELETE CASCADE</c>, so the conflict branch is a foreign-key parent update; keeping
        /// it here alongside <see cref="FileUpsert"/> is what let the write-cost tests catch that its child
        /// scan needed <c>ix_file_directory</c> to stay a seek.
        /// </summary>
        public const string DirectoryUpsert = """
            INSERT INTO directory (storage_id, path, parent_path, name)
            VALUES ($storage, $path, $parent, $name)
            ON CONFLICT (storage_id, path) DO UPDATE SET parent_path = excluded.parent_path, name = excluded.name
            RETURNING id;
            """;

        /// <summary>Removes a file's row from the file-name search index, addressed by its rowid.</summary>
        public const string FileSearchDelete = "DELETE FROM file_search WHERE rowid = $fileId;";

        /// <summary>
        /// Adds a file's row to the file-name search index. <c>rowid</c> is the <c>file</c> row's own id, so
        /// the row is a seek away from the id every caller already holds; <c>file_id</c> stays alongside it,
        /// unindexed, for <see cref="Search"/> to select back out.
        /// </summary>
        public const string FileSearchInsert = "INSERT INTO file_search (rowid, name, path, file_id) VALUES ($fileId, $name, $path, $fileId);";

        /// <summary>Removes every file-name search row belonging to a storage, ahead of clearing its files.</summary>
        public const string FileSearchDeleteByStorage =
            "DELETE FROM file_search WHERE rowid IN (SELECT id FROM file WHERE storage_id = $storage);";

        /// <summary>The directory listing: every file directly under one parent path.</summary>
        public const string FilesByParent =
            "SELECT " + FileColumns + " FROM " + MetadataJoin + " WHERE f.storage_id = $storage AND f.parent_path = $path ORDER BY f.name;";

        /// <summary>A single file looked up by its exact path, keyed off the storage/path unique constraint.</summary>
        public const string GetFileByPath =
            "SELECT " + FileColumns + " FROM " + MetadataJoin + " WHERE f.storage_id = $storage AND f.path = $path;";

        /// <summary>Removes a content identity's row from the metadata search index, addressed by its rowid.</summary>
        public const string ContentSearchDelete = "DELETE FROM content_search WHERE rowid = $rowId;";

        /// <summary>
        /// Adds a content identity's row to the metadata search index. <c>rowid</c> is the
        /// <c>content_metadata</c> row's own id, handed back by <see cref="ContentMetadataUpsert"/>; <c>content_id</c>
        /// stays alongside it, unindexed, for <see cref="Search"/> to select back out.
        /// </summary>
        public const string ContentSearchInsert =
            "INSERT INTO content_search (rowid, title, creator, description, content_id) VALUES ($rowId, $title, $creator, $description, $contentId);";

        /// <summary>
        /// Inserts or updates a content identity's projected metadata, returning the row's own id so the
        /// caller can address <c>content_search</c> by it rather than by scanning the full-text index for
        /// <c>content_id</c>.
        /// </summary>
        public const string ContentMetadataUpsert = """
            INSERT INTO content_metadata
              (content_id, title, creator, description, play_length, release_info,
               metadata_source, metadata_source_path, share_url, meta1, meta2, source_version)
            VALUES
              ($contentId, $title, $creator, $description, $playLength, $releaseInfo,
               $metadataSource, $metadataSourcePath, $shareUrl, $meta1, $meta2, $sourceVersion)
            ON CONFLICT (content_id) DO UPDATE SET
              title                = excluded.title,
              creator              = excluded.creator,
              description          = excluded.description,
              play_length          = excluded.play_length,
              release_info         = excluded.release_info,
              metadata_source      = excluded.metadata_source,
              metadata_source_path = excluded.metadata_source_path,
              share_url            = excluded.share_url,
              meta1                = excluded.meta1,
              meta2                = excluded.meta2,
              source_version       = excluded.source_version
            RETURNING rowid;
            """;

        /// <summary>
        /// One representative file per content identity whose projected metadata is missing or stale against
        /// the current source version.
        /// </summary>
        public const string StaleIdentities = """
            SELECT rep.content_id, rep.name, rep.path, rep.size, rep.file_type
              FROM (SELECT content_id, MIN(id) AS file_id
                      FROM file
                     WHERE storage_id = $storage
                     GROUP BY content_id) grouped
              JOIN file rep ON rep.id = grouped.file_id
              LEFT JOIN content_metadata m ON m.content_id = rep.content_id
             WHERE m.content_id IS NULL OR m.source_version <> $sourceVersion;
            """;

        /// <summary>
        /// Sets <c>is_favorite</c> on every row sharing a content identity to whether any row for that
        /// identity now sits under a favourite tree.
        /// </summary>
        public static string FavoriteRecompute() => $"""
            UPDATE file SET is_favorite = CASE WHEN EXISTS (
                SELECT 1 FROM file AS favorite
                WHERE favorite.storage_id = $storage
                  AND favorite.content_id = $contentId
                  AND {IndexPathPatterns.FavoritePredicate("favorite.path")})
              THEN 1 ELSE 0 END
            WHERE storage_id = $storage AND content_id = $contentId;
            """;

        /// <summary>Clears <c>is_favorite</c> from identities no longer represented under a favourite tree.</summary>
        public static string FavoriteRepairClear() => $"""
            UPDATE file SET is_favorite = 0
            WHERE storage_id = $storage AND is_favorite = 1 AND content_id NOT IN (
              SELECT content_id FROM file WHERE storage_id = $storage AND {IndexPathPatterns.FavoritePredicate("path")});
            """;

        /// <summary>Sets <c>is_favorite</c> on identities newly represented under a favourite tree.</summary>
        public static string FavoriteRepairSet() => $"""
            UPDATE file SET is_favorite = 1
            WHERE storage_id = $storage AND is_favorite = 0 AND content_id IN (
              SELECT content_id FROM file WHERE storage_id = $storage AND {IndexPathPatterns.FavoritePredicate("path")});
            """;

        /// <summary>The original file for a content identity: the one row not sitting under a linked-copy tree.</summary>
        public static string ParentLookup() => $"""
            SELECT {FileColumns} FROM {IdentityMetadataJoin}
             WHERE f.storage_id = $storage
               AND f.content_id = $contentId
               AND NOT {IndexPathPatterns.LinkedCopyPredicate("f.path")}
             ORDER BY f.path
             LIMIT 1;
            """;

        /// <summary>Every other linked copy of a file's content identity, excluding the file itself.</summary>
        public static string SiblingLookup() => $"""
            SELECT {FileColumns} FROM {IdentityMetadataJoin}
             WHERE f.storage_id = $storage
               AND f.content_id = $contentId
               AND {IndexPathPatterns.LinkedCopyPredicate("f.path")}
               AND f.path <> $ownPath
             ORDER BY f.path;
            """;

        /// <summary>
        /// A full-text search over file names and content metadata, restricted to <paramref name="typeCount"/>
        /// file types and excluding <paramref name="excludeCount"/> path patterns. The type parameters are
        /// named <c>$type0</c>… and the exclude parameters <c>$exclude0</c>…, matching
        /// <see cref="BuildParameterNames"/>.
        /// <para>
        /// The two full-text branches run as a <c>UNION</c> rather than an <c>OR</c>: with no <c>ANALYZE</c>
        /// statistics, SQLite's planner never switches off the shared, unselective <c>ix_file_type</c> scan to
        /// reach <c>ix_file_identity</c> for the <c>content_id</c> branch, even though it exists — an <c>OR</c>
        /// instead materialises both <c>MATCH</c> subqueries and probes them per row that scan visits. Pinning
        /// the <c>content_id</c> branch with <c>INDEXED BY ix_file_identity</c> forces the seek the planner
        /// won't choose on its own; <c>UNION</c> — not <c>UNION ALL</c> — is what keeps a file whose row
        /// satisfies both branches from surfacing twice.
        /// </para>
        /// </summary>
        public static string Search(int typeCount, int excludeCount)
        {
            var filter = SearchFilterPredicate(typeCount, excludeCount);

            return $"""
                SELECT {FileColumns} FROM (
                    SELECT f.id, f.name, f.path, f.size, f.file_type, f.is_favorite, f.is_compatible, f.content_id
                      FROM file f
                     WHERE {filter}
                       AND f.id IN (SELECT file_id FROM file_search WHERE file_search MATCH $match)
                    UNION
                    SELECT f.id, f.name, f.path, f.size, f.file_type, f.is_favorite, f.is_compatible, f.content_id
                      FROM file f INDEXED BY ix_file_identity
                     WHERE {filter}
                       AND f.content_id IN (SELECT content_id FROM content_search WHERE content_search MATCH $match)
                ) f LEFT JOIN content_metadata m ON m.content_id = f.content_id
                 ORDER BY f.name
                 LIMIT $limit;
                """;
        }

        /// <summary>
        /// The storage/type/exclude predicate shared by both <see cref="Search"/> branches, written once so
        /// the <c>id</c> and <c>content_id</c> branches cannot silently filter a different candidate set.
        /// </summary>
        private static string SearchFilterPredicate(int typeCount, int excludeCount)
        {
            var typeParameterNames = BuildParameterNames("$type", typeCount);
            var excludeClause = BuildExcludeClause(excludeCount);

            return $"""
                f.storage_id = $storage
                   AND f.file_type IN ({string.Join(", ", typeParameterNames)})
                   {excludeClause}
                """;
        }

        /// <summary>
        /// The predicate shared by <see cref="RandomCount"/> and <see cref="RandomCandidate"/>, restricted to
        /// <paramref name="typeCount"/> file types and excluding <paramref name="excludeCount"/> path
        /// patterns, written once so the count and the offset it bounds cannot see different candidate sets.
        /// </summary>
        private static string RandomPredicate(StorageScope scope, int typeCount, int excludeCount)
        {
            var typeParameterNames = BuildParameterNames("$type", typeCount);
            var excludeClause = BuildExcludeClause(excludeCount);
            var scopeClause = scope == StorageScope.DirShallow
                ? "f.parent_path = $scopePath"
                : $"f.path LIKE $scopePrefix ESCAPE '{IndexPathPatterns.Like_Escape_Character}'";

            return $"""
                f.storage_id = $storage
                   AND {scopeClause}
                   AND f.file_type IN ({string.Join(", ", typeParameterNames)})
                   {excludeClause}
                """;
        }

        /// <summary>
        /// The table clause <see cref="RandomCount"/> and <see cref="RandomCandidate"/> select from.
        /// <c>DirShallow</c>'s predicate narrows on <c>parent_path</c> equality — selective because it is
        /// scoped to one directory's immediate children, not because of anything <c>ANALYZE</c> statistics
        /// would reveal (production never runs <c>ANALYZE</c>; see <see cref="Search"/>'s own no-<c>ANALYZE</c>
        /// blind spot). Left unpinned, the planner defaults to the shared, unselective <c>ix_file_type</c> for
        /// the common <c>storage_id</c> equality — a scan proportional to every file of that type storage-wide,
        /// exactly the collection-size-proportional cost this phase exists to remove — instead of
        /// <c>ix_file_parent</c>, whose scan is bounded by the requested directory's own children.
        /// <c>Storage</c>/<c>DirDeep</c> scope by a <c>path LIKE</c> prefix instead, which the
        /// <c>UNIQUE(storage_id, path)</c> autoindex already seeks on its own.
        /// </summary>
        private static string RandomTable(StorageScope scope) =>
            scope == StorageScope.DirShallow ? "file f INDEXED BY ix_file_parent" : "file f";

        /// <summary>
        /// The size of the candidate set <see cref="RandomCandidate"/> draws its offset against. No metadata
        /// join and no projection: the join contributes nothing to any predicate, so counting through it
        /// would cost rows this statement never needs to touch.
        /// </summary>
        public static string RandomCount(StorageScope scope, int typeCount, int excludeCount) =>
            $"SELECT COUNT(*) FROM {RandomTable(scope)} WHERE {RandomPredicate(scope, typeCount, excludeCount)};";

        /// <summary>
        /// The id of the candidate sitting at <c>$offset</c> among the rows <see cref="RandomCount"/>
        /// counted — an id, not a row, so the caller seeks the one chosen file by primary key in
        /// <see cref="FileById"/> instead of materialising and sorting the whole candidate set to reach it.
        /// </summary>
        public static string RandomCandidate(StorageScope scope, int typeCount, int excludeCount) =>
            $"SELECT f.id FROM {RandomTable(scope)} WHERE {RandomPredicate(scope, typeCount, excludeCount)} LIMIT 1 OFFSET $offset;";

        /// <summary>A single file, addressed by its primary key, for the fetch that follows a resolved random offset.</summary>
        public const string FileById = $"SELECT {FileColumns} FROM {MetadataJoin} WHERE f.id = $id;";

        /// <summary>Builds <paramref name="count"/> sequential parameter names sharing <paramref name="prefix"/>.</summary>
        public static string[] BuildParameterNames(string prefix, int count) =>
            Enumerable.Range(0, count).Select(index => $"{prefix}{index}").ToArray();

        /// <summary>
        /// Builds the exclude-path predicate for <paramref name="excludeCount"/> patterns, naming its
        /// parameters through <see cref="BuildParameterNames"/> so a caller reconstructs the same names to
        /// bind against.
        /// </summary>
        public static string BuildExcludeClause(int excludeCount)
        {
            var parameterNames = BuildParameterNames("$exclude", excludeCount);

            if (parameterNames.Length == 0)
            {
                return string.Empty;
            }

            var clauses = parameterNames.Select(name => $"f.path NOT LIKE {name} ESCAPE '{IndexPathPatterns.Like_Escape_Character}'");

            return "AND " + string.Join(" AND ", clauses);
        }
    }
}
