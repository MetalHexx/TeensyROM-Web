using NSubstitute;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Games;
using TeensyRom.Core.Music;
using TeensyRom.Core.Music.DeepSid;
using TeensyRom.Core.Music.Hvsc;
using TeensyRom.Core.Storage.Index;
using TeensyRom.Core.Storage.Index.Fixtures;
using TeensyRom.Core.ValueObjects;
using Xunit;

namespace TeensyRom.Core.Storage.Tests.Integration
{
    /// <summary>
    /// Binds every test in the suite to one seed of the real collection. Seeding 270,000 files and projecting
    /// their metadata is minutes of work; doing it per test class would make the suite unusable.
    /// </summary>
    [CollectionDefinition(SeededCollection.Name)]
    public sealed class SeededCollection : ICollectionFixture<SeededCollectionFixture>
    {
        public const string Name = "seeded-real-collection";
    }

    /// <summary>
    /// Seeds a throwaway index database from the local fixture and builds the current cache against the same
    /// device's real index file, so the two can be asked the same question.
    /// </summary>
    public sealed class SeededCollectionFixture : IAsyncLifetime
    {
        private const string Data_Dir_Environment_Variable = "TEENSYROM_DATA_DIR";
        private const int Sample_Size = 60;
        private const int Linked_Copy_Sample_Size = 25;

        private static readonly CancellationToken Ct = CancellationToken.None;

        private TemporaryIndex? _index;
        private FixtureInputs? _inputs;
        private SimpleStorageCache? _cache;
        private SeedResult? _seed;

        private IReadOnlyList<(string Label, string Path)>? _directorySample;
        private IReadOnlyList<string>? _filePathSample;
        private IReadOnlyList<string>? _nameSample;
        private IReadOnlyList<string>? _linkedCopySample;
        private IReadOnlyList<string>? _linkedOriginalSample;
        private string? _crowdedDirectory;

        /// <summary>The fixture and index file this run compared.</summary>
        public FixtureInputs Inputs => _inputs ?? throw NotSeeded();

        /// <summary>The store under comparison, over the seeded throwaway database.</summary>
        public SqliteIndexStore Store => Index.Store;

        /// <summary>The current in-memory cache, read from the device's real index file.</summary>
        public SimpleStorageCache Cache => _cache ?? throw NotSeeded();

        public IndexScope Scope => Index.Scope;

        public SeedResult Seed => _seed ?? throw NotSeeded();

        public int StorageId { get; private set; }

        /// <summary>What this run paired: the fixture header, and the index file path and size beside it.</summary>
        public string Manifest { get; private set; } = string.Empty;

        /// <summary>The metadata source the projection ran over, or why it ran stubbed.</summary>
        public string MetadataSourceNote { get; private set; } = string.Empty;

        /// <summary>
        /// A handful of real directories chosen to span the shapes a listing has to survive: the root, the
        /// deepest path, one with no files, the most crowded one, and one under the favourites tree.
        /// </summary>
        public IReadOnlyList<(string Label, string Path)> DirectorySample => _directorySample ??= BuildDirectorySample();

        /// <summary>File paths spread evenly across the collection rather than clustered at its start.</summary>
        public IReadOnlyList<string> FilePathSample => _filePathSample ??= BuildFilePathSample();

        /// <summary>Names that repeat across directories, plus one that does not.</summary>
        public IReadOnlyList<string> NameSample => _nameSample ??= BuildNameSample();

        /// <summary>Files sitting under a favourite or playlist tree — the copies with a parent elsewhere.</summary>
        public IReadOnlyList<string> LinkedCopySample => _linkedCopySample ??= BuildLinkedCopySample();

        /// <summary>Files outside the favourite and playlist trees that have at least one linked copy.</summary>
        public IReadOnlyList<string> LinkedOriginalSample => _linkedOriginalSample ??= BuildLinkedOriginalSample();

        /// <summary>The launchable-heaviest directory outside the excluded trees.</summary>
        public string CrowdedDirectory => _crowdedDirectory ??= ResolveCrowdedDirectory();

