using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using TeensyRom.Api.Endpoints.Common;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Api.Tests.Unit.Endpoints;

/// <summary>Lease substitutes and the shared busy-answer assertion for endpoint tests.</summary>
internal static class LeaseDoubles
{
    public const string JobId = "job-1";

    /// <summary>NSubstitute answers a string-returning member with "", which would read as a held lease.</summary>
    public static IDeviceTransferLease Free()
    {
        var lease = Substitute.For<IDeviceTransferLease>();
        lease.GetActiveJobId(Arg.Any<string>()).Returns((string?)null);
        return lease;
    }

    public static IDeviceTransferLease Busy(string jobId = JobId)
    {
        var lease = Substitute.For<IDeviceTransferLease>();
        lease.GetActiveJobId(Arg.Any<string>()).Returns(jobId);
        return lease;
    }

    public static void ShouldBeDeviceBusy(this ProblemHttpResult result, string deviceId, string jobId = JobId)
    {
        result.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        result.ProblemDetails.Type.Should().Be(DeviceBusyProblem.Type);
        result.ProblemDetails.Extensions["code"].Should().Be(DeviceBusyProblem.Code);
        result.ProblemDetails.Extensions["deviceId"].Should().Be(deviceId);
        result.ProblemDetails.Extensions["activeJobId"].Should().Be(jobId);
    }
}
