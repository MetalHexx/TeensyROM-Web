using FluentAssertions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;
using Xunit;
using Xunit.Abstractions;

namespace TeensyRom.Core.Storage.Tests.Integration
{
    /// <summary>
    /// Asks the store and the current cache the same question about the same real collection and requires the
    /// same answer. Comparison is on identifying facts only — path, name, size, content identity, file type,
    /// favourite flag — because the projection deliberately carries less metadata than today's records do.
    /// Search is absent on purpose: today's predicate matches the generated description, so ordinary words
    /// drawn from that boilerplate match tens of thousands of files and the current results are not a
    /// reference anything can be measured against.
    /// </summary>
    [Collection(SeededCollection.Name)]
    public sealed class QueryEquivalenceTests
    {
        private const int Random_Draws = 25;

        private static readonly CancellationToken Ct = CancellationToken.None;

        private readonly SeededCollectionFixture _seeded;
        private readonly ITestOutputHelper _output;

        public QueryEquivalenceTests(SeededCollectionFixture seeded, ITestOutputHelper output)
        {
            _seeded = seeded;
            _output = output;
        }

        [FixtureFact]
        public void SeededCollection_RecordsWhichFixtureAndIndexFileTheRunPaired()
        {
            _output.WriteLine(_seeded.Manifest);

            _seeded.Seed.Files.Should().BeGreaterThan(0, "a comparison against an empty seed proves nothing");
            _seeded.Cache.GetCacheSize().Should().BeGreaterThan(0, "the current cache must have read the index file");
            new FileInfo(_seeded.Inputs.IndexFilePath).Length.Should().BeGreaterThan(0);
        }

        [FixtureFact]
        public async Task GetDirectory_AcrossASampleOfRealDirectories_ReturnsWhatTheCurrentCacheReturns()
        {
            _seeded.DirectorySample.Should().NotBeEmpty();

            foreach (var (label, path) in _seeded.DirectorySample)
            {
                _output.WriteLine($"{label}: {path}");

                var directory = new DirectoryPath(path);
                var fromStore = await _seeded.Store.GetDirectoryAsync(_seeded.Scope, directory, Ct);
                var fromCache = _seeded.Cache.GetByDirPath(directory);

                fromStore.Should().NotBeNull("the store indexed the {0} '{1}'", label, path);
                fromCache.Should().NotBeNull("the current cache holds the {0} '{1}'", label, path);

                Identities(fromStore!.Files).Should()
                    .BeEquivalentTo(Identities(fromCache!.Files), "the files of the {0} '{1}' must agree", label, path);

                SubdirectoryPaths(fromStore.Directories).Should()
                    .BeEquivalentTo(SubdirectoriesTheFixtureCanCarry(fromCache.Directories),
                        "the subdirectories of the {0} '{1}' must agree", label, path);
            }
        }

        [FixtureFact]
        public async Task GetDirectory_ForAPathThatIsNotIndexed_IsAbsentInBoth()
        {
            var missing = new DirectoryPath($"/{Guid.NewGuid():N}/");

            (await _seeded.Store.GetDirectoryAsync(_seeded.Scope, missing, Ct)).Should().BeNull();
            _seeded.Cache.GetByDirPath(missing).Should().BeNull();
        }

        [FixtureFact]
        public async Task GetFileByPath_AcrossASampleOfRealFiles_ReturnsWhatTheCurrentCacheReturns()
        {
            _seeded.FilePathSample.Should().NotBeEmpty();

            foreach (var path in _seeded.FilePathSample)
            {
                var filePath = new FilePath(path);
                var fromStore = await _seeded.Store.GetFileByPathAsync(_seeded.Scope, filePath, Ct);
                var fromCache = _seeded.Cache.GetFileByPath(filePath);

                fromStore.Should().NotBeNull("the store indexed '{0}'", path);
                fromCache.Should().NotBeNull("the current cache holds '{0}'", path);

                Identity(fromStore!).Should().BeEquivalentTo(Identity(fromCache!), "'{0}' must agree", path);
            }
        }

        [FixtureFact]
        public async Task GetFileByPath_ForAPathThatIsNotIndexed_IsAbsentInBoth()
        {
            var missing = new FilePath($"/{Guid.NewGuid():N}/{Guid.NewGuid():N}.sid");

            (await _seeded.Store.GetFileByPathAsync(_seeded.Scope, missing, Ct)).Should().BeNull();
            _seeded.Cache.GetFileByPath(missing).Should().BeNull();
        }

