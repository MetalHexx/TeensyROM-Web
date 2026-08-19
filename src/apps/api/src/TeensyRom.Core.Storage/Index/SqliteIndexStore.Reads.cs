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

            // Three statements sharing one predicate replace a single "ORDER BY RANDOM() LIMIT 1": a count,
            // a C#-side offset into it, and a primary-key seek for the row that offset lands on. All three
            // run inside one deferred read transaction so they share a single snapshot — under WAL that costs
            // the writer nothing, and it closes the two race windows three statements opened where one
            // didn't: a delete between the count and the offset seek, and a delete between the offset seek
            // and the final fetch. A raw "BEGIN DEFERRED" is used instead of the ADO.NET transaction wrapper
            // because its default isolation level begins immediate, which would take a write-intent lock this
            // read has no business holding.
            await using (var beginCommand = connection.CreateCommand())
            {
                beginCommand.CommandText = "BEGIN DEFERRED;";
                await beginCommand.ExecuteNonQueryAsync(ct);
            }

            try
            {
                await using var countCommand = connection.CreateCommand();
                countCommand.CommandText = IndexSql.RandomCount(storageScope, types.Length, excludePaths.Count);
                BindCandidateParameters(countCommand);

                var count = Convert.ToInt32(await countCommand.ExecuteScalarAsync(ct));

                if (count == 0)
                {
                    await CommitAsync(connection, ct);
                    return null;
                }

                var offset = Random.Shared.Next(count);

                await using var offsetCommand = connection.CreateCommand();
                offsetCommand.CommandText = IndexSql.RandomCandidate(storageScope, types.Length, excludePaths.Count);
                BindCandidateParameters(offsetCommand);
                offsetCommand.Parameters.AddWithValue("$offset", offset);

                var id = await offsetCommand.ExecuteScalarAsync(ct);

                if (id is null or DBNull)
                {
                    await CommitAsync(connection, ct);
                    return null;
                }

                await using var fetchCommand = connection.CreateCommand();
                fetchCommand.CommandText = IndexSql.FileById;
                fetchCommand.Parameters.AddWithValue("$id", id);
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
