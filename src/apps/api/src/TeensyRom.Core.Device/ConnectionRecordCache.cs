using System.Reflection;
using System.Text.Json;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Device;

/// <summary>
/// A confirmed connection record as persisted to the whole-file cache.
/// </summary>
public sealed record CachedConnectionRecord(string ChipId, string? SerialPortName, string? TcpEndpoint, ConnectionType TransportInUse);

/// <summary>
/// Whole-file cache of confirmed device connection records, read by the API start occasion to
/// reconnect without a fresh discovery scan.
/// </summary>
public interface IConnectionRecordCache
{
    /// <summary>Null when the file is missing, unreadable, or empty - the caller treats every case as "no cache".</summary>
    IReadOnlyList<CachedConnectionRecord>? Load();

    /// <summary>Replaces the file whole. Rows without a real chip id (stand-ins) are dropped by the writer.</summary>
    void Save(IEnumerable<CachedConnectionRecord> records);

    /// <summary>Deletes the file.</summary>
    void Clear();
}

/// <inheritdoc cref="IConnectionRecordCache"/>
public sealed class ConnectionRecordCache : IConnectionRecordCache
{
    private const string _unknownDeviceIdBase = "Unknown";

    private readonly ILoggingService _log;
    private readonly string _cacheFilePath;
    private readonly object _lock = new();

    public ConnectionRecordCache(ILoggingService log)
        : this(log, Path.Combine(Assembly.GetExecutingAssembly().GetDataPath(), "Assets/System/Config/ConnectionRecords.json"))
    {
    }

    public ConnectionRecordCache(ILoggingService log, string cacheFilePath)
    {
        _log = log;
        _cacheFilePath = cacheFilePath;
    }

    public IReadOnlyList<CachedConnectionRecord>? Load()
    {
        lock (_lock)
        {
            if (!File.Exists(_cacheFilePath))
            {
                return null;
            }

            try
            {
                var content = File.ReadAllText(_cacheFilePath);
                var file = JsonSerializer.Deserialize<ConnectionRecordFile>(content);

                if (file is null || file.Records.Count == 0)
                {
                    return null;
                }

                return file.Records;
            }
            catch (Exception ex)
            {
                _log.InternalError($"ConnectionRecordCache: Failed to load connection record cache: {ex.Message}");
                return null;
            }
        }
    }

    public void Save(IEnumerable<CachedConnectionRecord> records)
    {
        lock (_lock)
        {
            try
            {
                var file = new ConnectionRecordFile
                {
                    LastUpdated = DateTime.UtcNow,
                    Records = records.Where(r => IsRealChipId(r.ChipId)).ToList()
                };

                var directory = Path.GetDirectoryName(_cacheFilePath);
                if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                var json = JsonSerializer.Serialize(file, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_cacheFilePath, json);

                _log.Internal($"ConnectionRecordCache: Saved {file.Records.Count} connection record(s) to cache: {_cacheFilePath}");
            }
            catch (Exception ex)
            {
                _log.InternalError($"ConnectionRecordCache: Failed to save connection record cache: {ex.Message}");
            }
        }
    }

    public void Clear()
    {
        lock (_lock)
        {
            if (File.Exists(_cacheFilePath))
            {
                File.Delete(_cacheFilePath);
            }
        }
    }

    /// <summary>False for the display-only "Unknown"/"Unknown-2" stand-ins CartFinder assigns per run.</summary>
    private static bool IsRealChipId(string chipId) =>
        !string.IsNullOrWhiteSpace(chipId) && chipId != _unknownDeviceIdBase && !chipId.StartsWith($"{_unknownDeviceIdBase}-");

    private sealed record ConnectionRecordFile
    {
        public DateTime LastUpdated { get; init; } = DateTime.UtcNow;
        public List<CachedConnectionRecord> Records { get; init; } = [];
    }
}