        [FixtureFact]
        public async Task GetFilesByName_ForNamesThatRepeatAcrossDirectories_ReturnsWhatTheCurrentCacheReturns()
        {
            _seeded.NameSample.Should().NotBeEmpty();

            foreach (var name in _seeded.NameSample)
            {
                var fromStore = await _seeded.Store.GetFilesByNameAsync(_seeded.Scope, name, Ct);
                var fromCache = _seeded.Cache.GetFileByName(name);

                fromCache.Should().NotBeEmpty("the sample was drawn from files the current cache also holds");
                Identities(fromStore).Should()
                    .BeEquivalentTo(Identities(fromCache), "every copy named '{0}' must agree", name);
            }
        }

        [FixtureFact]
        public async Task FindParentFile_ForFilesUnderTheFavouriteAndPlaylistTrees_ReturnsWhatTheCurrentCacheReturns()
        {
            _seeded.LinkedCopySample.Should().NotBeEmpty();

            foreach (var path in _seeded.LinkedCopySample)
            {
                var file = await _seeded.Store.GetFileByPathAsync(_seeded.Scope, new FilePath(path), Ct);
                file.Should().NotBeNull("the sample was drawn from the seeded rows");

                var fromStore = await _seeded.Store.FindParentFileAsync(_seeded.Scope, file!, Ct);
                var fromCache = _seeded.Cache.FindParentFile(file!);

                if (fromCache is null)
                {
                    fromStore.Should().BeNull("the linked copy '{0}' has no original outside the linked trees", path);
                    continue;
                }

                fromStore.Should().NotBeNull("the linked copy '{0}' has an original at '{1}'", path, fromCache.Path.Value);
                Identity(fromStore!).Should()
                    .BeEquivalentTo(Identity(fromCache), "the parent of '{0}' must agree", path);
            }
        }

        [FixtureFact]
        public async Task FindSiblings_ForFilesWithLinkedCopies_ReturnsWhatTheCurrentCacheReturns()
        {
            _seeded.LinkedOriginalSample.Should().NotBeEmpty();

            foreach (var path in _seeded.LinkedOriginalSample)
            {
                var file = await _seeded.Store.GetFileByPathAsync(_seeded.Scope, new FilePath(path), Ct);
                file.Should().NotBeNull("the sample was drawn from the seeded rows");

                var fromStore = await _seeded.Store.FindSiblingsAsync(_seeded.Scope, file!, Ct);
                var fromCache = _seeded.Cache.FindSiblings(file!);

                Identities(fromStore).Should()
                    .BeEquivalentTo(Identities(fromCache), "the linked copies of '{0}' must agree", path);
            }
        }

        [FixtureFact]
        public async Task GetRandomFile_ForEachScope_DrawsOnlyFromTheCandidateSetTheCurrentCacheWouldDrawFrom()
        {
            foreach (var (storageScope, path) in _seeded.RandomScopeSample)
            {
                var scopePath = new DirectoryPath(path);
                var candidates = CandidatePaths(storageScope, scopePath);

                _output.WriteLine($"{storageScope} '{path}': {candidates.Count} candidates");
                candidates.Should().NotBeEmpty("{0} over '{1}' must have something to draw from", storageScope, path);

                var drawn = new List<string>();

                for (var draw = 0; draw < Random_Draws; draw++)
                {
                    var item = await _seeded.Store.GetRandomFileAsync(
                        _seeded.Scope, storageScope, scopePath, SeededCollectionFixture.ExcludePaths, [], Ct);

                    item.Should().NotBeNull("{0} over '{1}' has candidates", storageScope, path);

                    var itemPath = Normalize(item!.Path.Value);

                    candidates.Should().Contain(itemPath,
                        "'{0}' was drawn for {1} over '{2}' and must be a candidate the current cache would draw",
                        itemPath, storageScope, path);

                    AssertWithinScope(storageScope, scopePath, item);
                    drawn.Add(itemPath);
                }

                if (candidates.Count > Random_Draws)
                {
                    drawn.Distinct().Should().HaveCountGreaterThan(1,
                        "a draw over {0} candidates must sample the set, not return a fixed row", candidates.Count);
                }
            }
        }

