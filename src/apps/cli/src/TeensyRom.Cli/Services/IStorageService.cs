using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Services;

/// <summary>
/// The selected TeensyROM's storage as tr-web serves it: directories, search, indexing, favorites and bans.
/// </summary>
/// <remarks>Every failure arrives as a <see cref="Api.TeensyApiException"/> carrying tr-web's own wording.</remarks>
internal interface IStorageService
{
    /// <summary>The storage every call works against.</summary>
    TeensyStorageType StorageType { get; }

    /// <summary>Works against another storage from now on and saves it as the CLI's default-storage preference.</summary>
    void SwitchStorage(TeensyStorageType storageType);

    /// <summary>Works against another storage for this session only; the saved default-storage preference is left alone.</summary>
    void UseStorage(TeensyStorageType storageType);

    /// <summary>Lists one directory of the current storage.</summary>
    Task<DirectoryListing> GetDirectory(string path);

    /// <summary>
    /// The launchable file at exactly <paramref name="path"/> in the current storage, or null when its directory holds
    /// none by that path. Case is ignored, as FAT storage does.
    /// </summary>
    Task<ILaunchableItem?> GetFile(string path);

    /// <summary>Searches the current storage only; results that are not launchable are dropped.</summary>
    Task<IReadOnlyList<ILaunchableItem>> Search(string query, TeensyFilterType filter);

    /// <summary>Indexes a directory and everything below it; an empty path or "/" indexes the whole storage.</summary>
    Task Index(string path);

    /// <summary>Tags the file as a favorite and flips <see cref="IStorageItem.IsFavorite"/> on success.</summary>
    Task SaveFavorite(ILaunchableItem item);

    /// <summary>Untags the favorite and clears <see cref="IStorageItem.IsFavorite"/> on success.</summary>
    Task RemoveFavorite(ILaunchableItem item);

    /// <summary>
    /// Bans the file at <paramref name="path"/> through tr-web, which adds its name to the banned files. The file is
    /// never looked up here: banned files are invisible to listings, so a lookup would report an already-banned file
    /// as missing.
    /// </summary>
    /// <param name="storage">The storage the file is on, which is not necessarily <see cref="StorageType"/>.</param>
    Task<BanResult> BanFile(string path, TeensyStorageType storage);
}

/// <summary>What tr-web answered to a ban: the name now banned and whether it already was.</summary>
internal sealed record BanResult(string BannedFileName, bool AlreadyBanned, string Message);

/// <summary>
/// The directories and files directly inside one storage directory.
/// </summary>
internal sealed class DirectoryListing
{
    public string Path { get; set; } = string.Empty;
    public List<DirectoryItem> Directories { get; set; } = [];
    public List<IFileItem> Files { get; set; } = [];
}
