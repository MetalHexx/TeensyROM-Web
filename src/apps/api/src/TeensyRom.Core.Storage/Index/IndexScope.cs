using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Core.Storage.Index
{
    /// <summary>
    /// Identifies the device and storage partition an index operation applies to. A single database serves
    /// every device and storage; the scope is what keeps their rows apart.
    /// </summary>
    public readonly record struct IndexScope(string DeviceId, TeensyStorageType StorageType);
}
