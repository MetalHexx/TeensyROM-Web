using Microsoft.Data.Sqlite;

namespace TeensyRom.Core.Storage.Index
{
    /// <inheritdoc cref="IIndexDatabase"/>
    public sealed class IndexDatabase : IIndexDatabase, IDisposable
    {
        private const string ConnectionPragmas = """
            PRAGMA foreign_keys=ON;
            PRAGMA busy_timeout=5000;
            PRAGMA synchronous=NORMAL;
            """;

        private readonly SemaphoreSlim _writeGate = new(1, 1);
        private readonly string _databasePath;
        private readonly string _connectionString;
        private bool _created;

        public IndexDatabase() : this(IndexPaths.ResolveDatabasePath()) { }

        public IndexDatabase(string databasePath)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(databasePath);

            _databasePath = databasePath;
            _connectionString = new SqliteConnectionStringBuilder
            {
                DataSource = databasePath,
                Mode = SqliteOpenMode.ReadWriteCreate
            }.ToString();
        }

        public SqliteConnection OpenRead()
        {
            var connection = new SqliteConnection(_connectionString);

            try
            {
                connection.Open();
                Execute(connection, null, ConnectionPragmas);
                return connection;
            }
            catch
            {
                connection.Dispose();
                throw;
            }
        }

        public async Task<T> WriteAsync<T>(Func<SqliteConnection, SqliteTransaction, Task<T>> work, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(work);

            await _writeGate.WaitAsync(ct).ConfigureAwait(false);

            try
            {
                await using var connection = new SqliteConnection(_connectionString);
                await connection.OpenAsync(ct).ConfigureAwait(false);
                await ExecuteAsync(connection, null, ConnectionPragmas, ct).ConfigureAwait(false);

                await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(ct).ConfigureAwait(false);

                var result = await work(connection, transaction).ConfigureAwait(false);

                await transaction.CommitAsync(ct).ConfigureAwait(false);

                return result;
            }
            finally
            {
                _writeGate.Release();
            }
        }

        public async Task EnsureCreatedAsync(CancellationToken ct)
        {
            await _writeGate.WaitAsync(ct).ConfigureAwait(false);

            try
            {
                if (_created)
                {
                    return;
                }

                var directory = Path.GetDirectoryName(_databasePath);

                if (!string.IsNullOrEmpty(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                await using var connection = new SqliteConnection(_connectionString);
                await connection.OpenAsync(ct).ConfigureAwait(false);
                await ExecuteAsync(connection, null, ConnectionPragmas, ct).ConfigureAwait(false);

                // Journal mode is a property of the file, not of the connection, so it is set once and outside
                // a transaction — SQLite refuses the switch from inside one.
                await ExecuteAsync(connection, null, "PRAGMA journal_mode=WAL;", ct).ConfigureAwait(false);

                await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(ct).ConfigureAwait(false);
                await ExecuteAsync(connection, transaction, IndexSchema.Ddl, ct).ConfigureAwait(false);
                await transaction.CommitAsync(ct).ConfigureAwait(false);

                _created = true;
            }
            finally
            {
                _writeGate.Release();
            }
        }

        /// <summary>
        /// Releases the write gate and the pooled connections held against this database file. Pooled
        /// connections keep an operating system handle on the file open, so anything that needs to move or
        /// delete the file must dispose the database first.
        /// </summary>
        public void Dispose()
        {
            using (var connection = new SqliteConnection(_connectionString))
            {
                SqliteConnection.ClearPool(connection);
            }

            _writeGate.Dispose();
        }

        private static void Execute(SqliteConnection connection, SqliteTransaction? transaction, string sql)
        {
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = sql;
            command.ExecuteNonQuery();
        }

        private static async Task ExecuteAsync(SqliteConnection connection, SqliteTransaction? transaction, string sql, CancellationToken ct)
        {
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = sql;
            await command.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
        }
    }
}
