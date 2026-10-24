using TeensyRom.Cli.Player;

namespace TeensyRom.Cli.Tests;

/// <summary>An <see cref="ILastLaunchStore"/> that keeps its records in memory and counts the saves, for tests of what writes the record.</summary>
internal sealed class InMemoryLastLaunchStore : ILastLaunchStore
{
    private readonly Dictionary<string, LastLaunchRecord> _records = [];

    /// <summary>How many times <see cref="Save"/> was called; <see cref="Seed"/> is not counted.</summary>
    public int SaveCount { get; private set; }

    /// <summary>Puts a record there as an earlier <c>trom</c> run would have left it.</summary>
    public void Seed(LastLaunchRecord record) => _records[record.DeviceId] = record;

    public LastLaunchRecord? Load(string deviceId) => _records.GetValueOrDefault(deviceId);

    public LastLaunchRecord? Find(string device) =>
        _records.Values.SingleOrDefault(record => record.DeviceId == device || string.Equals(record.DeviceName, device, StringComparison.OrdinalIgnoreCase));

    public void Save(LastLaunchRecord record)
    {
        SaveCount++;
        _records[record.DeviceId] = record;
    }

    public void MarkStopped(string deviceId)
    {
        if (Load(deviceId) is { } record) _records[deviceId] = record with { PlayState = PlayState.Stopped };
    }
}
