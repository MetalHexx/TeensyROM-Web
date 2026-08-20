using System.Diagnostics;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Storage.Index.Fixtures
{
    /// <summary>
    /// Fills an index database from a fixture: directories, files, favourite flags, and (optionally) the
    /// metadata projection. Seeding is a replace, not a merge — the scope is cleared first — so seeding the
    /// same fixture twice into fresh databases is reproducible.
    /// </summary>
    public sealed class IndexFixtureSeeder
    {
        private const string Directories_Phase = "directories";
        private const string Files_Phase = "files";
        private const string Favourites_Phase = "favourites";
        private const string Metadata_Phase = "metadata";

        private readonly IIndexStore _store;
        private readonly IIndexDatabase _database;
        private readonly IMetadataProjection? _projection;

        public IndexFixtureSeeder(IIndexStore store, IIndexDatabase database, IMetadataProjection? projection)
        {
            ArgumentNullException.ThrowIfNull(store);
            ArgumentNullException.ThrowIfNull(database);

            _store = store;
            _database = database;
            _projection = projection;
        }

        public async Task<SeedResult> SeedAsync(IndexScope scope, string fixturePath, SeedOptions options,
            IProgress<SeedProgress>? progress, CancellationToken ct)
        {
            ArgumentNullException.ThrowIfNull(fixturePath);
            ArgumentNullException.ThrowIfNull(options);

            var stopwatch = Stopwatch.StartNew();
            var header = IndexFixtureReader.ReadHeader(fixturePath);
            var totalFiles = options.MaxFiles is { } cap ? Math.Min(header.FileCount, cap) : header.FileCount;

            await _database.EnsureCreatedAsync(ct);
            await _store.EnsureStorageAsync(scope, ct);
            await _store.ClearAsync(scope, ct);

            // The one structure allowed to grow with the collection: bounded by directory count, not file
            // count. Every file batch and the fixture stream itself go out of scope as soon as they are used.
            var knownDirectories = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var batch = new List<FileItem>(options.BatchSize);
            var fileCount = 0;

            foreach (var record in IndexFixtureReader.Read(fixturePath))
            {
                ct.ThrowIfCancellationRequested();

                if (options.MaxFiles is { } limit && fileCount >= limit)
                {
                    break;
                }

                FileItem file;

                try
                {
                    file = new FileItem
                    {
                        Path = new FilePath(record.Path),
                        Name = record.Name,
                        Size = record.Size,
                        StorageType = scope.StorageType
                    };
                }
                catch (ArgumentException)
                {
                    // A real card contains paths the value object will not accept. Skipped and counted by
                    // exclusion from the file total, not thrown on: a run that dies on record 40,000 is useless.
                    continue;
                }

                var directory = file.Path.Directory;

                if (RegisterDirectory(knownDirectories, directory))
                {
                    await _store.UpsertDirectoryAsync(scope, directory, ct);
                    progress?.Report(new SeedProgress(fileCount, totalFiles, Directories_Phase));
                }

                batch.Add(file);
                fileCount++;

                if (batch.Count >= options.BatchSize)
                {
                    await _store.UpsertFilesAsync(scope, batch, ct);
                    batch.Clear();
                    progress?.Report(new SeedProgress(fileCount, totalFiles, Files_Phase));
                }
            }

            if (batch.Count > 0)
            {
                await _store.UpsertFilesAsync(scope, batch, ct);
                progress?.Report(new SeedProgress(fileCount, totalFiles, Files_Phase));
            }

            // Run once, set-wise, over everything just written rather than letting per-row favourite
            // maintenance fire once per file during the load.
            var favoritesMarked = await _store.RepairFavoritesAsync(scope, ct);
            progress?.Report(new SeedProgress(fileCount, totalFiles, Favourites_Phase));

            var metadataRows = 0;

            if (options.RunProjection && _projection is not null)
            {
                var projectionProgress = progress is null
                    ? null
                    : new Progress<int>(_ => progress.Report(new SeedProgress(fileCount, totalFiles, Metadata_Phase)));

                metadataRows = await _projection.ProjectAsync(scope, projectionProgress, ct);
            }

            return new SeedResult(knownDirectories.Count, fileCount, favoritesMarked, metadataRows, stopwatch.Elapsed);
        }

        /// <summary>
        /// Registers <paramref name="directory"/> and any of its ancestors not already known. Returns
        /// <see langword="true"/> only when <paramref name="directory"/> itself is new, so the caller issues a
        /// store write solely for a genuinely unseen leaf — <see cref="IIndexStore.UpsertDirectoryAsync"/>
        /// creates that leaf's whole ancestor chain in the one call.
        /// </summary>
        private static bool RegisterDirectory(HashSet<string> known, DirectoryPath directory)
        {
            if (!known.Add(directory.Value))
            {
                return false;
            }

            var ancestor = directory.IsRoot ? null : directory.ParentPath;

            while (ancestor is not null && known.Add(ancestor.Value))
            {
                ancestor = ancestor.IsRoot ? null : ancestor.ParentPath;
            }

            return true;
        }
    }
}
