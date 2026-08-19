namespace TeensyRom.Core.Storage.Index
{
    /// <summary>
    /// The index database schema. Flatness is the performance requirement expressed as a schema: an indexed
    /// parent path makes a directory listing a seek, and an indexed path makes a subtree query a range scan.
    /// <para>
    /// <c>COLLATE NOCASE</c> on every path, name, and identity column is load-bearing — the rest of the system
    /// compares paths with <c>OrdinalIgnoreCase</c>, while SQLite's <c>=</c> is case sensitive by default.
    /// </para>
    /// </summary>
    public static class IndexSchema
    {
        public const string Ddl = """
            CREATE TABLE IF NOT EXISTS storage (
              id                 INTEGER PRIMARY KEY AUTOINCREMENT,
              device_id          TEXT    NOT NULL COLLATE NOCASE,
              storage_type       INTEGER NOT NULL,
              last_full_index_at INTEGER NULL,
              UNIQUE (device_id, storage_type));

            CREATE TABLE IF NOT EXISTS directory (
              id          INTEGER PRIMARY KEY AUTOINCREMENT,
              storage_id  INTEGER NOT NULL REFERENCES storage(id) ON DELETE CASCADE,
              path        TEXT    NOT NULL COLLATE NOCASE,
              parent_path TEXT    NULL     COLLATE NOCASE,
              name        TEXT    NOT NULL COLLATE NOCASE,
              indexed_at  INTEGER NULL,
              UNIQUE (storage_id, path));
            CREATE INDEX IF NOT EXISTS ix_directory_parent ON directory (storage_id, parent_path);

            CREATE TABLE IF NOT EXISTS file (
              id            INTEGER PRIMARY KEY AUTOINCREMENT,
              storage_id    INTEGER NOT NULL REFERENCES storage(id)   ON DELETE CASCADE,
              directory_id  INTEGER NOT NULL REFERENCES directory(id) ON DELETE CASCADE,
              path          TEXT    NOT NULL COLLATE NOCASE,
              parent_path   TEXT    NOT NULL COLLATE NOCASE,
              name          TEXT    NOT NULL COLLATE NOCASE,
              size          INTEGER NOT NULL,
              file_type     INTEGER NOT NULL,
              content_id    TEXT    NOT NULL COLLATE NOCASE,
              is_favorite   INTEGER NOT NULL DEFAULT 0,
              is_compatible INTEGER NOT NULL DEFAULT 1,
              UNIQUE (storage_id, path));
            CREATE INDEX IF NOT EXISTS ix_file_parent    ON file (storage_id, parent_path);
            CREATE INDEX IF NOT EXISTS ix_file_identity  ON file (storage_id, content_id);
            CREATE INDEX IF NOT EXISTS ix_file_type      ON file (storage_id, file_type);
            -- Not a query index: directory's upsert is a foreign-key parent update, and without this SQLite
            -- must scan every file row to check for children referencing the directory being written.
            CREATE INDEX IF NOT EXISTS ix_file_directory ON file (directory_id);

            CREATE TABLE IF NOT EXISTS content_metadata (
              content_id           TEXT PRIMARY KEY COLLATE NOCASE,
              title                TEXT NULL,
              creator              TEXT NULL,
              description          TEXT NULL,
              play_length          TEXT NULL,
              release_info         TEXT NULL,
              metadata_source      TEXT NULL,
              metadata_source_path TEXT NULL,
              share_url            TEXT NULL,
              meta1                TEXT NULL,
              meta2                TEXT NULL,
              source_version       TEXT NOT NULL);

            CREATE VIRTUAL TABLE IF NOT EXISTS file_search
              USING fts5(name, path, file_id UNINDEXED, tokenize = 'unicode61');
            CREATE VIRTUAL TABLE IF NOT EXISTS content_search
              USING fts5(title, creator, description, content_id UNINDEXED, tokenize = 'unicode61');
            """;
    }
}
