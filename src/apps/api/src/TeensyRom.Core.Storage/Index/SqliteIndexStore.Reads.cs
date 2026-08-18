using Microsoft.Data.Sqlite;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Storage.Index
{
    /// <inheritdoc cref="IIndexStore"/>
    public sealed partial class SqliteIndexStore
    {
        /// <summary>
        /// The column list every file-selecting query shares, closed by a projection of the scope's storage
        /// type so <see cref="IndexRowMapper.MapFile"/> can read it off the row like every other field — the
        /// column itself does not exist on <c>file</c> because a scope is already exactly one storage type.
        /// </summary>
        private const string FileColumns = "name, path, size, file_type, is_favorite, is_compatible, $storageType AS storage_type";

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
            command.CommandText = $"SELECT {FileColumns} FROM file WHERE storage_id = $storage AND path = $path;";
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
            command.CommandText = $"SELECT {FileColumns} FROM file WHERE storage_id = $storage AND name = $name ORDER BY path;";
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

            var typeParameterNames = BuildParameterNames("$type", types.Length);
            var excludeClause = BuildExcludeClause(excludePaths, out var excludeParameterNames);

            await using var command = connection.CreateCommand();
            command.CommandText = $"""
                SELECT {FileColumns}
                  FROM file
                 WHERE storage_id = $storage
                   AND file_type IN ({string.Join(", ", typeParameterNames)})
                   {excludeClause}
                   AND ( id         IN (SELECT file_id    FROM file_search    WHERE file_search    MATCH $match)
                      OR content_id IN (SELECT content_id FROM content_search WHERE content_search MATCH $match) )
                 ORDER BY name
                 LIMIT $limit;
                """;
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

            var typeParameterNames = BuildParameterNames("$type", types.Length);
            var excludeClause = BuildExcludeClause(excludePaths, out var excludeParameterNames);
            var scopeClause = storageScope == StorageScope.DirShallow
                ? "parent_path = $scopePath"
                : $"path LIKE $scopePrefix ESCAPE '{IndexPathPatterns.Like_Escape_Character}'";

            await using var command = connection.CreateCommand();
            command.CommandText = $"""
                SELECT {FileColumns}
                  FROM file
                 WHERE storage_id = $storage
                   AND {scopeClause}
                   AND file_type IN ({string.Join(", ", typeParameterNames)})
                   {excludeClause}
                 ORDER BY RANDOM()
                 LIMIT 1;
                """;
            command.Parameters.AddWithValue("$storage", storageId.Value);
            AddStorageTypeParameter(command, scope);

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

            await using var reader = await command.ExecuteReaderAsync(ct);

            return await reader.ReadAsync(ct) && IndexRowMapper.MapFile(reader) is LaunchableItem item ? item : null;
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
            command.CommandText = $"""
                SELECT {FileColumns} FROM file
                 WHERE storage_id = $storage
                   AND content_id = $contentId
                   AND NOT {IndexPathPatterns.LinkedCopyPredicate("path")}
                 ORDER BY path
                 LIMIT 1;
                """;
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
            command.CommandText = $"""
                SELECT {FileColumns} FROM file
                 WHERE storage_id = $storage
                   AND content_id = $contentId
                   AND {IndexPathPatterns.LinkedCopyPredicate("path")}
                   AND path <> $ownPath
                 ORDER BY path;
                """;
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
                SELECT {FileColumns} FROM file
                 WHERE storage_id = $storage AND {IndexPathPatterns.FavoritePredicate("path")}
                 ORDER BY path;
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
                SELECT {FileColumns} FROM file
                 WHERE storage_id = $storage AND path LIKE $playlistPrefix ESCAPE '{IndexPathPatterns.Like_Escape_Character}'
                 ORDER BY path;
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
            command.CommandText = $"SELECT {FileColumns} FROM file WHERE storage_id = $storage AND parent_path = $path ORDER BY name;";
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

        private static void AddStorageTypeParameter(SqliteCommand command, IndexScope scope) =>
            command.Parameters.AddWithValue("$storageType", (int)scope.StorageType);

        private static string[] BuildParameterNames(string prefix, int count) =>
            Enumerable.Range(0, count).Select(index => $"{prefix}{index}").ToArray();

        private static void BindTypeParameters(SqliteCommand command, string[] parameterNames, TeensyFileType[] types)
        {
            for (var index = 0; index < types.Length; index++)
            {
                command.Parameters.AddWithValue(parameterNames[index], (int)types[index]);
            }
        }

        /// <summary>
        /// Builds the exclude-path predicate: a file is excluded when its path contains any of
        /// <paramref name="excludePaths"/> anywhere, mirroring today's in-memory filter.
        /// </summary>
        private static string BuildExcludeClause(IReadOnlyCollection<DirectoryPath> excludePaths, out string[] parameterNames)
        {
            parameterNames = BuildParameterNames("$exclude", excludePaths.Count);

            if (parameterNames.Length == 0)
            {
                return string.Empty;
            }

            var clauses = parameterNames.Select(name => $"path NOT LIKE {name} ESCAPE '{IndexPathPatterns.Like_Escape_Character}'");

            return "AND " + string.Join(" AND ", clauses);
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