        /// <summary>The scopes a random draw is compared over: whole storage, a subtree, and one directory.</summary>
        public IReadOnlyList<(StorageScope Scope, string Path)> RandomScopeSample =>
        [
            (StorageScope.Storage, StorageHelper.Remote_Path_Root),
            (StorageScope.DirDeep, new DirectoryPath(CrowdedDirectory).ParentPath?.Value ?? StorageHelper.Remote_Path_Root),
            (StorageScope.DirShallow, CrowdedDirectory)
        ];

        /// <summary>The exclude-path set the application passes on every scoped read.</summary>
        public static IReadOnlyList<DirectoryPath> ExcludePaths { get; } =
            [.. StorageHelper.FavoritePaths, new DirectoryPath(StorageHelper.Playlist_Path)];

        public async Task InitializeAsync()
        {
            // Every test in the collection is skipped when the inputs are absent, but xunit still builds the
            // collection fixture, so an absent pair has to leave the fixture inert rather than throw.
            if (!FixtureAvailability.HasFixtureAndIndex(out _))
            {
                return;
            }

            _inputs = FixtureAvailability.Require();
            _index = TemporaryIndex.Create(new IndexScope(_inputs.Header.DeviceId, _inputs.Header.StorageType));

            var seeder = new IndexFixtureSeeder(_index.Store, _index.Database, CreateProjection(_index));
            _seed = await seeder.SeedAsync(_index.Scope, _inputs.FixturePath, new SeedOptions(RunProjection: true), null, Ct);

            StorageId = (int)_index.Count(
                "SELECT id FROM storage WHERE device_id = $device AND storage_type = $type;",
                ("$device", _index.Scope.DeviceId),
                ("$type", (int)_index.Scope.StorageType));

            _cache = CreateCache(_inputs);

            Manifest = BuildManifest(_inputs, _seed, _cache, MetadataSourceNote);
            Console.WriteLine(Manifest);
        }

        public Task DisposeAsync()
        {
            // Nothing owns the cache's memory but this fixture, and the collection outlives every test class.
            _cache?.Clear();
            _cache = null;

            _index?.Dispose();
            _index = null;

            return Task.CompletedTask;
        }

        public long Count(string sql, params (string Name, object Value)[] parameters) => Index.Count(sql, parameters);

        public IReadOnlyList<string> Strings(string sql, params (string Name, object Value)[] parameters) =>
            Index.Strings(sql, parameters);

        private TemporaryIndex Index => _index ?? throw NotSeeded();

        /// <summary>
        /// Builds the current cache against the real index file. <see cref="SimpleStorageCache"/> resolves
        /// that file in its constructor through <c>TEENSYROM_DATA_DIR</c>, so the variable is set before the
        /// call and restored after it rather than left pointing at the test's choice.
        /// </summary>
        private static SimpleStorageCache CreateCache(FixtureInputs inputs)
        {
            var previous = Environment.GetEnvironmentVariable(Data_Dir_Environment_Variable);
            Environment.SetEnvironmentVariable(Data_Dir_Environment_Variable, inputs.DataDirectory);

            try
            {
                var storage = new CartStorage { DeviceId = inputs.Header.DeviceId, Type = inputs.Header.StorageType };

                return new SimpleStorageCache(storage, new StorageSettings { CartStorage = storage });
            }
            finally
            {
                Environment.SetEnvironmentVariable(Data_Dir_Environment_Variable, previous);
            }
        }

