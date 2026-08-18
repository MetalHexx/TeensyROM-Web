using System.Collections.Concurrent;
using FluentAssertions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage.Index;
using TeensyRom.Core.Storage.Index.Fixtures;
using TeensyRom.Core.ValueObjects;
using Xunit;
using Xunit.Abstractions;

namespace TeensyRom.Core.Storage.Tests.Integration
{
    /// <summary>
    /// The transfer pump's shape: a background worker upserting in bulk while request threads read the same
    /// storage. Today that runs unsynchronised against an in-memory dictionary, so the question the store has
    /// to answer is whether a reader can be hurt by a write in flight.
    /// </summary>
    [Collection(SeededCollection.Name)]
    public sealed class ConcurrentReadWriteTests
    {
        private const int Files_To_Write = 20_000;
        private const int Writer_Batch_Size = 500;
        private const int Reader_Count = 4;
        private const int Probe_Stride = 37;
        private const int Search_Limit = 25;

        private static readonly CancellationToken Ct = CancellationToken.None;

        private readonly SeededCollectionFixture _seeded;
        private readonly ITestOutputHelper _output;

        public ConcurrentReadWriteTests(SeededCollectionFixture seeded, ITestOutputHelper output)
        {
            _seeded = seeded;
            _output = output;
        }

        [FixtureFact]
        public async Task BulkUpsert_WithConcurrentReaders_ServesEveryReadCoherentlyAndWritesEveryRow()
        {
            var scope = new IndexScope($"concurrency-{Guid.NewGuid():N}", _seeded.Inputs.Header.StorageType);

            // Its own database, not the seeded one: this test writes, and the equivalence suite shares the
            // seeded database as a fixed reference.
            using var index = TemporaryIndex.Create(scope);
            await index.Database.EnsureCreatedAsync(Ct);
            await index.Store.EnsureStorageAsync(scope, Ct);

            var files = ReadFiles(_seeded.Inputs.FixturePath, scope.StorageType, Files_To_Write);
            files.Should().HaveCountGreaterThan(Writer_Batch_Size * 4, "the write has to last long enough to be read across");

            var expected = files.ToDictionary(file => file.Path.Value, file => file, StringComparer.OrdinalIgnoreCase);
            var probes = files.Where((_, position) => position % Probe_Stride == 0).Select(file => file.Path).ToArray();

            var failures = new ConcurrentBag<Exception>();
            using var writerFinished = new CancellationTokenSource();

            var writer = Task.Run(async () =>
            {
                try
                {
                    foreach (var batch in files.Chunk(Writer_Batch_Size))
                    {
                        await index.Store.UpsertFilesAsync(scope, batch, Ct);
                    }
                }
                finally
                {
                    writerFinished.Cancel();
                }
            });

            var readers = Enumerable
                .Range(0, Reader_Count)
                .Select(reader => Task.Run(() => ReadUntilAsync(index, scope, probes, expected, failures, writerFinished.Token)))
                .ToArray();

            await writer;
            var reads = await Task.WhenAll(readers);

            _output.WriteLine($"{files.Count} files written in batches of {Writer_Batch_Size} " +
                              $"alongside {reads.Sum()} concurrent reads across {Reader_Count} readers.");

            failures.Should().BeEmpty("no reader may fail while a bulk upsert runs, but got: {0}",
                string.Join(" | ", failures.Select(failure => failure.Message)));

            reads.Sum().Should().BeGreaterThan(0, "the readers must have overlapped the write");

            (await index.Store.GetFileCountAsync(scope, Ct)).Should()
                .Be(files.Count, "every row the writer sent must have landed");

            index.Count("SELECT COUNT(*) FROM file WHERE name = '' OR path = '' OR parent_path = '' OR content_id = '';")
                .Should().Be(0, "a file row must never be left half written");

            index.Count("""
                SELECT COUNT(*) FROM file f
                 WHERE NOT EXISTS (SELECT 1 FROM directory d
                                    WHERE d.storage_id = f.storage_id AND d.path = f.parent_path);
                """)
                .Should().Be(0, "every file row must have kept its parent directory row");
        }

        /// <summary>
        /// Issues directory listings, path lookups, and searches until the writer stops. Every row it does see
        /// has to be whole: a partially written file would show up as a name, size, or identity that does not
        /// match what the writer sent for that path.
        /// </summary>
        private static async Task<int> ReadUntilAsync(TemporaryIndex index, IndexScope scope, FilePath[] probes,
            IReadOnlyDictionary<string, FileItem> expected, ConcurrentBag<Exception> failures, CancellationToken until)
        {
            var random = new Random(Environment.CurrentManagedThreadId);
            var reads = 0;

            while (!until.IsCancellationRequested)
            {
                var probe = probes[random.Next(probes.Length)];

                try
                {
                    var file = await index.Store.GetFileByPathAsync(scope, probe, Ct);

                    if (file is not null)
                    {
                        AssertWhole(file, expected[probe.Value]);
                    }

                    var directory = await index.Store.GetDirectoryAsync(scope, probe.Directory, Ct);

                    if (directory is not null)
                    {
                        foreach (var listed in directory.Files)
                        {
                            if (expected.TryGetValue(listed.Path.Value, out var source))
                            {
                                AssertWhole(listed, source);
                            }
                        }
                    }

                    await index.Store.SearchAsync(scope, probe.FileNameWithoutExtension, [], [], Search_Limit, Ct);

                    reads++;
                }
                catch (Exception exception)
                {
                    failures.Add(exception);
                    break;
                }
            }

            return reads;
        }

        private static void AssertWhole(FileItem observed, FileItem expected)
        {
            observed.Name.Should().Be(expected.Name, "'{0}' was read while the writer ran", expected.Path.Value);
            observed.Size.Should().Be(expected.Size, "'{0}' was read while the writer ran", expected.Path.Value);
            observed.Id.Should().Be(expected.Id, "'{0}' was read while the writer ran", expected.Path.Value);
            observed.FileType.Should().Be(expected.FileType, "'{0}' was read while the writer ran", expected.Path.Value);
        }

        /// <summary>
        /// Takes the first <paramref name="limit"/> usable records off the fixture. Records the value objects
        /// reject are skipped, as the seeder skips them, and a repeated path is dropped so "rows written" and
        /// "rows the writer sent" mean the same number.
        /// </summary>
        private static List<FileItem> ReadFiles(string fixturePath, TeensyStorageType storageType, int limit)
        {
            var files = new List<FileItem>(limit);
            var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var record in IndexFixtureReader.Read(fixturePath))
            {
                if (files.Count >= limit)
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
                        StorageType = storageType
                    };
                }
                catch (ArgumentException)
                {
                    continue;
                }

                if (paths.Add(file.Path.Value))
                {
                    files.Add(file);
                }
            }

            return files;
        }
    }
}
