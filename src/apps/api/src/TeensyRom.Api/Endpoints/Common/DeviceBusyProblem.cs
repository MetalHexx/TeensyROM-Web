using Microsoft.AspNetCore.Http.HttpResults;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Api.Endpoints.Common
{
    /// <summary>The one answer every endpoint gives when a device is busy with a transfer.</summary>
    public static class DeviceBusyProblem
    {
        public const string Type = "urn:teensyrom:problem:device-busy-with-transfer";
        public const string Code = "deviceBusyWithTransfer";

        public static ProblemHttpResult Create(string deviceId, string? deviceName, string activeJobId, string? detail = null) =>
            TypedResults.Problem(
                title: $"{deviceName ?? deviceId} is busy with a transfer.",
                statusCode: StatusCodes.Status409Conflict,
                type: Type,
                detail: detail,
                extensions: new Dictionary<string, object?>
                {
                    ["code"] = Code,
                    ["deviceId"] = deviceId,
                    ["activeJobId"] = activeJobId
                });

        /// <summary>The shared answer when the device holds a transfer lease right now; null when it is free.</summary>
        public static ProblemHttpResult? For(IDeviceTransferLease lease, string deviceId, string? deviceName) =>
            lease.GetActiveJobId(deviceId) is { } jobId ? Create(deviceId, deviceName, jobId) : null;
    }
}
