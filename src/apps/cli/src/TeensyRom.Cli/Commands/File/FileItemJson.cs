using System.Text.Json;
using System.Text.Json.Nodes;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Commands.File;

/// <summary>
/// A file as the <c>file</c> commands write it in JSON by default: the compact form used in lists. <c>path</c> and
/// <c>storage</c> are what another command needs to find it again, for example <c>trom file launch -</c> reading
/// <c>path</c> from a pipe. <see cref="Full"/> writes everything tr-web knows about the file.
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
    string ShareUrl,
    string? PlayLength = null)
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
        item.ShareUrl,
        PlayLengthOf(item));

    /// <summary>
    /// The file with every field tr-web returned for it, as an object: the engine's own record (any field it adds later
    /// comes along) with only what the CLI owns laid over it: <c>storage</c>, <c>fileType</c> and <c>isCompatible</c>.
    /// Without an API record this is the compact form.
    /// </summary>
    public static JsonObject Full(IFileItem item, TeensyStorageType storage)
    {
        if (item.ApiRecord is null) return JsonSerializer.SerializeToNode(From(item, storage), CliJson.Indented)!.AsObject();

        var record = JsonSerializer.SerializeToNode(item.ApiRecord, CliJson.Indented)!.AsObject();
        record.Remove("storageType");

        record["storage"] = StorageName(storage);
        record["fileType"] = JsonSerializer.SerializeToNode(item.FileType, CliJson.Indented);
        record["isCompatible"] = item.IsCompatible;

        return record;
    }

    /// <summary>The storage as the commands write and accept it: <c>sd</c> or <c>usb</c>.</summary>
    public static string StorageName(TeensyStorageType storage) => storage == TeensyStorageType.USB ? "usb" : "sd";

    private static string? PlayLengthOf(IFileItem item)
    {
        if (item.ApiRecord is { } record) return string.IsNullOrEmpty(record.PlayLength) ? null : record.PlayLength;

        return item switch
        {
            SongItem song => song.PlayLength.ToString("c"),
            GameItem game => game.PlayLength.ToString("c"),
            ImageItem image => image.PlayLength.ToString("c"),
            _ => null
        };
    }
}

/// <summary>A directory in the JSON of <c>trom file ls</c>.</summary>
internal sealed record DirectoryItemJson(string Name, string Path, string Storage);

/// <summary>The JSON result of <c>trom file ls</c>. Each file is a <see cref="FileItemJson"/>, or its full record with <c>--full</c>.</summary>
internal sealed record FileListingJson(string Path, string Storage, IReadOnlyList<DirectoryItemJson> Directories, IReadOnlyList<object> Files);

/// <summary>
/// The JSON result of a launch: <c>launched</c>, or <c>incompatible</c> when tr-web answered but the TeensyROM can't run
/// the file (which also ends the command with exit code 1). <c>file</c> is the full record, see <see cref="FileItemJson.Full"/>.
/// </summary>
internal sealed record FileLaunchJson(LaunchStatus Status, JsonObject File, string? Message);
