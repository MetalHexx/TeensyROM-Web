using Microsoft.AspNetCore.Http.HttpResults;

namespace TeensyRom.Api.Endpoints.Common
{
    /// <summary>The answer when an operation needs a network device's USB serial port and it cannot be reached.</summary>
    public static class UsbUnreachableProblem
    {
        public const string Type = "urn:teensyrom:problem:usb-unreachable";
        public const string Code = "usbUnreachable";

        public static ProblemHttpResult Create(string deviceId, string? deviceName) =>
            TypedResults.Problem(
                title: $"{deviceName ?? deviceId} could not be reached over USB, so its ASID player was not started. The player turns the network off, so the cartridge needs its USB cable connected to this computer.",
                statusCode: StatusCodes.Status502BadGateway,
                type: Type,
                extensions: new Dictionary<string, object?>
                {
                    ["code"] = Code,
                    ["deviceId"] = deviceId
                });
    }
}
