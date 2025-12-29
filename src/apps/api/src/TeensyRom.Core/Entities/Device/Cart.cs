using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Entities.Device
{
    public class Cart
    {
        public string? DeviceId { get; set; }
        public ConnectionType ConnectionType { get; set; } = ConnectionType.Serial;
        public string ComPort { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public int TcpPort { get; set; } = 80;
        public string Name { get; set; } = "Unnamed";
        public string FwVersion { get; set; } = string.Empty;
        public bool IsCompatible { get; set; }
        public CartStorage SdStorage { get; set; } = new(TeensyStorageType.SD, available: false);
        public CartStorage UsbStorage { get; set; } = new(TeensyStorageType.USB, available: false);
    }
}
