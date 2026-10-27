using Microsoft.AspNetCore.Http.HttpResults;
using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.Transfers.CreateJob;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Transfers;

public class CreateJobEndpointTests
{
    private const string DeviceId = "ABCD2345";
    private readonly ITransferJobService _jobs = Substitute.For<ITransferJobService>();
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();

    private static CreateJobRequest Request() => new()
    {
        DeviceId = DeviceId,
        StorageType = TeensyStorageType.SD,
        Body = new CreateJobBody { DestinationDirectory = "/music/incoming" }
    };

    [Fact]
    public async Task Handle_DeviceHeldByAnotherJob_SendsTheSharedConflictWithDetailAndDeviceName()
    {
        _jobs.Start(Arg.Any<TransferJobStart>()).Returns(
            new TransferStartResult(null, TransferStartError.DeviceBusy, "Already transferring.", LeaseDoubles.JobId));
        var device = new TeensyRomDevice(
            new Cart { DeviceId = DeviceId, Name = "Bench C64" },
            Substitute.For<ICommunicationPort>(),
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>());
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        var endpoint = EndpointFactory.CreateEndpoint<CreateJobEndpoint>(_jobs, _deviceManager);

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.Conflict);
        var problem = endpoint.GetProblem<ProblemHttpResult>();
        problem.ShouldBeDeviceBusy(DeviceId);
        problem.ProblemDetails.Title.Should().Be("Bench C64 is busy with a transfer.");
        problem.ProblemDetails.Detail.Should().Be("Already transferring.");
    }
}
