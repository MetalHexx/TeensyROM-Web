using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Core.Device
{
    /// <summary>
    /// Result of ensuring tags for both USB and SD storage on a TeensyROM device.
    /// Provides the canonical DeviceId and individual storage results.
    /// </summary>
    public class CartTagResult
    {
        /// <summary>
        /// Canonical device identifier for the TeensyROM unit.
        /// This is the authoritative DeviceId after conflict resolution.
        /// </summary>
        public string DeviceId { get; set; } = string.Empty;
        
        /// <summary>
        /// SD card storage tagging result.
        /// Contains DeviceId, availability status, and storage type.
        /// </summary>
        public CartStorage SdStorage { get; set; } = null!;
        
        /// <summary>
        /// USB drive storage tagging result.
        /// Contains DeviceId, availability status, and storage type.
        /// </summary>
        public CartStorage UsbStorage { get; set; } = null!;
    }
}
