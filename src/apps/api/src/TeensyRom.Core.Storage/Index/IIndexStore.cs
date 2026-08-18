using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Storage.Index
{
    /// <summary>
    /// The index store's mutation surface. Every member is scoped to one device and storage.
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
    }
}
