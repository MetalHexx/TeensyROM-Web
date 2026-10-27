namespace TeensyRom.Core.Abstractions
{
    /// <summary>Which transfer job holds a device's lease right now. The lease coordinator is the one record of it.</summary>
    public interface IDeviceTransferLease
    {
        /// <summary>The holding job's id, or null when the device is free.</summary>
        string? GetActiveJobId(string deviceId);
    }
}
