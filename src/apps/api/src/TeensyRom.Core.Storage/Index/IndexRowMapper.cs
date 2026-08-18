using Microsoft.Data.Sqlite;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Storage.Index
{
    /// <summary>
    /// The single seam a raw index row crosses into a domain entity. Every file- and directory-selecting query
    /// in <see cref="SqliteIndexStore"/> goes through here, so a future metadata join extends one method
    /// instead of every query.
    /// </summary>
    internal static class IndexRowMapper
    {
        /// <summary>
        /// Maps a <c>file</c> row into its subtype — chosen from <c>file_type</c>, mirroring how the
        /// application maps a file today — with <c>Name</c>, <c>Path</c>, <c>Size</c>, <c>StorageType</c>,
        /// <c>IsFavorite</c>, and <c>IsCompatible</c> set from the row. The reader must expose <c>name</c>,
        /// <c>path</c>, <c>size</c>, <c>file_type</c>, <c>is_favorite</c>, <c>is_compatible</c>, and
        /// <c>storage_type</c> columns.
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

            FileItem file = fileType switch
            {
                TeensyFileType.Sid => new SongItem(),
                TeensyFileType.Crt or TeensyFileType.Prg or TeensyFileType.P00 => new GameItem(),
                TeensyFileType.Hex => new HexItem(),
                TeensyFileType.Kla or TeensyFileType.Koa or TeensyFileType.Art or TeensyFileType.Aas
                    or TeensyFileType.Hpi or TeensyFileType.Seq or TeensyFileType.Txt => new ImageItem(),
                _ => new FileItem()
            };

            file.Name = name;
            file.Path = path;
            file.Size = size;
            file.StorageType = storageType;
            file.IsFavorite = isFavorite;
            file.IsCompatible = isCompatible;

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
    }
}
