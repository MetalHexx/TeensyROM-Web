using System.Text.Json;
using System.Text.Json.Serialization;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Logging;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Player;

/// <summary>A launched file as the record keeps it. <paramref name="Size"/> makes the restored item's id match the ones listings give.</summary>
internal sealed record LaunchedFile(string Path, long Size);

/// <summary>
/// What a device last launched and how its player was set, which is all one <c>trom</c> run needs to carry on from the
/// last. <paramref name="RandomIndex"/> is the position in <paramref name="RandomPicks"/> that previous and next walk from.
/// </summary>
internal sealed record LastLaunchRecord(
    string DeviceId,
    string DeviceName,
    TeensyStorageType Storage,
    LaunchedFile? Current,
    PlayMode Mode,
    string? SearchQuery,
    TeensyFilterType Filter,
    StorageScope Scope,
    string ScopePath,
    PlayState PlayState,
    IReadOnlyList<LaunchedFile> RandomPicks,
    int RandomIndex);

/// <summary>Keeps one <see cref="LastLaunchRecord"/> per device in the CLI's home, shared by every <c>trom</c> process.</summary>
internal interface ILastLaunchStore
{
    /// <summary>The device's record; null when there is none, or the file is missing, unreadable or another version.</summary>
    LastLaunchRecord? Load(string deviceId);

    /// <summary>The record for a device named by id, or by name ignoring case; null when none matches.</summary>
    /// <exception cref="CliException"><see cref="CliExitCode.Usage"/> when the name matches records of more than one device.</exception>
    LastLaunchRecord? Find(string device);

    /// <summary>Replaces this device's record. The file is written to a temp file beside it, then moved over it. Never throws: a failed write is logged.</summary>
    void Save(LastLaunchRecord record);

    /// <summary>Sets an existing record's <see cref="LastLaunchRecord.PlayState"/> to Stopped, after a reset made outside the player. No record: nothing happens.</summary>
    void MarkStopped(string deviceId);
}

/// <summary>
/// <see cref="ILastLaunchStore"/> over <see cref="TeensyRomHome.LastLaunchPath"/>: one JSON file for every device,
/// replaced atomically. Processes don't lock each other, so the last write wins.
/// </summary>
/// <remarks>
/// <c>trom wait --device</c> reads the file every 250 ms while other commands replace it, so readers open it with
/// <see cref="FileShare.Delete"/> and a replace that still collides is retried briefly.
/// </remarks>
internal sealed class LastLaunchStore(ILoggingService log) : ILastLaunchStore
{
    /// <summary>The most random picks a record keeps: the newest ones. The web app's player history keeps as many.</summary>
    public const int MaxRandomPicks = 1000;

    private const int FileVersion = 1;
    private const int MoveAttempts = 5;
    private static readonly TimeSpan MoveRetryDelay = TimeSpan.FromMilliseconds(20);

    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private sealed record Document(int Version, Dictionary<string, LastLaunchRecord> Devices);

    public LastLaunchRecord? Load(string deviceId) =>
        ReadDevices() is { } devices && devices.TryGetValue(deviceId, out var record) && IsUsable(record) ? record : null;

    public LastLaunchRecord? Find(string device)
    {
        if (ReadDevices() is not { } devices) return null;

        if (devices.TryGetValue(device, out var byId) && IsUsable(byId)) return byId;

        var named = devices.Values
            .Where(record => IsUsable(record) && string.Equals(record.DeviceName, device, StringComparison.OrdinalIgnoreCase))
            .ToList();

        return named.Count switch
        {
            0 => null,
            1 => named[0],
            _ => throw new CliException(CliExitCode.Usage, $"More than one TeensyROM is called {device} — use its id with --device instead.")
        };
    }

    public void Save(LastLaunchRecord record)
    {
        var path = TeensyRomHome.LastLaunchPath;
        var temp = $"{path}.{Guid.NewGuid():N}.tmp";

        try
        {
            var devices = ReadDevices() ?? [];
            devices[record.DeviceId] = Trimmed(record);

            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(temp, JsonSerializer.Serialize(new Document(FileVersion, devices), Options));
            MoveOver(temp, path);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or NotSupportedException or JsonException)
        {
            TryDelete(temp);
            log.InternalError($"Couldn't save {path}: {ex.Message}");
        }
    }

    public void MarkStopped(string deviceId)
    {
        if (Load(deviceId) is { } record) Save(record with { PlayState = PlayState.Stopped });
    }

    /// <summary>The file's devices; null when it is missing, unreadable or another version, all of which count as empty.</summary>
    private static Dictionary<string, LastLaunchRecord>? ReadDevices()
    {
        try
        {
            using var stream = new FileStream(TeensyRomHome.LastLaunchPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);

            return JsonSerializer.Deserialize<Document>(stream, Options) is { Version: FileVersion, Devices: { } devices } ? devices : null;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or NotSupportedException or JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// Whether a record read from the file can be used. The deserializer doesn't enforce non-nullable annotations, so a
    /// hand-edited file can hold nulls the player would throw on: those records read as missing.
    /// </summary>
    private static bool IsUsable(LastLaunchRecord? record) =>
        record is { DeviceId: not null, DeviceName: not null, ScopePath: not null, RandomPicks: not null }
        && (record.Current is null || HasPath(record.Current))
        && record.RandomPicks.All(HasPath);

    private static bool HasPath(LaunchedFile? file) => !string.IsNullOrEmpty(file?.Path);

    /// <summary>Keeps the newest <see cref="MaxRandomPicks"/> picks, moving <see cref="LastLaunchRecord.RandomIndex"/> with them.</summary>
    private static LastLaunchRecord Trimmed(LastLaunchRecord record)
    {
        var dropped = record.RandomPicks.Count - MaxRandomPicks;

        return dropped <= 0
            ? record
            : record with { RandomPicks = record.RandomPicks.Skip(dropped).ToList(), RandomIndex = Math.Max(-1, record.RandomIndex - dropped) };
    }

    private static void MoveOver(string temp, string path)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                File.Move(temp, path, overwrite: true);
                return;
            }
            catch (Exception ex) when (attempt < MoveAttempts && ex is IOException or UnauthorizedAccessException)
            {
                Thread.Sleep(MoveRetryDelay);
            }
        }
    }

    private static void TryDelete(string path)
    {
        try { File.Delete(path); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }
}
