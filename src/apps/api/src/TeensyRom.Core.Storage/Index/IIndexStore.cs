using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Storage.Index
{
    /// <summary>
    /// The index store's mutation and read surface. Every member is scoped to one device and storage.
    /// </summary>
    public interface IIndexStore
    {
        /// <summary>
        /// Creates the storage row for <paramref name="scope"/> if it is missing and returns its id. Idempotent.
        /// </summary>
        Task<int> EnsureStorageAsync(IndexScope scope, CancellationToken ct);

        /// <summary>
        /// Inserts or updates one file, creating its parent directory chain and refreshing its search row.
        /// </summary>
        Task UpsertFileAsync(IndexScope scope, FileItem file, CancellationToken ct);

        /// <summary>
        /// Inserts or updates many files in fixed-size transactions, so an interruption leaves a coherent
        /// prefix of the load rather than nothing.
        /// </summary>
        Task UpsertFilesAsync(IndexScope scope, IReadOnlyCollection<FileItem> files, CancellationToken ct);

        /// <summary>
        /// Inserts the directory and any missing ancestors.
        /// </summary>
        Task UpsertDirectoryAsync(IndexScope scope, DirectoryPath path, CancellationToken ct);

        /// <summary>
        /// Inserts the directory's missing ancestors, up to and including the root.
        /// </summary>
        Task EnsureParentsAsync(IndexScope scope, DirectoryPath path, CancellationToken ct);

        /// <summary>
        /// Removes one file, its search row, and re-establishes the favourite flag for its content identity.
        /// </summary>
        Task DeleteFileAsync(IndexScope scope, FilePath path, CancellationToken ct);

        /// <summary>
        /// Removes one directory and the files directly inside it. Subdirectories are left alone.
        /// </summary>
        Task DeleteDirectoryAsync(IndexScope scope, DirectoryPath path, CancellationToken ct);

        /// <summary>
        /// Removes a directory and everything beneath it by path prefix.
        /// </summary>
        Task DeleteDirectoryWithChildrenAsync(IndexScope scope, DirectoryPath path, CancellationToken ct);

        /// <summary>
        /// Removes every directory, file, and search row for the scope. The storage row and its id survive.
        /// </summary>
        Task ClearAsync(IndexScope scope, CancellationToken ct);

        /// <summary>
        /// Re-establishes the favourite invariant — a row is favourited if and only if a row sharing its
        /// content identity exists under a favourites path — and returns the number of rows corrected.
        /// </summary>
        Task<int> RepairFavoritesAsync(IndexScope scope, CancellationToken ct);

        /// <summary>
        /// Returns the directory at <paramref name="path"/> with its child directories and files, both
        /// ordered by name, or <see langword="null"/> when the directory is not indexed.
        /// </summary>
        Task<IStorageCacheItem?> GetDirectoryAsync(IndexScope scope, DirectoryPath path, CancellationToken ct);

        /// <summary>
        /// Returns the file at <paramref name="path"/>, or <see langword="null"/> when it is not indexed.
        /// </summary>
        Task<FileItem?> GetFileByPathAsync(IndexScope scope, FilePath path, CancellationToken ct);

        /// <summary>
        /// Returns every file in the storage whose name matches <paramref name="name"/>.
        /// </summary>
        Task<List<FileItem>> GetFilesByNameAsync(IndexScope scope, string name, CancellationToken ct);

        /// <summary>
        /// Full-text searches file name, path, title, creator, and description for <paramref name="searchText"/>,
        /// filtered to <paramref name="fileTypes"/> and excluding any path under <paramref name="excludePaths"/>.
        /// An empty <paramref name="fileTypes"/> means every launchable type.
        /// </summary>
        Task<List<LaunchableItem>> SearchAsync(IndexScope scope, string searchText,
                                               IReadOnlyCollection<DirectoryPath> excludePaths,
                                               TeensyFileType[] fileTypes, int limit, CancellationToken ct);

        /// <summary>
        /// Returns one random file from <paramref name="scopePath"/> under <paramref name="storageScope"/>,
        /// filtered to <paramref name="fileTypes"/> and excluding any path under <paramref name="excludePaths"/>.
        /// An empty <paramref name="fileTypes"/> means every launchable type.
        /// </summary>
        Task<LaunchableItem?> GetRandomFileAsync(IndexScope scope, StorageScope storageScope, DirectoryPath scopePath,
                                                 IReadOnlyCollection<DirectoryPath> excludePaths,
                                                 TeensyFileType[] fileTypes, CancellationToken ct);

        /// <summary>
        /// Returns the first copy of <paramref name="file"/>'s content identity that sits outside every
        /// favourite and playlist tree — the linked copy's original location — or <see langword="null"/> when
        /// none exists.
        /// </summary>
        Task<FileItem?> FindParentFileAsync(IndexScope scope, FileItem file, CancellationToken ct);

        /// <summary>
        /// Returns every other copy of <paramref name="file"/>'s content identity that sits under a favourite
        /// or playlist tree.
        /// </summary>
        Task<List<FileItem>> FindSiblingsAsync(IndexScope scope, FileItem file, CancellationToken ct);

        /// <summary>
        /// Returns every file whose path sits under a favourite tree.
        /// </summary>
        Task<List<LaunchableItem>> GetFavoriteFilesAsync(IndexScope scope, CancellationToken ct);

        /// <summary>
        /// Returns every file whose path sits under the playlist tree.
        /// </summary>
        Task<List<LaunchableItem>> GetPlaylistFilesAsync(IndexScope scope, CancellationToken ct);

        /// <summary>
        /// Returns the number of indexed files in the scope.
        /// </summary>
        Task<int> GetFileCountAsync(IndexScope scope, CancellationToken ct);
    }
}
