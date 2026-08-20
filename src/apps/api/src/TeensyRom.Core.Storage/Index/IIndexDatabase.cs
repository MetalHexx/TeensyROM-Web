using Microsoft.Data.Sqlite;

namespace TeensyRom.Core.Storage.Index
{
    /// <summary>
    /// Owns the index database file: connection creation, one-time schema bootstrap, and the single-writer
    /// gate. Readers run concurrently under write-ahead logging while writes are serialised.
    /// </summary>
    public interface IIndexDatabase
    {
        /// <summary>
        /// Opens a connection for reading. The caller owns the connection and must dispose it.
        /// </summary>
        SqliteConnection OpenRead();

        /// <summary>
        /// Runs <paramref name="work"/> as the sole writer, inside an explicit transaction that is committed
        /// before this method returns. An interrupted write leaves the previous state, never a partial one.
        /// </summary>
        Task<T> WriteAsync<T>(Func<SqliteConnection, SqliteTransaction, Task<T>> work, CancellationToken ct);

        /// <summary>
        /// Creates the database file, its containing directory, and the schema if they do not exist, and
        /// switches the file to write-ahead logging. Safe to call repeatedly.
        /// </summary>
        Task EnsureCreatedAsync(CancellationToken ct);
    }
}
