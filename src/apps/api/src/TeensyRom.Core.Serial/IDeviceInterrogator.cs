using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial
{
    /// <summary>
    /// Wraps the raw discovery routines so a caller can ask "who are you?" and "is your storage there?"
    /// without owning a port, keeping discovery unit-testable.
    /// </summary>
    public interface IDeviceInterrogator
    {
        /// <summary>Never throws; a failed or empty reply yields an empty <see cref="VersionReply"/>.</summary>
        VersionReply ReadVersion(ICommunicationPort port);

        /// <summary>Never throws.</summary>
        StoragePresence ProbeStorage(ICommunicationPort port, TeensyStorageType storageType);
    }
}
