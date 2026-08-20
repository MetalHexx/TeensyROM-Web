using Microsoft.Data.Sqlite;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Storage.Index
{
    /// <inheritdoc cref="IIndexStore"/>
    public sealed partial class SqliteIndexStore
    {
        public async Task<IStorageCacheItem?> GetDirectoryAsync(IndexScope scope, DirectoryPath path, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(path);

            using var connection = _database.OpenRead();
            var storageId = await ResolveStorageIdForReadAsync(connection, scope, ct);

            if (storageId is null || !await DirectoryExistsAsync(connection, storageId.Value, path, ct))
            {
                return null;
            }

            var directories = await ReadChildDirectoriesAsync(connection, storageId.Value, path, ct);
            var files = await ReadFilesByParentAsync(connection, storageId.Value, path, scope, ct);

            return new StorageCacheItem { Path = path, Directories = directories, Files = files };
        }

        public async Task<FileItem?> GetFileByPathAsync(IndexScope scope, FilePath path, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(path);

            using var connection = _database.OpenRead();
            var storageId = await ResolveStorageIdForReadAsync(connection, scope, ct);

            if (storageId is null)
            {
                return null;
            }

            await using var command = connection.CreateCommand();
            command.CommandText = IndexSql.GetFileByPath;
            command.Parameters.AddWithValue("$storage", storageId.Value);
            command.Parameters.AddWithValue("$path", path.Value);
            AddStorageTypeParameter(command, scope);

            await using var reader = await command.ExecuteReaderAsync(ct);

            return await reader.ReadAsync(ct) ? IndexRowMapper.MapFile(reader) : null;
        }

        public async Task<List<FileItem>> GetFilesByNameAsync(IndexScope scope, string name, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(name);

            using var connection = _database.OpenRead();
            var storageId = await ResolveStorageIdForReadAsync(connection, scope, ct);

            if (storageId is null)
            {
                return [];
            }

            await using var command = connection.CreateCommand();
            command.CommandText = $"SELECT {IndexSql.FileColumns} FROM {IndexSql.MetadataJoin} WHERE f.storage_id = $storage AND f.name = $name ORDER BY f.path;";
            command.Parameters.AddWithValue("$storage", storageId.Value);
            command.Parameters.AddWithValue("$name", name);
            AddStorageTypeParameter(command, scope);

            return await ReadFilesAsync(command, ct);
        }

        public async Task<List<LaunchableItem>> SearchAsync(IndexScope scope, string searchText,
            IReadOnlyCollection<DirectoryPath> excludePaths, TeensyFileType[] fileTypes, int limit, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(excludePaths);
            ArgumentNullException.ThrowIfNull(fileTypes);

            var matchExpression = FtsQuery.Build(searchText);

            if (matchExpression is null)
            {
                return [];
            }

            var types = fileTypes.Length == 0 ? TeensyFileTypeExtensions.GetLaunchFileTypes() : fileTypes;

            if (types.Length == 0)
            {
                return [];
            }

            using var connection = _database.OpenRead();
            var storageId = await ResolveStorageIdForReadAsync(connection, scope, ct);

            if (storageId is null)
            {
                return [];
            }

            var typeParameterNames = IndexSql.BuildParameterNames("$type", types.Length);
            var excludeParameterNames = IndexSql.BuildParameterNames("$exclude", excludePaths.Count);

            await using var command = connection.CreateCommand();
            command.CommandText = IndexSql.Search(types.Length, excludePaths.Count);
            command.Parameters.AddWithValue("$storage", storageId.Value);
            command.Parameters.AddWithValue("$match", matchExpression);
            command.Parameters.AddWithValue("$limit", limit);
            AddStorageTypeParameter(command, scope);
            BindTypeParameters(command, typeParameterNames, types);
            BindExcludeParameters(command, excludePaths, excludeParameterNames);

            return await ReadLaunchableFilesAsync(command, ct);
        }

        // Rejection sampling only pays off when a randomly drawn id has a good chance of already satisfying
        // the predicate — see the "Random by scope" reasons in STORAGE-BENCHMARK-RESULTS.md for the measured
        // densities this held at (~99% for the common Storage-scope draw: essentially always the first try)
        // and collapsed at (a single rare file-type filter measured ~64,000 expected attempts; a real narrow
        // DirDeep subtree measured ~430). 32 attempts costs roughly 32 primary-key point lookups if it fails —
        // negligible next to RandomPick's cost for the scope this applies to — while covering everything down
        // to roughly 3% density before falling back.
        private const int Random_Reject_Max_Attempts = 32;

        public async Task<LaunchableItem?> GetRandomFileAsync(IndexScope scope, StorageScope storageScope, DirectoryPath scopePath,
            IReadOnlyCollection<DirectoryPath> excludePaths, TeensyFileType[] fileTypes, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(scopePath);
            ArgumentNullException.ThrowIfNull(excludePaths);
            ArgumentNullException.ThrowIfNull(fileTypes);

            var types = fileTypes.Length == 0 ? TeensyFileTypeExtensions.GetLaunchFileTypes() : fileTypes;

            if (types.Length == 0)
            {
                return null;
            }

            using var connection = _database.OpenRead();
            var storageId = await ResolveStorageIdForReadAsync(connection, scope, ct);

            if (storageId is null)
            {
                return null;
            }

            var typeParameterNames = IndexSql.BuildParameterNames("$type", types.Length);
            var excludeParameterNames = IndexSql.BuildParameterNames("$exclude", excludePaths.Count);

            void BindCandidateParameters(SqliteCommand command)
            {
                command.Parameters.AddWithValue("$storage", storageId.Value);

                if (storageScope == StorageScope.DirShallow)
                {
                    command.Parameters.AddWithValue("$scopePath", scopePath.Value);
                }
                else
                {
                    command.Parameters.AddWithValue("$scopePrefix", IndexPathPatterns.PrefixPattern(scopePath.Value));
                }

                BindTypeParameters(command, typeParameterNames, types);
                BindExcludeParameters(command, excludePaths, excludeParameterNames);
            }

            // Draws a uniform random id from the storage's id range and tests whether it happens to satisfy
            // the scope's predicate, up to Random_Reject_Max_Attempts times. A rejected draw is simply
            // discarded, not attributed to a neighbouring row, so every matching row keeps exactly equal odds
            // regardless of how the matches are distributed across the id range.
            async Task<long?> TryRejectionSampleAsync()
            {
                long lo, hi;

                await using (var boundsCommand = connection.CreateCommand())
                {
                    boundsCommand.CommandText = IndexSql.RandomBounds;
                    boundsCommand.Parameters.AddWithValue("$storage", storageId.Value);

                    await using var reader = await boundsCommand.ExecuteReaderAsync(ct);

                    if (!await reader.ReadAsync(ct) || reader.IsDBNull(0))
                    {
                        return null;
                    }

                    lo = reader.GetInt64(0);
                    await reader.ReadAsync(ct);
                    hi = reader.GetInt64(0);
                }

                var rejectSql = IndexSql.RandomReject(storageScope, types.Length, excludePaths.Count);

                for (var attempt = 0; attempt < Random_Reject_Max_Attempts; attempt++)
                {
                    var candidateId = lo == hi ? lo : Random.Shared.NextInt64(lo, hi + 1);

                    await using var rejectCommand = connection.CreateCommand();
                    rejectCommand.CommandText = rejectSql;
                    rejectCommand.Parameters.AddWithValue("$id", candidateId);
                    BindCandidateParameters(rejectCommand);

                    var hit = await rejectCommand.ExecuteScalarAsync(ct);

                    if (hit is not null and not DBNull)
                    {
                        return candidateId;
                    }
                }

                return null;
            }

            // Every statement here runs inside one deferred read transaction so they share a single snapshot —
            // under WAL that costs the writer nothing, and it closes the race window between choosing a
            // candidate and the final fetch (a delete landing in between). A raw "BEGIN DEFERRED" is used
            // instead of the ADO.NET transaction wrapper because its default isolation level begins immediate,
            // which would take a write-intent lock this read has no business holding.
            await using (var beginCommand = connection.CreateCommand())
            {
                beginCommand.CommandText = "BEGIN DEFERRED;";
                await beginCommand.ExecuteNonQueryAsync(ct);
            }

            try
            {
                // Storage scope's candidate set is, in practice, most of the storage — rejection sampling by
                // primary key stays exactly uniform (a rejected draw is simply discarded, not attributed to a
                // neighbouring row) and costs a handful of point lookups instead of touching every candidate
                // row. DirDeep and DirShallow scope down to a subtree or a single directory, where the
                // candidate set is typically a small fraction of the storage's id range — rejection sampling
                // would mostly exhaust its attempts and fall through anyway, so they go straight to RandomPick.
                var id = storageScope == StorageScope.Storage
                    ? await TryRejectionSampleAsync()
                    : null;

                if (id is null)
                {
                    await using var pickCommand = connection.CreateCommand();
                    pickCommand.CommandText = IndexSql.RandomPick(storageScope, types.Length, excludePaths.Count);
                    BindCandidateParameters(pickCommand);

                    var picked = await pickCommand.ExecuteScalarAsync(ct);
                    id = picked is null or DBNull ? null : Convert.ToInt64(picked);
                }

                if (id is null)
                {
                    await CommitAsync(connection, ct);
                    return null;
                }

                await using var fetchCommand = connection.CreateCommand();
                fetchCommand.CommandText = IndexSql.FileById;
                fetchCommand.Parameters.AddWithValue("$id", id.Value);
                AddStorageTypeParameter(fetchCommand, scope);

                LaunchableItem? result;

                await using (var reader = await fetchCommand.ExecuteReaderAsync(ct))
                {
                    result = await reader.ReadAsync(ct) && IndexRowMapper.MapFile(reader) is LaunchableItem item ? item : null;
                }

                await CommitAsync(connection, ct);
                return result;
            }
            catch
            {
                try
                {
                    await using var rollbackCommand = connection.CreateCommand();
                    rollbackCommand.CommandText = "ROLLBACK;";
                    await rollbackCommand.ExecuteNonQueryAsync(CancellationToken.None);
                }
                catch
                {
                    // A failed ROLLBACK here almost always means the transaction is already gone — most
                    // often because the COMMIT that triggered this catch ended it. Swallowing keeps that
                    // recovery failure from masking the original exception, which is what the caller needs.
                }

                throw;
            }
        }

        public async Task<FileItem?> FindParentFileAsync(IndexScope scope, FileItem file, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(file);

            using var connection = _database.OpenRead();
            var storageId = await ResolveStorageIdForReadAsync(connection, scope, ct);

            if (storageId is null)
            {
                return null;
            }

            await using var command = connection.CreateCommand();
            command.CommandText = IndexSql.ParentLookup();
            command.Parameters.AddWithValue("$storage", storageId.Value);
            command.Parameters.AddWithValue("$contentId", file.Id);
            AddStorageTypeParameter(command, scope);
            IndexPathPatterns.BindLinkedCopyParameters(command);

            await using var reader = await command.ExecuteReaderAsync(ct);

            return await reader.ReadAsync(ct) ? IndexRowMapper.MapFile(reader) : null;
        }

        public async Task<List<FileItem>> FindSiblingsAsync(IndexScope scope, FileItem file, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(file);

            using var connection = _database.OpenRead();
            var storageId = await ResolveStorageIdForReadAsync(connection, scope, ct);

            if (storageId is null)
            {
                return [];
            }

            await using var command = connection.CreateCommand();
            command.CommandText = IndexSql.SiblingLookup();
            command.Parameters.AddWithValue("$storage", storageId.Value);
            command.Parameters.AddWithValue("$contentId", file.Id);
            command.Parameters.AddWithValue("$ownPath", file.Path.Value);
            AddStorageTypeParameter(command, scope);
            IndexPathPatterns.BindLinkedCopyParameters(command);

            return await ReadFilesAsync(command, ct);
        }

        public async Task<List<LaunchableItem>> GetFavoriteFilesAsync(IndexScope scope, CancellationToken ct)
        {
            using var connection = _database.OpenRead();
            var storageId = await ResolveStorageIdForReadAsync(connection, scope, ct);

            if (storageId is null)
            {
                return [];
            }

            await using var command = connection.CreateCommand();
            command.CommandText = $"""
                SELECT {IndexSql.FileColumns} FROM {IndexSql.MetadataJoin}
                 WHERE f.storage_id = $storage AND {IndexPathPatterns.FavoritePredicate("f.path")}
                 ORDER BY f.path;
                """;
            command.Parameters.AddWithValue("$storage", storageId.Value);
            AddStorageTypeParameter(command, scope);
            IndexPathPatterns.BindFavoriteParameters(command);

            return await ReadLaunchableFilesAsync(command, ct);
        }

        public async Task<List<LaunchableItem>> GetPlaylistFilesAsync(IndexScope scope, CancellationToken ct)
        {
            using var connection = _database.OpenRead();
            var storageId = await ResolveStorageIdForReadAsync(connection, scope, ct);

            if (storageId is null)
            {
                return [];
            }

            await using var command = connection.CreateCommand();
            command.CommandText = $"""
                SELECT {IndexSql.FileColumns} FROM {IndexSql.MetadataJoin}
                 WHERE f.storage_id = $storage AND f.path LIKE $playlistPrefix ESCAPE '{IndexPathPatterns.Like_Escape_Character}'
                 ORDER BY f.path;
                """;
            command.Parameters.AddWithValue("$storage", storageId.Value);
            command.Parameters.AddWithValue("$playlistPrefix", IndexPathPatterns.PrefixPattern(StorageHelper.Playlist_Path));
            AddStorageTypeParameter(command, scope);

            return await ReadLaunchableFilesAsync(command, ct);
        }

        public async Task<int> GetFileCountAsync(IndexScope scope, CancellationToken ct)
        {
            using var connection = _database.OpenRead();
            var storageId = await ResolveStorageIdForReadAsync(connection, scope, ct);

            if (storageId is null)
            {
                return 0;
            }

            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT COUNT(*) FROM file WHERE storage_id = $storage;";
            command.Parameters.AddWithValue("$storage", storageId.Value);

            return Convert.ToInt32(await command.ExecuteScalarAsync(ct));
        }

        private static async Task<int?> ResolveStorageIdForReadAsync(SqliteConnection connection, IndexScope scope, CancellationToken ct)
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT id FROM storage WHERE device_id = $device AND storage_type = $storageType;";
            command.Parameters.AddWithValue("$device", scope.DeviceId);
            command.Parameters.AddWithValue("$storageType", (int)scope.StorageType);

            var result = await command.ExecuteScalarAsync(ct);

            return result is null or DBNull ? null : Convert.ToInt32(result);
        }

        private static async Task<bool> DirectoryExistsAsync(SqliteConnection connection, int storageId, DirectoryPath path, CancellationToken ct)
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT 1 FROM directory WHERE storage_id = $storage AND path = $path LIMIT 1;";
            command.Parameters.AddWithValue("$storage", storageId);
            command.Parameters.AddWithValue("$path", path.Value);

            return await command.ExecuteScalarAsync(ct) is not null;
        }

        private static async Task<List<DirectoryItem>> ReadChildDirectoriesAsync(SqliteConnection connection, int storageId, DirectoryPath path, CancellationToken ct)
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT path FROM directory WHERE storage_id = $storage AND parent_path = $path ORDER BY name;";
            command.Parameters.AddWithValue("$storage", storageId);
            command.Parameters.AddWithValue("$path", path.Value);

            var results = new List<DirectoryItem>();
            await using var reader = await command.ExecuteReaderAsync(ct);

            while (await reader.ReadAsync(ct))
            {
                results.Add(IndexRowMapper.MapDirectory(reader));
            }

            return results;
        }

        private static async Task<List<FileItem>> ReadFilesByParentAsync(SqliteConnection connection, int storageId, DirectoryPath path, IndexScope scope, CancellationToken ct)
        {
            await using var command = connection.CreateCommand();
            command.CommandText = IndexSql.FilesByParent;
            command.Parameters.AddWithValue("$storage", storageId);
            command.Parameters.AddWithValue("$path", path.Value);
            AddStorageTypeParameter(command, scope);

            return await ReadFilesAsync(command, ct);
        }

        private static async Task<List<FileItem>> ReadFilesAsync(SqliteCommand command, CancellationToken ct)
        {
            var results = new List<FileItem>();
            await using var reader = await command.ExecuteReaderAsync(ct);

            while (await reader.ReadAsync(ct))
            {
                results.Add(IndexRowMapper.MapFile(reader));
            }

            return results;
        }

        private static async Task<List<LaunchableItem>> ReadLaunchableFilesAsync(SqliteCommand command, CancellationToken ct)
        {
            var results = new List<LaunchableItem>();
            await using var reader = await command.ExecuteReaderAsync(ct);

            while (await reader.ReadAsync(ct))
            {
                if (IndexRowMapper.MapFile(reader) is LaunchableItem item)
                {
                    results.Add(item);
                }
            }

            return results;
        }

        private static async Task CommitAsync(SqliteConnection connection, CancellationToken ct)
        {
            await using var commitCommand = connection.CreateCommand();
            commitCommand.CommandText = "COMMIT;";
            await commitCommand.ExecuteNonQueryAsync(ct);
        }

        private static void AddStorageTypeParameter(SqliteCommand command, IndexScope scope) =>
            command.Parameters.AddWithValue("$storageType", (int)scope.StorageType);

        private static void BindTypeParameters(SqliteCommand command, string[] parameterNames, TeensyFileType[] types)
        {
            for (var index = 0; index < types.Length; index++)
            {
                command.Parameters.AddWithValue(parameterNames[index], (int)types[index]);
            }
        }

        private static void BindExcludeParameters(SqliteCommand command, IReadOnlyCollection<DirectoryPath> excludePaths, string[] parameterNames)
        {
            var index = 0;

            foreach (var excludePath in excludePaths)
            {
                command.Parameters.AddWithValue(parameterNames[index], IndexPathPatterns.ContainsPattern(excludePath.Value));
                index++;
            }
        }
    }
}
