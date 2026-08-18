using Microsoft.Data.Sqlite;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage.Index;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Storage.Tests.Index
{
    /// <summary>
    /// A real index database on a per-test temporary file. The write gate, write-ahead logging, and file
    /// creation are part of what is under test, so nothing here uses an in-memory database.
    /// </summary>
    internal sealed class IndexTestFixture : IDisposable
    {
        private readonly string _root;

        private IndexTestFixture(string root, IndexDatabase database)
        {
            _root = root;
            Database = database;
            Store = new SqliteIndexStore(database);
        }

        public IndexDatabase Database { get; }

        public SqliteIndexStore Store { get; }

        public string DatabasePath => ResolveDatabasePath(_root);

        public IndexScope Scope { get; } = new("device-under-test", TeensyStorageType.SD);

        public static IndexTestFixture Create()
        {
            var root = Path.Combine(Path.GetTempPath(), "teensyrom-index-tests", Guid.NewGuid().ToString("N"));

            return new IndexTestFixture(root, new IndexDatabase(ResolveDatabasePath(root)));
        }

        public static async Task<IndexTestFixture> CreateReadyAsync()
        {
            var fixture = Create();
            await fixture.Database.EnsureCreatedAsync(CancellationToken.None);

            return fixture;
        }

        public static FileItem CreateFile(string path, long size = 100)
        {
            var filePath = new FilePath(path);

            return new FileItem { Path = filePath, Name = filePath.FileName, Size = size };
        }

        public object? Scalar(string sql, params (string Name, object Value)[] parameters)
        {
            using var connection = Database.OpenRead();
            using var command = connection.CreateCommand();
            command.CommandText = sql;

            foreach (var (name, value) in parameters)
            {
                command.Parameters.AddWithValue(name, value);
            }

            var result = command.ExecuteScalar();

            return result == DBNull.Value ? null : result;
        }

        public long Count(string sql, params (string Name, object Value)[] parameters) =>
            Convert.ToInt64(Scalar(sql, parameters));

        public IReadOnlyList<string> Strings(string sql, params (string Name, object Value)[] parameters)
        {
            using var connection = Database.OpenRead();
            using var command = connection.CreateCommand();
            command.CommandText = sql;

            foreach (var (name, value) in parameters)
            {
                command.Parameters.AddWithValue(name, value);
            }

            using var reader = command.ExecuteReader();
            var values = new List<string>();

            while (reader.Read())
            {
                values.Add(reader.GetString(0));
            }

            return values;
        }

        /// <summary>
        /// Writes straight to the database, bypassing the store — used to corrupt state the store is then
        /// asked to repair.
        /// </summary>
        public async Task ExecuteAsync(string sql, params (string Name, object Value)[] parameters) =>
            await Database.WriteAsync(async (connection, transaction) =>
            {
                await using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = sql;

                foreach (var (name, value) in parameters)
                {
                    command.Parameters.AddWithValue(name, value);
                }

                return await command.ExecuteNonQueryAsync(CancellationToken.None);
            }, CancellationToken.None);

        public void Dispose()
        {
            Database.Dispose();

            if (Directory.Exists(_root))
            {
                Directory.Delete(_root, recursive: true);
            }
        }

        private static string ResolveDatabasePath(string root) =>
            Path.Combine(root, IndexPaths.Index_Db_Relative_Path, IndexPaths.Index_Db_File_Name);
    }

    /// <summary>
    /// Wraps the real database and refuses to start a write once the allowance is spent, standing in for an
    /// interruption — a lost device, a killed process — part-way through a bulk load.
    /// </summary>
    internal sealed class InterruptedIndexDatabase(IIndexDatabase inner, int allowedWrites) : IIndexDatabase
    {
        private int _writes;

        public SqliteConnection OpenRead() => inner.OpenRead();

        public Task EnsureCreatedAsync(CancellationToken ct) => inner.EnsureCreatedAsync(ct);

        public Task<T> WriteAsync<T>(Func<SqliteConnection, SqliteTransaction, Task<T>> work, CancellationToken ct)
        {
            if (Interlocked.Increment(ref _writes) > allowedWrites)
            {
                throw new IOException("The device went away part-way through the load.");
            }

            return inner.WriteAsync(work, ct);
        }
    }
}
