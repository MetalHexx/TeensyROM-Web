using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Entities.Device
{
    public class Cart
    {
        public string? DeviceId { get; set; }
        public string Name { get; set; } = "Unnamed";
        public string FwVersion { get; set; } = string.Empty;
        public bool IsCompatible { get; set; }
        public HardwareVariant HardwareVariant { get; set; } = HardwareVariant.Unknown;
        public bool IsMinimalFirmware { get; set; }
        public string BuildTimestamp { get; set; } = string.Empty;
        public int? CpuMhz { get; set; }
        public decimal? TemperatureC { get; set; }
        public MachineType Machine { get; set; } = MachineType.Unknown;
        public VideoStandard VideoStandard { get; set; } = VideoStandard.Unknown;
        public int? TodClockHz { get; set; }
        public CartStorage SdStorage { get; set; } = new(TeensyStorageType.SD, available: false);
        public CartStorage UsbStorage { get; set; } = new(TeensyStorageType.USB, available: false);
    }
}
