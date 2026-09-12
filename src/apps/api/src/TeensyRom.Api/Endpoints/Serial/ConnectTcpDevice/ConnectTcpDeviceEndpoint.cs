using TeensyRom.Core.Abstractions;

namespace TeensyRom.Api.Endpoints.Serial.ConnectTcpDevice;

/// <summary>Connects to a device at a user-specified TCP address without scanning the network.</summary>
public class ConnectTcpDeviceEndpoint(
    IDeviceConnectionManager deviceManager,
    IDeviceSettingsProvider deviceSettingsProvider) : RadEndpoint<ConnectTcpDeviceRequest, ConnectTcpDeviceResponse>
{
    public override void Configure()
    {
        Post("/api/devices/connect")
            .Produces<ConnectTcpDeviceResponse>(StatusCodes.Status200OK)
            .ProducesValidationProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .WithName("ConnectTcpDevice")
            .WithSummary("Connect to a device by IP address")
            .WithTags("Devices")
            .WithDescription(
                "Connects directly to a TeensyROM device at a supplied IP address and TCP port. " +
                "No subnet scan is performed. Successful addresses are saved for future automatic reconnection.");
    }

    public override async Task Handle(ConnectTcpDeviceRequest request, CancellationToken ct)
    {
        var device = await deviceManager.ConnectTcpDevice(request.IpAddress, request.Port, ct);
        if (device is null)
        {
            SendNotFound($"No TeensyROM device responded at {request.IpAddress}:{request.Port}.");
            return;
        }

        Response = new ConnectTcpDeviceResponse
        {
            Device = await CartDto.FromDevice(device, deviceSettingsProvider),
            Message = $"Connected to {request.IpAddress}:{request.Port}."
        };
        Send();
    }
}