        [FixtureFact]
        public async Task GetRandomFile_OverTheWholeStorage_NeverReturnsAFileFromAnExcludedTree()
        {
            var root = new DirectoryPath(StorageHelper.Remote_Path_Root);

            for (var draw = 0; draw < Random_Draws; draw++)
            {
                var item = await _seeded.Store.GetRandomFileAsync(
                    _seeded.Scope, StorageScope.Storage, root, SeededCollectionFixture.ExcludePaths, [], Ct);

                item.Should().NotBeNull();

                foreach (var excluded in SeededCollectionFixture.ExcludePaths)
                {
                    item!.Path.Contains(excluded).Should()
                        .BeFalse("'{0}' sits under the excluded path '{1}'", item.Path.Value, excluded.Value);
                }
            }
        }

        /// <summary>
        /// The boundary the scope draws, asserted directly rather than only through set membership: a shallow
        /// draw may not reach a sibling directory, and a deep draw may not leave the subtree.
        /// </summary>
        private static void AssertWithinScope(StorageScope storageScope, DirectoryPath scopePath, LaunchableItem item)
        {
            switch (storageScope)
            {
                case StorageScope.DirShallow:
                    item.Path.Directory.Equals(scopePath).Should()
                        .BeTrue("'{0}' is outside the shallow scope '{1}'", item.Path.Value, scopePath.Value);
                    break;

                case StorageScope.DirDeep:
                case StorageScope.Storage:
                    Normalize(item.Path.Value).Should()
                        .StartWith(Normalize(scopePath.Value), "'{0}' is outside the scope '{1}'", item.Path.Value, scopePath.Value);
                    break;
            }
        }

        /// <summary>
        /// The set the current cache would draw a random file from, replicating its predicates verbatim: the
        /// exclude filter runs against the directory key with <c>Contains</c>, and an empty file-type request
        /// becomes every launchable type.
        /// </summary>
        private HashSet<string> CandidatePaths(StorageScope storageScope, DirectoryPath scopePath)
        {
            var fileTypes = TeensyFileTypeExtensions.GetLaunchFileTypes();
            var excluded = SeededCollectionFixture.ExcludePaths.Select(path => path.Value).ToArray();

            return _seeded.Cache
                .Where(entry => !excluded.Any(exclude => entry.Key.Contains(exclude)))
                .SelectMany(entry => entry.Value.Files)
                .Where(file => fileTypes.Contains(file.FileType))
                .Where(file => storageScope switch
                {
                    StorageScope.DirDeep => file.Path.Value.StartsWith(scopePath.ToString()),
                    StorageScope.DirShallow => file.Path.Directory.Equals(scopePath),
                    StorageScope.Storage => file.Path.Value.StartsWith(scopePath.ToString()),
                    _ => true
                })
                .OfType<LaunchableItem>()
                .Select(file => Normalize(file.Path.Value))
                .ToHashSet();
        }

        private static List<object> Identities(IEnumerable<FileItem> files) => files.Select(Identity).ToList();

        private static object Identity(FileItem file) => new
        {
            Path = Normalize(file.Path.Value),
            Name = Normalize(file.Name),
            file.Size,
            ContentId = Normalize(file.Id),
            file.FileType,
            file.IsFavorite
        };

        private static List<string> SubdirectoryPaths(IEnumerable<DirectoryItem> directories) =>
            directories.Select(directory => Normalize(directory.Path.Value)).ToList();

        /// <summary>
        /// The cache's subdirectories, minus the ones the fixture is incapable of carrying. A fixture is a
        /// listing of files: a directory with no file anywhere beneath it leaves no record in one, so the
        /// seeded store has no way to know it exists. Comparing it would measure the fixture format, not the
        /// store — a device scan, which is what fills the store in production, does report such a directory.
        /// </summary>
        private List<string> SubdirectoriesTheFixtureCanCarry(IEnumerable<DirectoryItem> directories) =>
            directories
                .Where(directory => CacheHoldsAFileBeneath(directory.Path))
                .Select(directory => Normalize(directory.Path.Value))
                .ToList();

        private bool CacheHoldsAFileBeneath(DirectoryPath path) => _seeded.Cache
            .Any(entry => entry.Key.StartsWith(path.Value, StringComparison.OrdinalIgnoreCase) && entry.Value.Files.Any());

        /// <summary>
        /// Paths are compared case-insensitively throughout the system — the value objects use
        /// <see cref="StringComparison.OrdinalIgnoreCase"/> and every index column is <c>COLLATE NOCASE</c> —
        /// so a case difference between the two sources is not a disagreement about rows.
        /// </summary>
        private static string Normalize(string value) => value.ToLowerInvariant();
    }
}
