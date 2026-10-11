using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Core.Serial.Recovery
{
    /// <summary>
    /// Copies a version reply's identity and hardware fields onto a <see cref="Cart"/> - the same
    /// mapping <c>CartFinder.ValidateAndCreateDevice</c> uses when it first creates one, lifted here so
    /// recovery, the finder, and start confirm share it. Storage availability is not part of this
    /// mapping: it comes from a separate probe, not a version-reply field.
    /// </summary>
    public static class VersionReplyMapper
    {
        public static void Apply(VersionReply reply, Cart cart)
        {
            cart.DeviceId = reply.ChipId;
            cart.FwVersion = reply.FirmwareVersion?.ToString() ?? "";
            cart.IsCompatible = VersionReplyParser.IsCompatible(reply) && !reply.IsMinimalFirmware;
            cart.HardwareVariant = reply.HardwareVariant;
            cart.IsMinimalFirmware = reply.IsMinimalFirmware;
            cart.BuildTimestamp = reply.BuildTimestamp;
            cart.CpuMhz = reply.CpuMhz;
            cart.TemperatureC = reply.TemperatureC;
            cart.Machine = reply.Machine;
            cart.VideoStandard = reply.VideoStandard;
            cart.TodClockHz = reply.TodClockHz;
        }
    }
}
