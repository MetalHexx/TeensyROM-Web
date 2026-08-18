using System.Globalization;
using Microsoft.Data.Sqlite;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Games;
using TeensyRom.Core.Music;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Storage.Index
{
    /// <inheritdoc cref="IMetadataProjection"/>
    public sealed class MetadataProjection : IMetadataProjection
    {
        /// <summary>Identities processed between progress reports and per write transaction.</summary>
        private const int Batch_Size = 500;

        private static readonly TimeSpan Default_Play_Length = TimeSpan.FromMinutes(3);

        private readonly IIndexDatabase _database;
        private readonly ISidMetadataService _sidMetadata;
        private readonly IGameMetadataService _gameMetadata;
        private readonly IMetadataSourceVersion _sourceVersion;

        public MetadataProjection(IIndexDatabase database, ISidMetadataService sidMetadata,
            IGameMetadataService gameMetadata, IMetadataSourceVersion sourceVersion)
        {
            ArgumentNullException.ThrowIfNull(database);
            ArgumentNullException.ThrowIfNull(sidMetadata);
            ArgumentNullException.ThrowIfNull(gameMetadata);
            ArgumentNullException.ThrowIfNull(sourceVersion);

            _database = database;
            _sidMetadata = sidMetadata;
            _gameMetadata = gameMetadata;
            _sourceVersion = sourceVersion;
        }

        public async Task<int> ProjectAsync(IndexScope scope, IProgress<int>? progress, CancellationToken ct)
        {
            var sourceVersion = _sourceVersion.Current;
            var identities = await LoadStaleIdentitiesAsync(scope, sourceVersion, ct);
            var written = 0;

            foreach (var batch in identities.Chunk(Batch_Size))
            {
                await _database.WriteAsync(async (connection, transaction) =>
                {
                    await using var metadataUpsert = CreateMetadataUpsertCommand(connection, transaction);
                    await using var searchDelete = CreateSearchDeleteCommand(connection, transaction);
                    await using var searchInsert = CreateSearchInsertCommand(connection, transaction);

                    foreach (var identity in batch)
                    {
                        ct.ThrowIfCancellationRequested();

                        var projected = Project(identity);

                        await WriteMetadataRowAsync(metadataUpsert, identity.ContentId, projected, sourceVersion, ct);
                        await RefreshContentSearchRowAsync(searchDelete, searchInsert, identity.ContentId, projected, ct);
                    }

                    return true;
                }, ct);

                written += batch.Length;
                progress?.Report(written);
            }

            return written;
        }

        /// <summary>
        /// Enriches one representative file per identity and reduces the result to what is real: a value the
        /// probe finds indistinguishable from the type's own fallback is dropped rather than stored.
        /// </summary>
        private ProjectedMetadata Project(StaleIdentity identity)
        {
            var enriched = BuildEntity(identity);
            var unenriched = BuildEntity(identity);

            switch (enriched)
            {
                case SongItem song:
                    _sidMetadata.EnrichSong(song);
                    break;
                case GameItem game:
                    _gameMetadata.EnrichGame(game);
                    break;
            }

            return new ProjectedMetadata(
                Title: ProbeOrNull(enriched, unenriched, file => file.Title),
                Creator: ProbeOrNull(enriched, unenriched, file => file.Creator),
                Description: ProbeOrNull(enriched, unenriched, file => file.Description),
                Meta1: ProbeOrNull(enriched, unenriched, file => file.Meta1),
                Meta2: ProbeOrNull(enriched, unenriched, file => file.Meta2),
                ReleaseInfo: NullIfEmpty(enriched.ReleaseInfo),
                MetadataSource: NullIfEmpty(enriched.MetadataSource),
                MetadataSourcePath: enriched.MetadataSourcePath.IsEmpty ? null : enriched.MetadataSourcePath.Value,
                ShareUrl: NullIfEmpty(enriched.ShareUrl),
                PlayLength: ExtractNonDefaultPlayLength(enriched));
        }

        private static FileItem BuildEntity(StaleIdentity identity)
        {
            var entity = IndexRowMapper.CreateBySubtype(identity.FileType);

            entity.Name = identity.Name;
            entity.Path = new FilePath(identity.Path);
            entity.Size = identity.Size;

            return entity;
        }

        private static string? ProbeOrNull(FileItem enriched, FileItem unenriched, Func<FileItem, string> read)
        {
            if (DerivedValueProbe.IsDerived(enriched, unenriched, read))
            {
                return null;
            }

            return NullIfEmpty(read(enriched));
        }

        private static string? NullIfEmpty(string value) => string.IsNullOrWhiteSpace(value) ? null : value;

        private static TimeSpan? ExtractNonDefaultPlayLength(FileItem entity) => entity switch
        {
            SongItem song when song.PlayLength != Default_Play_Length => song.PlayLength,
            GameItem game when game.PlayLength != Default_Play_Length => game.PlayLength,
            _ => null
        };

        private async Task<List<StaleIdentity>> LoadStaleIdentitiesAsync(IndexScope scope, string sourceVersion, CancellationToken ct)
        {
            using var connection = _database.OpenRead();

            var storageId = await ResolveStorageIdForReadAsync(connection, scope, ct);

            if (storageId is null)
            {
                return [];
            }

            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT rep.content_id, rep.name, rep.path, rep.size, rep.file_type
                  FROM (SELECT content_id, MIN(id) AS file_id
                          FROM file
                         WHERE storage_id = $storage
                         GROUP BY content_id) grouped
                  JOIN file rep ON rep.id = grouped.file_id
                  LEFT JOIN content_metadata m ON m.content_id = rep.content_id
                 WHERE m.content_id IS NULL OR m.source_version <> $sourceVersion;
                """;
            command.Parameters.AddWithValue("$storage", storageId.Value);
            command.Parameters.AddWithValue("$sourceVersion", sourceVersion);

            var identities = new List<StaleIdentity>();

            await using var reader = await command.ExecuteReaderAsync(ct);

            while (await reader.ReadAsync(ct))
            {
                identities.Add(new StaleIdentity(
                    reader.GetString(0),
                    reader.GetString(1),
                    reader.GetString(2),
                    reader.GetInt64(3),
                    (TeensyFileType)reader.GetInt32(4)));
            }

            return identities;
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

        private static SqliteCommand CreateMetadataUpsertCommand(SqliteConnection connection, SqliteTransaction transaction)
        {
            var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = """
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
                  source_version       = excluded.source_version;
                """;
            command.Parameters.Add("$contentId", SqliteType.Text);
            command.Parameters.Add("$title", SqliteType.Text);
            command.Parameters.Add("$creator", SqliteType.Text);
            command.Parameters.Add("$description", SqliteType.Text);
            command.Parameters.Add("$playLength", SqliteType.Text);
            command.Parameters.Add("$releaseInfo", SqliteType.Text);
            command.Parameters.Add("$metadataSource", SqliteType.Text);
            command.Parameters.Add("$metadataSourcePath", SqliteType.Text);
            command.Parameters.Add("$shareUrl", SqliteType.Text);
            command.Parameters.Add("$meta1", SqliteType.Text);
            command.Parameters.Add("$meta2", SqliteType.Text);
            command.Parameters.Add("$sourceVersion", SqliteType.Text);
            command.Prepare();

            return command;
        }

        private static async Task WriteMetadataRowAsync(SqliteCommand command, string contentId,
            ProjectedMetadata projected, string sourceVersion, CancellationToken ct)
        {
            command.Parameters["$contentId"].Value = contentId;
            command.Parameters["$title"].Value = (object?)projected.Title ?? DBNull.Value;
            command.Parameters["$creator"].Value = (object?)projected.Creator ?? DBNull.Value;
            command.Parameters["$description"].Value = (object?)projected.Description ?? DBNull.Value;
            command.Parameters["$playLength"].Value = projected.PlayLength is { } playLength
                ? playLength.ToString("c", CultureInfo.InvariantCulture)
                : DBNull.Value;
            command.Parameters["$releaseInfo"].Value = (object?)projected.ReleaseInfo ?? DBNull.Value;
            command.Parameters["$metadataSource"].Value = (object?)projected.MetadataSource ?? DBNull.Value;
            command.Parameters["$metadataSourcePath"].Value = (object?)projected.MetadataSourcePath ?? DBNull.Value;
            command.Parameters["$shareUrl"].Value = (object?)projected.ShareUrl ?? DBNull.Value;
            command.Parameters["$meta1"].Value = (object?)projected.Meta1 ?? DBNull.Value;
            command.Parameters["$meta2"].Value = (object?)projected.Meta2 ?? DBNull.Value;
            command.Parameters["$sourceVersion"].Value = sourceVersion;

            await command.ExecuteNonQueryAsync(ct);
        }

        private static SqliteCommand CreateSearchDeleteCommand(SqliteConnection connection, SqliteTransaction transaction)
        {
            var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "DELETE FROM content_search WHERE content_id = $contentId;";
            command.Parameters.Add("$contentId", SqliteType.Text);
            command.Prepare();

            return command;
        }

        private static SqliteCommand CreateSearchInsertCommand(SqliteConnection connection, SqliteTransaction transaction)
        {
            var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "INSERT INTO content_search (title, creator, description, content_id) VALUES ($title, $creator, $description, $contentId);";
            command.Parameters.Add("$title", SqliteType.Text);
            command.Parameters.Add("$creator", SqliteType.Text);
            command.Parameters.Add("$description", SqliteType.Text);
            command.Parameters.Add("$contentId", SqliteType.Text);
            command.Prepare();

            return command;
        }

        private static async Task RefreshContentSearchRowAsync(SqliteCommand delete, SqliteCommand insert,
            string contentId, ProjectedMetadata projected, CancellationToken ct)
        {
            delete.Parameters["$contentId"].Value = contentId;
            await delete.ExecuteNonQueryAsync(ct);

            insert.Parameters["$title"].Value = projected.Title ?? string.Empty;
            insert.Parameters["$creator"].Value = projected.Creator ?? string.Empty;
            insert.Parameters["$description"].Value = projected.Description ?? string.Empty;
            insert.Parameters["$contentId"].Value = contentId;

            await insert.ExecuteNonQueryAsync(ct);
        }

        private readonly record struct StaleIdentity(string ContentId, string Name, string Path, long Size, TeensyFileType FileType);

        private sealed record ProjectedMetadata(
            string? Title,
            string? Creator,
            string? Description,
            string? Meta1,
            string? Meta2,
            string? ReleaseInfo,
            string? MetadataSource,
            string? MetadataSourcePath,
            string? ShareUrl,
            TimeSpan? PlayLength);
    }
}
