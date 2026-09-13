using Microsoft.AspNetCore.Http.HttpResults;
using RadEndpoints.Testing;
using System.Net;
using System.Net.Mime;
using TeensyRom.Api.Endpoints.Files.GetFileContent;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Files;

public class GetFileContentEndpointTests
{
    private const string DeviceId = "ABCD2345";
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly IStorageService _sdStorage = Substitute.For<IStorageService>();

    private TeensyRomDevice NewDevice(bool sdAvailable = true)
    {
        var cart = new Cart
        {
            DeviceId = DeviceId,
            SdStorage = new CartStorage(TeensyStorageType.SD, sdAvailable),
            UsbStorage = new CartStorage(TeensyStorageType.USB, false)
        };
        return new TeensyRomDevice(cart, Substitute.For<ICommunicationPort>(), _sdStorage, Substitute.For<IStorageService>());
    }

    private static GetFileContentRequest Request(string deviceId = DeviceId, string path = "/music/tune.sid") => new()
    {
        DeviceId = deviceId,
        StorageType = TeensyStorageType.SD,
        Path = path
    };

    [Fact]
    public async Task Handle_UnknownDevice_SendsNotFound()
    {
        _deviceManager.GetAvailableDevice("UNKNOWN1").Returns((TeensyRomDevice?)null);
        var endpoint = EndpointFactory.CreateEndpoint<GetFileContentEndpoint>(_deviceManager);

        await endpoint.Handle(Request(deviceId: "UNKNOWN1"), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
        endpoint.GetResult<NotFound<string>>().Value.Should().Be("The device UNKNOWN1 was not found.");
    }

    [Fact]
    public async Task Handle_UnavailableStorage_SendsNotFound()
    {
        var device = NewDevice(sdAvailable: false);
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        var endpoint = EndpointFactory.CreateEndpoint<GetFileContentEndpoint>(_deviceManager);

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
        endpoint.GetResult<NotFound<string>>().Value.Should().Be("The storage SD is not available.");
    }

    [Fact]
    public async Task Handle_ReadFileBytesNotFound_SendsNotFound()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.GetFile(Arg.Any<FilePath>()).Returns((FileItem?)null);
        _sdStorage.ReadFileBytes(Arg.Any<FilePath>(), Arg.Any<CancellationToken>())
            .Returns(FileBytesResult.Failure(FileBytesError.NotFound));
        var endpoint = EndpointFactory.CreateEndpoint<GetFileContentEndpoint>(_deviceManager);

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
        endpoint.GetResult<NotFound<string>>().Value.Should().Be("The file /music/tune.sid was not found.");
    }

    [Fact]
    public async Task Handle_ReadFileBytesFailed_SendsInternalError()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.GetFile(Arg.Any<FilePath>()).Returns((FileItem?)null);
        _sdStorage.ReadFileBytes(Arg.Any<FilePath>(), Arg.Any<CancellationToken>())
            .Returns(FileBytesResult.Failure(FileBytesError.Failed));
        var endpoint = EndpointFactory.CreateEndpoint<GetFileContentEndpoint>(_deviceManager);

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.InternalServerError);
        endpoint.GetResult<ProblemHttpResult>().ProblemDetails.Title
            .Should().Be("The file /music/tune.sid could not be read from the device.");
    }

    [Fact]
    public async Task Handle_MetadataSizeOverCap_SendsPayloadTooLargeWithoutReadingFile()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.GetFile(Arg.Any<FilePath>()).Returns(new FileItem { Size = GetFileContentEndpoint.MaxFileBytes + 1 });
        var endpoint = EndpointFactory.CreateEndpoint<GetFileContentEndpoint>(_deviceManager);

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.RequestEntityTooLarge);
        await _sdStorage.DidNotReceive().ReadFileBytes(Arg.Any<FilePath>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_MetadataNull_StillReadsFileAndSucceeds()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.GetFile(Arg.Any<FilePath>()).Returns((FileItem?)null);
        var bytes = new byte[] { 1, 2, 3 };
        _sdStorage.ReadFileBytes(Arg.Any<FilePath>(), Arg.Any<CancellationToken>())
            .Returns(FileBytesResult.Success(bytes));
        var endpoint = EndpointFactory.CreateEndpoint<GetFileContentEndpoint>(_deviceManager);

        await endpoint.Handle(Request(), CancellationToken.None);

        await _sdStorage.Received(1).ReadFileBytes(Arg.Any<FilePath>(), Arg.Any<CancellationToken>());
        endpoint.Received(1).SendBytes(Arg.Is<GetFileContentResponse>(r =>
            ReferenceEquals(r.Bytes, bytes) &&
            r.ContentType == MediaTypeNames.Application.Octet &&
            r.FileDownloadName == "tune.sid"));
    }

    [Fact]
    public async Task Handle_BytesOverCap_SendsPayloadTooLarge()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.GetFile(Arg.Any<FilePath>()).Returns((FileItem?)null);
        var bytes = new byte[GetFileContentEndpoint.MaxFileBytes + 1];
        _sdStorage.ReadFileBytes(Arg.Any<FilePath>(), Arg.Any<CancellationToken>())
            .Returns(FileBytesResult.Success(bytes));
        var endpoint = EndpointFactory.CreateEndpoint<GetFileContentEndpoint>(_deviceManager);

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.RequestEntityTooLarge);
    }

    [Fact]
    public async Task Handle_Success_SendsBytesWithContentTypeAndFileName()
    {
        var device = NewDevice();
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.GetFile(Arg.Any<FilePath>()).Returns(new FileItem { Size = 3 });
        var bytes = new byte[] { 9, 8, 7 };
        _sdStorage.ReadFileBytes(Arg.Any<FilePath>(), Arg.Any<CancellationToken>())
            .Returns(FileBytesResult.Success(bytes));
        var endpoint = EndpointFactory.CreateEndpoint<GetFileContentEndpoint>(_deviceManager);

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.Received(1).SendBytes(Arg.Is<GetFileContentResponse>(r =>
            ReferenceEquals(r.Bytes, bytes) &&
            r.ContentType == MediaTypeNames.Application.Octet &&
            r.FileDownloadName == "tune.sid"));
    }
}
