using TeensyRom.Cli.Services;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Commands.File;

/// <summary>
/// A file as every <c>file</c> command writes it in JSON. <c>path</c> and <c>storage</c> are what another command
/// needs to find it again, for example <c>trom file launch -</c> reading <c>path</c> from a pipe.
/// </summary>
internal sealed record FileItemJson(
    string Name,
    string Path,
    string Storage,
    TeensyFileType FileType,
    long Size,
    bool IsFavorite,
    bool IsCompatible,
    string Title,
    string Creator,
    string ReleaseInfo,
    string ShareUrl)
{
    public static FileItemJson From(IFileItem item, TeensyStorageType storage) => new(
        item.Name,
        item.Path,
        StorageName(storage),
        item.FileType,
        item.Size,
        item.IsFavorite,
        item.IsCompatible,
        item.Title,
        item.Creator,
        item.ReleaseInfo,
        item.ShareUrl);

    /// <summary>The storage as the commands write and accept it: <c>sd</c> or <c>usb</c>.</summary>
    public static string StorageName(TeensyStorageType storage) => storage == TeensyStorageType.USB ? "usb" : "sd";
}

/// <summary>A directory in the JSON of <c>trom file ls</c>.</summary>
internal sealed record DirectoryItemJson(string Name, string Path, string Storage);

/// <summary>The JSON result of <c>trom file ls</c>.</summary>
internal sealed record FileListingJson(string Path, string Storage, IReadOnlyList<DirectoryItemJson> Directories, IReadOnlyList<FileItemJson> Files);

/// <summary>
/// The JSON result of a launch: <c>launched</c>, or <c>incompatible</c> when tr-web answered but the TeensyROM can't run
/// the file (which also ends the command with exit code 1).
/// </summary>
internal sealed record FileLaunchJson(LaunchStatus Status, FileItemJson File, string? Message);
