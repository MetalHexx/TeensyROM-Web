using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.FindCarts
{
    /// <summary>
    /// Request model for finding available TeensyROM devices.
    /// </summary>
    public class FindDevicesRequest
    {
        /// <summary>
        /// If true, runs a full discovery sweep (every COM port and the local subnet), disconnecting every
        /// currently connected device while it runs. If false (default), returns the devices already
        /// listed by the manager without contacting any device.
        /// </summary>
        [FromQuery] public bool FullScan { get; set; } = false;
    }

    /// <summary>
    /// Response model for finding available and connected TeensyROM devices.
    /// </summary>
    public class FindDevicesResponse
    {
        /// <summary>
        /// The list of TeensyROM devices that are available to connect.
        /// </summary>
        [Required] public List<CartDto> Devices { get; set; } = [];

        /// <summary>
        /// A message indicating the result of the operation.
        /// </summary>
        [Required] public string Message { get; set; } = "Success!";
    }
}
