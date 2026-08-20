using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Core.Storage.Index.Fixtures
{
    /// <summary>
    /// The header line of an index fixture: which device and storage the listing was captured from, and how
    /// many file records follow.
    /// </summary>
    public sealed record IndexFixtureHeader(int Version, string DeviceId, TeensyStorageType StorageType, int FileCount);

    /// <summary>
    /// A single file entry from an index fixture. Content identity is size plus filename; directories are
    /// implied by the path, so nothing else is carried.
    /// </summary>
    public sealed record IndexFixtureRecord(string Path, string Name, long Size);
}