        /// <summary>
        /// Builds the projection over the real HVSC database when the local data directory carries it, and
        /// over a stub when it does not. The search oracle needs real creators and real STIL commentary in
        /// <c>content_search</c> to mean anything; the equivalence assertions read no metadata field, so they
        /// are indifferent either way and a machine without HVSC still runs them.
        /// </summary>
        private MetadataProjection CreateProjection(TemporaryIndex index)
        {
            var gameMetadata = Substitute.For<IGameMetadataService>();
            gameMetadata.EnrichGame(Arg.Any<GameItem>()).Returns(call => call.Arg<GameItem>());

            var sourceVersion = Substitute.For<IMetadataSourceVersion>();
            sourceVersion.Current.Returns("integration");

            var hvscSources = MetadataSourceAvailability.TryResolve();

            IHvscDatabase hvsc;

            if (hvscSources is null)
            {
                MetadataSourceAvailability.HasHvsc(out var why);
                MetadataSourceNote = why!;
                hvsc = Substitute.For<IHvscDatabase>();
            }
            else
            {
                MetadataSourceNote = $"HVSC '{hvscSources.HvscCsvPath}'";
                hvsc = new HvscDatabase(hvscSources.HvscCsvPath);
            }

            var sidMetadata = new SidMetadataService(hvsc, Substitute.For<IDeepSidDatabase>());

            return new MetadataProjection(index.Database, sidMetadata, gameMetadata, sourceVersion);
        }

        private static string BuildManifest(FixtureInputs inputs, SeedResult seed, SimpleStorageCache cache, string metadataSourceNote)
        {
            var header = inputs.Header;
            var indexFile = new FileInfo(inputs.IndexFilePath);

            return $"Compared fixture '{inputs.FixturePath}' " +
                   $"(v{header.Version}, device '{header.DeviceId}', {header.StorageType}, {header.FileCount} files) " +
                   $"against index file '{inputs.IndexFilePath}' ({indexFile.Length} bytes). " +
                   $"Seeded {seed.Files} files, {seed.Directories} directories, {seed.MetadataRows} metadata rows " +
                   $"in {seed.Elapsed}. Cache holds {cache.Count} directories and {cache.GetCacheSize()} files. " +
                   $"Projected metadata from: {metadataSourceNote}.";
        }

        private IReadOnlyList<(string, string)> BuildDirectorySample()
        {
            var deepest = Index.String(
                """
                SELECT path FROM directory WHERE storage_id = $storage
                 ORDER BY (LENGTH(path) - LENGTH(REPLACE(path, '/', ''))) DESC, path LIMIT 1;
                """,
                ("$storage", StorageId));

            var empty = Index.String(
                """
                SELECT d.path FROM directory d
                 WHERE d.storage_id = $storage
                   AND NOT EXISTS (SELECT 1 FROM file f WHERE f.storage_id = d.storage_id AND f.parent_path = d.path)
                 ORDER BY d.path LIMIT 1;
                """,
                ("$storage", StorageId));

            var favourite = Index.String(
                """
                SELECT parent_path FROM file
                 WHERE storage_id = $storage AND path LIKE '/favorites/%'
                 GROUP BY parent_path ORDER BY COUNT(*) DESC, parent_path LIMIT 1;
                """,
                ("$storage", StorageId));

            var samples = new List<(string, string)> { ("root", StorageHelper.Remote_Path_Root) };

            AddWhenPresent(samples, "deepest directory", deepest);
            AddWhenPresent(samples, "directory with no files", empty);
            AddWhenPresent(samples, "most crowded directory", CrowdedDirectory);
            AddWhenPresent(samples, "directory under favourites", favourite);

            return samples;
        }

        private IReadOnlyList<string> BuildFilePathSample()
        {
            var total = Count("SELECT COUNT(*) FROM file WHERE storage_id = $storage;", ("$storage", StorageId));
            var stride = Math.Max(1, total / Sample_Size);

            return Strings(
                """
                SELECT path FROM file
                 WHERE storage_id = $storage AND id % $stride = 1
                 ORDER BY path LIMIT $limit;
                """,
                ("$storage", StorageId), ("$stride", stride), ("$limit", Sample_Size));
        }

        private IReadOnlyList<string> BuildNameSample()
        {
            // The name column is COLLATE NOCASE, so GROUP BY folds spellings that differ only by case into
            // one row. Today's cache matches names ordinally, so a folded group would compare two different
            // questions: the BLOB cast counts the distinct byte spellings and keeps only the unambiguous ones.
            var repeated = Strings(
                """
                SELECT name FROM file
                 WHERE storage_id = $storage
                 GROUP BY name
                HAVING COUNT(*) BETWEEN 2 AND 50 AND COUNT(DISTINCT CAST(name AS BLOB)) = 1
                 ORDER BY COUNT(*) DESC, name LIMIT 10;
                """,
                ("$storage", StorageId));

            var unique = Strings(
                """
                SELECT name FROM file
                 WHERE storage_id = $storage
                 GROUP BY name
                HAVING COUNT(*) = 1
                 ORDER BY name LIMIT 1;
                """,
                ("$storage", StorageId));

            return [.. repeated, .. unique];
        }

