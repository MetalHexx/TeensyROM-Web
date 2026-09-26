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
        /// <param name="port">The port to interrogate.</param>
        /// <param name="ackTimeoutMs">How long to wait for the Ack - longer only where the Teensy is known to be busy.</param>
        VersionReply ReadVersion(ICommunicationPort port, int ackTimeoutMs = TRDiscoveryRoutines.VersionAckTimeoutMs);

        /// <summary>Never throws. <see cref="StoragePresence.Busy"/> means the device answered but couldn't service the listing - try again later, not "no storage".</summary>
        StoragePresence ProbeStorage(ICommunicationPort port, TeensyStorageType storageType);
    }
}
