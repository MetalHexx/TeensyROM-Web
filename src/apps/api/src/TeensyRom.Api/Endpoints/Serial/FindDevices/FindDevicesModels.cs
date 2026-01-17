using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.FindCarts
{
    /// <summary>
    /// Request model for finding available TeensyROM devices.
    /// </summary>
    public class FindDevicesRequest
    {
        /// <summary>
        /// If true, performs a full network/port scan. If false (default), uses cached TCP endpoints for faster discovery.
        /// Serial COM ports are always fully scanned regardless of this setting.
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
