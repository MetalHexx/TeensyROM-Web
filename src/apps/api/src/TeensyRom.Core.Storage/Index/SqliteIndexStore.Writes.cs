using Microsoft.Data.Sqlite;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Storage.Index
{
    /// <inheritdoc cref="IIndexStore"/>
    public sealed partial class SqliteIndexStore : IIndexStore
    {
        /// <summary>
        /// Rows per write transaction during a bulk load. An interruption then leaves whole batches behind
        /// rather than nothing at all.
        /// </summary>
        private const int Upsert_Batch_Size = 1000;

        private readonly IIndexDatabase _database;

        public SqliteIndexStore(IIndexDatabase database)
        {
            ArgumentNullException.ThrowIfNull(database);

            _database = database;
        }

        public Task<int> EnsureStorageAsync(IndexScope scope, CancellationToken ct) =>
            _database.WriteAsync((connection, transaction) =>
                ResolveStorageIdAsync(connection, transaction, scope, ct), ct);

        public Task UpsertFileAsync(IndexScope scope, FileItem file, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(file);

            return _database.WriteAsync(async (connection, transaction) =>
            {
                var storageId = await ResolveStorageIdAsync(connection, transaction, scope, ct);
                var directoryId = await EnsureDirectoryChainAsync(connection, transaction, storageId, file.Path.Directory, ct);

                await using var upsert = CreateFileUpsertCommand(connection, transaction);
                await using var searchDelete = CreateSearchDeleteCommand(connection, transaction);
                await using var searchInsert = CreateSearchInsertCommand(connection, transaction);

                var fileId = await UpsertFileRowAsync(upsert, storageId, directoryId, file, ct);
                await RefreshSearchRowAsync(searchDelete, searchInsert, fileId, file, ct);

                // Recomputed unconditionally: the row just written may be either the favourite copy or the
                // original it flags, and the write path cannot assume which was indexed first.
                await using var recompute = CreateFavoriteRecomputeCommand(connection, transaction);
                await RecomputeFavoriteAsync(recompute, storageId, file.Id, ct);

                return true;
            }, ct);
        }

        public async Task UpsertFilesAsync(IndexScope scope, IReadOnlyCollection<FileItem> files, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(files);

            foreach (var batch in files.Chunk(Upsert_Batch_Size))
            {
                await _database.WriteAsync(async (connection, transaction) =>
                {
                    var storageId = await ResolveStorageIdAsync(connection, transaction, scope, ct);
                    var directoryIds = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
                    var contentIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                    await using var upsert = CreateFileUpsertCommand(connection, transaction);
                    await using var searchDelete = CreateSearchDeleteCommand(connection, transaction);
                    await using var searchInsert = CreateSearchInsertCommand(connection, transaction);

                    foreach (var file in batch)
                    {
                        var parent = file.Path.Directory;

                        if (!directoryIds.TryGetValue(parent.Value, out var directoryId))
                        {
                            directoryId = await EnsureDirectoryChainAsync(connection, transaction, storageId, parent, ct);
                            directoryIds[parent.Value] = directoryId;
                        }

                        var fileId = await UpsertFileRowAsync(upsert, storageId, directoryId, file, ct);
                        await RefreshSearchRowAsync(searchDelete, searchInsert, fileId, file, ct);

                        contentIds.Add(file.Id);
                    }

                    // Recomputed for every content identity written, not just the ones under a favourite
                    // path: a favourite copy indexed before its original must still flag that original.
                    await RecomputeFavoritesAsync(connection, transaction, storageId, contentIds, ct);

                    return true;
                }, ct);
            }
        }

        public Task UpsertDirectoryAsync(IndexScope scope, DirectoryPath path, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(path);

            return _database.WriteAsync(async (connection, transaction) =>
            {
                var storageId = await ResolveStorageIdAsync(connection, transaction, scope, ct);
                return await EnsureDirectoryChainAsync(connection, transaction, storageId, path, ct);
            }, ct);
        }

        public Task EnsureParentsAsync(IndexScope scope, DirectoryPath path, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(path);

            return _database.WriteAsync(async (connection, transaction) =>
            {
                var parent = path.IsRoot ? null : path.ParentPath;

                if (parent is null)
                {
                    return 0L;
                }

                var storageId = await ResolveStorageIdAsync(connection, transaction, scope, ct);
                return await EnsureDirectoryChainAsync(connection, transaction, storageId, parent, ct);
            }, ct);
        }

        public Task DeleteFileAsync(IndexScope scope, FilePath path, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(path);

            return _database.WriteAsync(async (connection, transaction) =>
            {
                var storageId = await ResolveStorageIdAsync(connection, transaction, scope, ct);

                var doomed = await ReadFileRowsAsync(
                    connection,
                    transaction,
                    "SELECT id, path, content_id FROM file WHERE storage_id = $storage AND path = $path;",
                    command => command.Parameters.AddWithValue("$path", path.Value),
                    storageId,
                    ct);

                if (doomed.Count == 0)
                {
                    return false;
                }

                await ExecuteAsync(
                    connection,
                    transaction,
                    "DELETE FROM file WHERE storage_id = $storage AND path = $path;",
                    command => command.Parameters.AddWithValue("$path", path.Value),
                    storageId,
                    ct);

                await using var searchDelete = CreateSearchDeleteCommand(connection, transaction);

                foreach (var row in doomed)
                {
                    await DeleteSearchRowAsync(searchDelete, row.Id, ct);
                }

                await RecomputeFavoritesAsync(connection, transaction, storageId, FavoriteContentIds(doomed), ct);

                return true;
            }, ct);
        }

        public Task DeleteDirectoryAsync(IndexScope scope, DirectoryPath path, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(path);

            return _database.WriteAsync(async (connection, transaction) =>
            {
                var storageId = await ResolveStorageIdAsync(connection, transaction, scope, ct);

                var doomed = await ReadFileRowsAsync(
                    connection,
                    transaction,
                    "SELECT id, path, content_id FROM file WHERE storage_id = $storage AND parent_path = $path;",
                    command => command.Parameters.AddWithValue("$path", path.Value),
                    storageId,
                    ct);

                // The file rows go with the directory row through ON DELETE CASCADE; the search rows do not.
                await using (var searchDelete = CreateSearchDeleteCommand(connection, transaction))
                {
                    foreach (var row in doomed)
                    {
                        await DeleteSearchRowAsync(searchDelete, row.Id, ct);
                    }
                }

                await ExecuteAsync(
                    connection,
                    transaction,
                    "DELETE FROM directory WHERE storage_id = $storage AND path = $path;",
                    command => command.Parameters.AddWithValue("$path", path.Value),
                    storageId,
                    ct);

                await RecomputeFavoritesAsync(connection, transaction, storageId, FavoriteContentIds(doomed), ct);

                return true;
            }, ct);
        }

        public Task DeleteDirectoryWithChildrenAsync(IndexScope scope, DirectoryPath path, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(path);

            var prefix = IndexPathPatterns.PrefixPattern(path.Value);

            return _database.WriteAsync(async (connection, transaction) =>
            {
                var storageId = await ResolveStorageIdAsync(connection, transaction, scope, ct);

                var doomed = await ReadFileRowsAsync(
                    connection,
                    transaction,
                    $"""
                     SELECT id, path, content_id FROM file
                     WHERE storage_id = $storage AND path LIKE $prefix ESCAPE '{IndexPathPatterns.Like_Escape_Character}';
                     """,
                    command => command.Parameters.AddWithValue("$prefix", prefix),
                    storageId,
                    ct);

                await using (var searchDelete = CreateSearchDeleteCommand(connection, transaction))
                {
                    foreach (var row in doomed)
                    {
                        await DeleteSearchRowAsync(searchDelete, row.Id, ct);
                    }
                }

                await ExecuteAsync(
                    connection,
                    transaction,
                    $"""
                     DELETE FROM file
                     WHERE storage_id = $storage AND path LIKE $prefix ESCAPE '{IndexPathPatterns.Like_Escape_Character}';
                     """,
                    command => command.Parameters.AddWithValue("$prefix", prefix),
                    storageId,
                    ct);

                await ExecuteAsync(
                    connection,
                    transaction,
                    $"""
                     DELETE FROM directory
                     WHERE storage_id = $storage AND path LIKE $prefix ESCAPE '{IndexPathPatterns.Like_Escape_Character}';
                     """,
                    command => command.Parameters.AddWithValue("$prefix", prefix),
                    storageId,
                    ct);

                await RecomputeFavoritesAsync(connection, transaction, storageId, FavoriteContentIds(doomed), ct);

                return true;
            }, ct);
        }

        public Task ClearAsync(IndexScope scope, CancellationToken ct) =>
            _database.WriteAsync(async (connection, transaction) =>
            {
                var storageId = await ResolveStorageIdAsync(connection, transaction, scope, ct);

                await ExecuteAsync(
                    connection,
                    transaction,
                    IndexSql.FileSearchDeleteByStorage,
                    null,
                    storageId,
                    ct);

                await ExecuteAsync(connection, transaction, "DELETE FROM file WHERE storage_id = $storage;", null, storageId, ct);
                await ExecuteAsync(connection, transaction, "DELETE FROM directory WHERE storage_id = $storage;", null, storageId, ct);

                return true;
            }, ct);

        public Task<int> RepairFavoritesAsync(IndexScope scope, CancellationToken ct) =>
            _database.WriteAsync(async (connection, transaction) =>
            {
                var storageId = await ResolveStorageIdAsync(connection, transaction, scope, ct);

                var cleared = await ExecuteFavoriteRepairAsync(connection, transaction, storageId, IndexSql.FavoriteRepairClear(), ct);
                var set = await ExecuteFavoriteRepairAsync(connection, transaction, storageId, IndexSql.FavoriteRepairSet(), ct);

                return cleared + set;
            }, ct);

        private static async Task<int> ResolveStorageIdAsync(SqliteConnection connection, SqliteTransaction transaction, IndexScope scope, CancellationToken ct)
        {
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = """
                INSERT INTO storage (device_id, storage_type) VALUES ($device, $storageType)
                ON CONFLICT (device_id, storage_type) DO UPDATE SET device_id = excluded.device_id
                RETURNING id;
                """;
            command.Parameters.AddWithValue("$device", scope.DeviceId);
            command.Parameters.AddWithValue("$storageType", (int)scope.StorageType);

            return Convert.ToInt32(await command.ExecuteScalarAsync(ct));
        }

        /// <summary>
        /// Inserts <paramref name="path"/> and every missing ancestor up to the root, and returns the id of
        /// <paramref name="path"/> itself.
        /// </summary>
        private static async Task<long> EnsureDirectoryChainAsync(SqliteConnection connection, SqliteTransaction transaction, int storageId, DirectoryPath path, CancellationToken ct)
        {
            var chain = new List<DirectoryPath>();
            DirectoryPath? current = path;

            while (current is not null)
            {
                chain.Add(current);
                current = current.IsRoot ? null : current.ParentPath;
            }

            chain.Reverse();

            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = """
                INSERT INTO directory (storage_id, path, parent_path, name)
                VALUES ($storage, $path, $parent, $name)
                ON CONFLICT (storage_id, path) DO UPDATE SET parent_path = excluded.parent_path, name = excluded.name
                RETURNING id;
                """;
            command.Parameters.Add("$storage", SqliteType.Integer);
            command.Parameters.Add("$path", SqliteType.Text);
            command.Parameters.Add("$parent", SqliteType.Text);
            command.Parameters.Add("$name", SqliteType.Text);
            command.Prepare();

            var directoryId = 0L;

            foreach (var directory in chain)
            {
                command.Parameters["$storage"].Value = storageId;
                command.Parameters["$path"].Value = directory.Value;
                command.Parameters["$parent"].Value = directory.IsRoot ? DBNull.Value : directory.ParentPath?.Value ?? (object)DBNull.Value;
                command.Parameters["$name"].Value = directory.DirectoryName;

                directoryId = Convert.ToInt64(await command.ExecuteScalarAsync(ct));
            }

            return directoryId;
        }

        private static SqliteCommand CreateFileUpsertCommand(SqliteConnection connection, SqliteTransaction transaction)
        {
            var command = connection.CreateCommand();
            command.Transaction = transaction;

            command.CommandText = IndexSql.FileUpsert;
            command.Parameters.Add("$storage", SqliteType.Integer);
            command.Parameters.Add("$directory", SqliteType.Integer);
            command.Parameters.Add("$path", SqliteType.Text);
            command.Parameters.Add("$parent", SqliteType.Text);
            command.Parameters.Add("$name", SqliteType.Text);
            command.Parameters.Add("$size", SqliteType.Integer);
            command.Parameters.Add("$fileType", SqliteType.Integer);
            command.Parameters.Add("$contentId", SqliteType.Text);
            command.Parameters.Add("$isCompatible", SqliteType.Integer);
            command.Prepare();

            return command;
        }

        private static async Task<long> UpsertFileRowAsync(SqliteCommand command, int storageId, long directoryId, FileItem file, CancellationToken ct)
        {
            command.Parameters["$storage"].Value = storageId;
            command.Parameters["$directory"].Value = directoryId;
            command.Parameters["$path"].Value = file.Path.Value;
            command.Parameters["$parent"].Value = file.Path.Directory.Value;
            command.Parameters["$name"].Value = file.Name;
            command.Parameters["$size"].Value = file.Size;
            command.Parameters["$fileType"].Value = (int)file.FileType;
            command.Parameters["$contentId"].Value = file.Id;
            command.Parameters["$isCompatible"].Value = file.IsCompatible ? 1 : 0;

            return Convert.ToInt64(await command.ExecuteScalarAsync(ct));
        }

        private static SqliteCommand CreateSearchDeleteCommand(SqliteConnection connection, SqliteTransaction transaction)
        {
            var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = IndexSql.FileSearchDelete;
            command.Parameters.Add("$fileId", SqliteType.Integer);
            command.Prepare();

            return command;
        }

        private static SqliteCommand CreateSearchInsertCommand(SqliteConnection connection, SqliteTransaction transaction)
        {
            var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = IndexSql.FileSearchInsert;
            command.Parameters.Add("$name", SqliteType.Text);
            command.Parameters.Add("$path", SqliteType.Text);
            command.Parameters.Add("$fileId", SqliteType.Integer);
            command.Prepare();

            return command;
        }

        private static async Task RefreshSearchRowAsync(SqliteCommand delete, SqliteCommand insert, long fileId, FileItem file, CancellationToken ct)
        {
            await DeleteSearchRowAsync(delete, fileId, ct);

            insert.Parameters["$name"].Value = file.Name;
            insert.Parameters["$path"].Value = file.Path.Value;
            insert.Parameters["$fileId"].Value = fileId;

            await insert.ExecuteNonQueryAsync(ct);
        }

        private static async Task DeleteSearchRowAsync(SqliteCommand delete, long fileId, CancellationToken ct)
        {
            delete.Parameters["$fileId"].Value = fileId;

            await delete.ExecuteNonQueryAsync(ct);
        }

        private static SqliteCommand CreateFavoriteRecomputeCommand(SqliteConnection connection, SqliteTransaction transaction)
        {
            var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = IndexSql.FavoriteRecompute();
            command.Parameters.Add("$storage", SqliteType.Integer);
            command.Parameters.Add("$contentId", SqliteType.Text);
            IndexPathPatterns.BindFavoriteParameters(command);
            command.Prepare();

            return command;
        }

        private static async Task RecomputeFavoriteAsync(SqliteCommand command, int storageId, string contentId, CancellationToken ct)
        {
            command.Parameters["$storage"].Value = storageId;
            command.Parameters["$contentId"].Value = contentId;

            await command.ExecuteNonQueryAsync(ct);
        }

        private static async Task RecomputeFavoritesAsync(SqliteConnection connection, SqliteTransaction transaction, int storageId, IReadOnlyCollection<string> contentIds, CancellationToken ct)
        {
            if (contentIds.Count == 0)
            {
                return;
            }

            await using var command = CreateFavoriteRecomputeCommand(connection, transaction);

            foreach (var contentId in contentIds)
            {
                await RecomputeFavoriteAsync(command, storageId, contentId, ct);
            }
        }

        private static async Task<int> ExecuteFavoriteRepairAsync(SqliteConnection connection, SqliteTransaction transaction, int storageId, string sql, CancellationToken ct)
        {
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = sql;
            command.Parameters.AddWithValue("$storage", storageId);
            IndexPathPatterns.BindFavoriteParameters(command);

            return await command.ExecuteNonQueryAsync(ct);
        }

        private static IReadOnlyCollection<string> FavoriteContentIds(IReadOnlyCollection<FileRow> rows)
        {
            var contentIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var row in rows)
            {
                if (IndexPathPatterns.IsFavoritePath(row.Path))
                {
                    contentIds.Add(row.ContentId);
                }
            }

            return contentIds;
        }

        private static async Task<IReadOnlyCollection<FileRow>> ReadFileRowsAsync(
            SqliteConnection connection,
            SqliteTransaction transaction,
            string sql,
            Action<SqliteCommand>? bind,
            int storageId,
            CancellationToken ct)
        {
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = sql;
            command.Parameters.AddWithValue("$storage", storageId);
            bind?.Invoke(command);

            var rows = new List<FileRow>();

            await using var reader = await command.ExecuteReaderAsync(ct);

            while (await reader.ReadAsync(ct))
            {
                rows.Add(new FileRow(reader.GetInt64(0), reader.GetString(1), reader.GetString(2)));
            }

            return rows;
        }

        private static async Task ExecuteAsync(
            SqliteConnection connection,
            SqliteTransaction transaction,
            string sql,
            Action<SqliteCommand>? bind,
            int storageId,
            CancellationToken ct)
        {
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = sql;
            command.Parameters.AddWithValue("$storage", storageId);
            bind?.Invoke(command);

            await command.ExecuteNonQueryAsync(ct);
        }

        private readonly record struct FileRow(long Id, string Path, string ContentId);
    }
}
