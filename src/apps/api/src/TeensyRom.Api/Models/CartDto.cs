using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Settings;

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
        public static async Task<CartDto> FromDevice(TeensyRomDevice device)
        {
            return new CartDto
            {
                DeviceId = device.DeviceId ?? string.Empty,
                ComPort = device.Cart.ComPort,
                ConnectionType = device.Cart.ConnectionType,
                IpAddress = device.Cart.IpAddress,
                TcpPort = device.Cart.TcpPort,
                Name = device.Cart.Name,
                FwVersion = device.Cart.FwVersion,
                IsCompatible = device.Cart.IsCompatible,
                SdStorage = CartStorageDto.FromStorage(device.Cart.SdStorage),
                UsbStorage = CartStorageDto.FromStorage(device.Cart.UsbStorage)
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
        /// Creates a <see cref="CartStorageDto"/> from a <see cref="CartStorage"/> entity.
        /// </summary>
        public static CartStorageDto FromStorage(CartStorage storage)
        {
            return new ()
            {
                DeviceId = storage.DeviceId,
                Type = storage.Type,
                Available = storage.Available
            };
        }
    }
}
