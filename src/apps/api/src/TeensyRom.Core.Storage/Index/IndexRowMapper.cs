using System.Globalization;
using Microsoft.Data.Sqlite;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Storage.Index
{
    /// <summary>
    /// The single seam a raw index row crosses into a domain entity. Every file- and directory-selecting query
    /// in <see cref="SqliteIndexStore"/> goes through here, so the <c>content_metadata</c> join extends one
    /// method instead of every query.
    /// </summary>
    internal static class IndexRowMapper
    {
        /// <summary>
        /// Maps a <c>file</c> row — left-joined to <c>content_metadata</c> — into its subtype, with
        /// <c>Name</c>, <c>Path</c>, <c>Size</c>, <c>StorageType</c>, <c>IsFavorite</c>, <c>IsCompatible</c>,
        /// and every metadata member set from the row. The reader must expose <c>name</c>, <c>path</c>,
        /// <c>size</c>, <c>file_type</c>, <c>is_favorite</c>, <c>is_compatible</c>, <c>storage_type</c>, and
        /// the <c>content_metadata</c> columns; a metadata column that is <see langword="null"/> — the join
        /// found no row — leaves that member at the subtype's own default, derived fallback included.
        /// </summary>
        internal static FileItem MapFile(SqliteDataReader reader)
        {
            var name = reader.GetString(reader.GetOrdinal("name"));
            var path = new FilePath(reader.GetString(reader.GetOrdinal("path")));
            var size = reader.GetInt64(reader.GetOrdinal("size"));
            var fileType = (TeensyFileType)reader.GetInt32(reader.GetOrdinal("file_type"));
            var isFavorite = reader.GetInt32(reader.GetOrdinal("is_favorite")) != 0;
            var isCompatible = reader.GetInt32(reader.GetOrdinal("is_compatible")) != 0;
            var storageType = (TeensyStorageType)reader.GetInt32(reader.GetOrdinal("storage_type"));

            var file = CreateBySubtype(fileType);

            file.Name = name;
            file.Path = path;
            file.Size = size;
            file.StorageType = storageType;
            file.IsFavorite = isFavorite;
            file.IsCompatible = isCompatible;

            MapMetadata(file, reader);

            return file;
        }

        /// <summary>
        /// Maps a <c>directory</c> row. The reader must expose a <c>path</c> column; the entity's <c>Name</c>
        /// is derived from it.
        /// </summary>
        internal static DirectoryItem MapDirectory(SqliteDataReader reader)
        {
            var path = new DirectoryPath(reader.GetString(reader.GetOrdinal("path")));

            return new DirectoryItem(path);
        }

        /// <summary>
        /// Builds the empty entity subtype for <paramref name="fileType"/>, chosen the same way the
        /// application maps a file today. Shared with <see cref="MetadataProjection"/>, which needs the exact
        /// subtype — derived fallbacks included — before any field is set.
        /// </summary>
        internal static FileItem CreateBySubtype(TeensyFileType fileType) => fileType switch
        {
            TeensyFileType.Sid => new SongItem(),
            TeensyFileType.Crt or TeensyFileType.Prg or TeensyFileType.P00 => new GameItem(),
            TeensyFileType.Hex => new HexItem(),
            TeensyFileType.Kla or TeensyFileType.Koa or TeensyFileType.Art or TeensyFileType.Aas
                or TeensyFileType.Hpi or TeensyFileType.Seq or TeensyFileType.Txt => new ImageItem(),
            _ => new FileItem()
        };

        private static void MapMetadata(FileItem file, SqliteDataReader reader)
        {
            var title = ReadNullableString(reader, "title");
            var creator = ReadNullableString(reader, "creator");
            var description = ReadNullableString(reader, "description");
            var meta1 = ReadNullableString(reader, "meta1");
            var meta2 = ReadNullableString(reader, "meta2");
            var releaseInfo = ReadNullableString(reader, "release_info");
            var metadataSource = ReadNullableString(reader, "metadata_source");
            var metadataSourcePath = ReadNullableString(reader, "metadata_source_path");
            var shareUrl = ReadNullableString(reader, "share_url");
            var playLength = ReadNullableString(reader, "play_length");

            if (title is not null) file.Title = title;
            if (creator is not null) file.Creator = creator;
            if (description is not null) file.Description = description;
            if (meta1 is not null) file.Meta1 = meta1;
            if (meta2 is not null) file.Meta2 = meta2;
            if (releaseInfo is not null) file.ReleaseInfo = releaseInfo;
            if (metadataSource is not null) file.MetadataSource = metadataSource;
            if (metadataSourcePath is not null) file.MetadataSourcePath = new FilePath(metadataSourcePath);
            if (shareUrl is not null) file.ShareUrl = shareUrl;

            if (playLength is not null)
            {
                var parsed = TimeSpan.ParseExact(playLength, "c", CultureInfo.InvariantCulture);

                switch (file)
                {
                    case SongItem song: song.PlayLength = parsed; break;
                    case GameItem game: game.PlayLength = parsed; break;
                }
            }
        }

        private static string? ReadNullableString(SqliteDataReader reader, string column)
        {
            var ordinal = reader.GetOrdinal(column);

            return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
        }
    }
}
