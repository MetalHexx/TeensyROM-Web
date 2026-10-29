using System.Net;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using RadEndpoints.Testing;
using TeensyRom.Api.Endpoints.Themes.ApplyDeviceTheme;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Serial.Commands.Composite.ApplyThemeColors;
using TeensyRom.Core.Themes;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Themes;

public class ApplyDeviceThemeEndpointTests
{
    private const string DeviceId = "ABCD2345";
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly IMediator _mediator = Substitute.For<IMediator>();
    private readonly IThemeStore _store = Substitute.For<IThemeStore>();

    private void GivenDevice()
    {
        var device = new TeensyRomDevice(
            new Cart { DeviceId = DeviceId },
            Substitute.For<ICommunicationPort>(),
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>());
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
    }

    private void GivenResult(ApplyThemeColorsResult result) =>
        _mediator.Send(Arg.Any<ApplyThemeColorsCommand>(), Arg.Any<CancellationToken>()).Returns(result);

    private ApplyDeviceThemeEndpoint Endpoint() =>
        EndpointFactory.CreateEndpoint<ApplyDeviceThemeEndpoint>(_deviceManager, _mediator, _store);

    private static ApplyDeviceThemeRequest Request(string? themeId = null, int color = 3) => new()
    {
        DeviceId = DeviceId,
        Body = new() { Colors = ThemeTestData.ColorsDto(color), ThemeId = themeId }
    };

    [Fact]
    public async Task Handle_Succeeds_SendsTheColorsAndRecordsThem()
    {
        GivenDevice();
        GivenResult(new ApplyThemeColorsResult());
        var endpoint = Endpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response.Record.IsRecorded.Should().BeTrue();
        endpoint.Response.Record.Colors.Should().Be(ThemeTestData.ColorsDto());
        await _mediator.Received().Send(
            Arg.Is<ApplyThemeColorsCommand>(c => c.DeviceId == DeviceId && c.Colors == ThemeTestData.Colors(3)),
            Arg.Any<CancellationToken>());
        _store.Received().SaveDeviceRecord(Arg.Is<DeviceThemeRecord>(r => r.DeviceId == DeviceId && r.Colors == ThemeTestData.Colors(3)));
    }

    [Fact]
    public async Task Handle_ThemeWithTheAppliedColors_RecordsItsId()
    {
        GivenDevice();
        GivenResult(new ApplyThemeColorsResult());
        _store.GetTheme("mine").Returns(ThemeTestData.Custom(color: 3));
        var endpoint = Endpoint();

        await endpoint.Handle(Request("mine", color: 3), CancellationToken.None);

        endpoint.Response.Record.ThemeId.Should().Be("mine");
        _store.Received().SaveDeviceRecord(Arg.Is<DeviceThemeRecord>(r => r.ThemeId == "mine"));
    }

    [Fact]
    public async Task Handle_ThemeWhoseColorsDiffer_DropsTheThemeId()
    {
        GivenDevice();
        GivenResult(new ApplyThemeColorsResult());
        _store.GetTheme("mine").Returns(ThemeTestData.Custom(color: 3));
        var endpoint = Endpoint();

        await endpoint.Handle(Request("mine", color: 9), CancellationToken.None);

        endpoint.Response.Record.ThemeId.Should().BeNull();
        _store.Received().SaveDeviceRecord(Arg.Is<DeviceThemeRecord>(r => r.ThemeId == null));
    }

    [Fact]
    public async Task Handle_UnknownTheme_DropsTheThemeId()
    {
        GivenDevice();
        GivenResult(new ApplyThemeColorsResult());
        var endpoint = Endpoint();

        await endpoint.Handle(Request("ghost"), CancellationToken.None);

        endpoint.Response.Record.ThemeId.Should().BeNull();
    }

    [Fact]
    public async Task Handle_RecordWriteFails_StillAnswersOk()
    {
        GivenDevice();
        GivenResult(new ApplyThemeColorsResult());
        _store.SaveDeviceRecord(Arg.Any<DeviceThemeRecord>()).Returns(false);
        var endpoint = Endpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response.Record.IsRecorded.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_UnknownDevice_SendsNotFoundAndSendsNothing()
    {
        var endpoint = Endpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
        await _mediator.DidNotReceiveWithAnyArgs().Send(default(ApplyThemeColorsCommand)!, default);
    }

    [Fact]
    public async Task Handle_DeviceBusyWithTransfer_SendsTheSharedConflictAndRecordsNothing()
    {
        GivenDevice();
        GivenResult(new ApplyThemeColorsResult { IsSuccess = false, Error = "busy", ActiveTransferJobId = LeaseDoubles.JobId });
        var endpoint = Endpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.Conflict);
        endpoint.GetProblem<ProblemHttpResult>().ShouldBeDeviceBusy(DeviceId);
        _store.DidNotReceiveWithAnyArgs().SaveDeviceRecord(default!);
    }

    [Fact]
    public async Task Handle_CommandFails_SendsBadGatewayAndRecordsNothing()
    {
        GivenDevice();
        GivenResult(new ApplyThemeColorsResult { IsSuccess = false, Error = "The device refused a color" });
        var endpoint = Endpoint();

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.BadGateway);
        _store.DidNotReceiveWithAnyArgs().SaveDeviceRecord(default!);
    }
}
