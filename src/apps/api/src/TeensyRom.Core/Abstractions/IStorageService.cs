using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Settings;
using TeensyRom.Core.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Abstractions
{
    public interface IStorageService
    {
        Task<bool> CacheAll(CancellationToken ct);
        Task<bool> Cache(DirectoryPath path, CancellationToken ct);
        public void ClearCache();
        public void ClearCache(DirectoryPath path);
        public Task<FileItem?> GetFile(FilePath filePath);

        /// <summary>Reads a file's raw bytes from this storage over the serial link. Never cached.</summary>
        Task<FileBytesResult> ReadFileBytes(FilePath filePath, CancellationToken ct);
        Task<IStorageCacheItem?> GetDirectory(DirectoryPath directoryPath);
        LaunchableItem? GetRandomFile(StorageScope scope, DirectoryPath scopePath, TeensyFilterType filterType);
        IEnumerable<LaunchableItem> Search(string searchText, TeensyFilterType filterType = TeensyFilterType.All);
        Task<LaunchableItem?> SaveFavorite(LaunchableItem launchItem, TeensyStorageType storageType, CancellationToken ct);
        Task<bool> RemoveFavorite(LaunchableItem file, TeensyStorageType storageType, CancellationToken ct);

        /// <summary>
        /// Upserts a single freshly-transferred file into the in-memory cache so it is queryable
        /// immediately, without re-indexing. Does not persist to disk - see <see cref="PersistCache"/>.
        /// </summary>
        void UpsertTransferredFile(FilePath targetPath, long sizeBytes);

        /// <summary>Writes the current cache state to disk. Call once per terminal job, not per file.</summary>
        void PersistCache();
    }
}