        private IReadOnlyList<string> BuildLinkedCopySample() => Strings(
            """
            SELECT path FROM file
             WHERE storage_id = $storage AND (path LIKE '/favorites/%' OR path LIKE '/playlists/%')
             ORDER BY path LIMIT $limit;
            """,
            ("$storage", StorageId), ("$limit", Linked_Copy_Sample_Size));

        private IReadOnlyList<string> BuildLinkedOriginalSample() => Strings(
            """
            SELECT f.path FROM file f
             WHERE f.storage_id = $storage
               AND f.path NOT LIKE '/favorites/%' AND f.path NOT LIKE '/playlists/%'
               AND EXISTS (SELECT 1 FROM file g
                            WHERE g.storage_id = f.storage_id AND g.content_id = f.content_id
                              AND (g.path LIKE '/favorites/%' OR g.path LIKE '/playlists/%'))
             ORDER BY f.path LIMIT $limit;
            """,
            ("$storage", StorageId), ("$limit", Linked_Copy_Sample_Size));

        private string ResolveCrowdedDirectory() => Index.String(
            """
            SELECT parent_path FROM file
             WHERE storage_id = $storage
               AND file_type NOT IN ($hex, $unknown)
               AND path NOT LIKE '/favorites/%' AND path NOT LIKE '/playlists/%' AND path NOT LIKE '/firmware/%'
             GROUP BY parent_path ORDER BY COUNT(*) DESC, parent_path LIMIT 1;
            """,
            ("$storage", StorageId),
            ("$hex", (int)TeensyFileType.Hex),
            ("$unknown", (int)TeensyFileType.Unknown)) ?? StorageHelper.Remote_Path_Root;

        private static void AddWhenPresent(List<(string, string)> samples, string label, string? path)
        {
            if (!string.IsNullOrEmpty(path) && !samples.Any(sample => sample.Item2 == path))
            {
                samples.Add((label, path));
            }
        }

        private static InvalidOperationException NotSeeded() =>
            new("The seeded collection fixture was never initialised, which means a test ran without the " +
                "fixture/index pair. Every test here must be a FixtureFact.");
    }

    /// <summary>
    /// A real index database on a throwaway file, with read-only SQL access for the facts the store's public
    /// surface does not expose. Nothing here uses an in-memory database: write-ahead logging and the write
    /// gate are exactly what the concurrency run is measuring.
    /// </summary>
    internal sealed class TemporaryIndex : IDisposable
    {
        private readonly string _root;

        private TemporaryIndex(string root, IndexScope scope)
        {
            _root = root;
            Scope = scope;
            Database = new IndexDatabase(Path.Combine(root, IndexPaths.Index_Db_Relative_Path, IndexPaths.Index_Db_File_Name));
            Store = new SqliteIndexStore(Database);
        }

        public IndexScope Scope { get; }

        public IndexDatabase Database { get; }

        public SqliteIndexStore Store { get; }

        public static TemporaryIndex Create(IndexScope scope) => new(
            Path.Combine(Path.GetTempPath(), "teensyrom-storage-integration", Guid.NewGuid().ToString("N")),
            scope);

        public long Count(string sql, params (string Name, object Value)[] parameters) =>
            Convert.ToInt64(Scalar(sql, parameters));

        public string? String(string sql, params (string Name, object Value)[] parameters) =>
            Scalar(sql, parameters) as string;

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

        public void Dispose()
        {
            Database.Dispose();

            if (Directory.Exists(_root))
            {
                Directory.Delete(_root, recursive: true);
            }
        }

        private object? Scalar(string sql, params (string Name, object Value)[] parameters)
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
    }
}
