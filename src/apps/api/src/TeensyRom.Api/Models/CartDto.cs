using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Api.Models
{

    /// <summary>
    /// Data transfer object representing a TeensyROM cartridge.
    /// </summary>
    public class CartDto
    {
        /// <summary>
        /// The unique ID of the TeensyROM device.
        /// </summary>
        [Required] public string DeviceId { get; set; } = string.Empty;

        /// <summary>
        /// Indicates whether the TeensyROM device is connected.
        /// </summary>
        [Required] public bool IsConnected { get; set; }
        [Required] public DeviceState DeviceState { get; set; }

        /// <summary>
        /// The COM port the device is connected to.
        /// </summary>
        [Required] public string ComPort { get; set; } = string.Empty;

        /// <summary>
        /// The connection type of the device (Serial or TCP).
        /// </summary>
        [Required] public ConnectionType ConnectionType { get; set; } = ConnectionType.Serial;

        /// <summary>
        /// The IP address of the device (for TCP connections).
        /// </summary>
        [Required] public string IpAddress { get; set; } = string.Empty;

        /// <summary>
        /// The TCP port of the device (for TCP connections).
        /// </summary>
        [Required] public int TcpPort { get; set; } = 80;

        /// <summary>
        /// The user-friendly name of the device.
        /// </summary>
        [Required] public string Name { get; set; } = "Unnamed";

        /// <summary>
        /// The firmware version of the device.
        /// </summary>
        [Required] public string FwVersion { get; set; } = string.Empty;

        /// <summary>
        /// Indicates whether the device is compatible with the current application version.
        /// </summary>
        [Required] public bool IsCompatible { get; set; }

        /// <summary>
        /// The TeensyROM hardware variant reported by the device.
        /// </summary>
        [Required] public HardwareVariant HardwareVariant { get; set; } = HardwareVariant.Unknown;

        /// <summary>
        /// Indicates whether the device is running minimal firmware rather than full firmware.
        /// </summary>
        [Required] public bool IsMinimalFirmware { get; set; }

        /// <summary>
        /// The firmware build timestamp reported by the device.
        /// </summary>
        [Required] public string BuildTimestamp { get; set; } = string.Empty;

        /// <summary>
        /// The reported Teensy CPU clock speed in MHz. Null when the device did not report it.
        /// </summary>
        public int? CpuMhz { get; set; }

        /// <summary>
        /// The reported Teensy temperature in degrees Celsius. Null when the device did not report it.
        /// </summary>
        public decimal? TemperatureC { get; set; }

        /// <summary>
        /// The host machine the cartridge is installed in.
        /// </summary>
        [Required] public MachineType Machine { get; set; } = MachineType.Unknown;

        /// <summary>
        /// The video standard of the host machine.
        /// </summary>
        [Required] public VideoStandard VideoStandard { get; set; } = VideoStandard.Unknown;

        /// <summary>
        /// The reported time-of-day clock frequency in Hz. Null when the device did not report it.
        /// </summary>
        public int? TodClockHz { get; set; }

        /// <summary>
        /// Information about the SD storage on the device.
        /// </summary>
        [Required] public CartStorageDto SdStorage { get; set; } = null!;

        /// <summary>
        /// Information about the USB storage on the device.
        /// </summary>
        [Required] public CartStorageDto UsbStorage { get; set; } = null!;

        /// <summary>
        /// Creates a <see cref="CartDto"/> from a <see cref="Cart"/> entity.
        /// </summary>
        public static async Task<CartDto> FromDevice(TeensyRomDevice device, IDeviceSettingsProvider settingsProvider)
        {
            // Get device settings to check indexing status
            var deviceSettings = settingsProvider.GetDeviceSettings(device.DeviceId ?? string.Empty);
            var indexingStatus = deviceSettings?.IndexingStatus;

            return new CartDto
            {
                DeviceId = device.DeviceId ?? string.Empty,
                ComPort = device.ComPort,
                ConnectionType = device.ConnectionType,
                IpAddress = device.IpAddress,
                TcpPort = device.TcpPort,
                Name = device.Cart.Name,
                FwVersion = device.Cart.FwVersion,
                IsCompatible = device.Cart.IsCompatible,
                HardwareVariant = device.Cart.HardwareVariant,
                IsMinimalFirmware = device.Cart.IsMinimalFirmware,
                BuildTimestamp = device.Cart.BuildTimestamp,
                CpuMhz = device.Cart.CpuMhz,
                TemperatureC = device.Cart.TemperatureC,
                Machine = device.Cart.Machine,
                VideoStandard = device.Cart.VideoStandard,
                TodClockHz = device.Cart.TodClockHz,
                SdStorage = CartStorageDto.FromStorage(device.Cart.SdStorage, indexingStatus?.SdLastIndexed),
                UsbStorage = CartStorageDto.FromStorage(device.Cart.UsbStorage, indexingStatus?.UsbLastIndexed)
            };
        }
    }

    /// <summary>
    /// Data transfer object representing storage information for a TeensyROM device.
    /// </summary>
    public class CartStorageDto
    {
        /// <summary>
        /// The unique ID of the TeensyROM device.
        /// </summary>
        [Required] public string DeviceId { get; set; } = string.Empty;

        /// <summary>
        /// The type of storage (SD or USB).
        /// </summary>
        [Required] public TeensyStorageType Type { get; set; }

        /// <summary>
        /// Indicates whether the storage is available.
        /// </summary>
        [Required] public bool Available { get; set; }

        /// <summary>
        /// Indicates whether this storage has been fully indexed.
        /// True = full index completed, False = requires indexing (default).
        /// Based on DeviceSettings.IndexingStatus timestamps.
        /// </summary>
        [Required] public bool IndexExists { get; set; }

        /// <summary>
        /// Creates a <see cref="CartStorageDto"/> from a <see cref="CartStorage"/> entity.
        /// </summary>
        /// <param name="storage">The cart storage entity.</param>
        /// <param name="lastIndexedTimestamp">The timestamp when this storage was last fully indexed. Null indicates never indexed.</param>
        public static CartStorageDto FromStorage(CartStorage storage, DateTime? lastIndexedTimestamp)
        {
            return new ()
            {
                DeviceId = storage.DeviceId,
                Type = storage.Type,
                Available = storage.Available,
                IndexExists = lastIndexedTimestamp != null
            };
        }
    }
}
