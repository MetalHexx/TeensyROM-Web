using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial
{
    public class DeviceInterrogator(ILoggingService log) : IDeviceInterrogator
    {
        public VersionReply ReadVersion(ICommunicationPort port) =>
            VersionReplyParser.Parse(port.ReadVersionReply(log));

        public StoragePresence ProbeStorage(ICommunicationPort port, TeensyStorageType storageType) =>
            port.ProbeStorageRoot(storageType, log);
    }
}
