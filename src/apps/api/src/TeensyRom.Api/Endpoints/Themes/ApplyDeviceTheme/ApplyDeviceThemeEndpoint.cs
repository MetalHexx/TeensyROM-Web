using MediatR;
using TeensyRom.Api.Endpoints.Common;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Serial.Commands.Composite.ApplyThemeColors;
using TeensyRom.Core.Themes;

namespace TeensyRom.Api.Endpoints.Themes.ApplyDeviceTheme
{
    public class ApplyDeviceThemeEndpoint(IDeviceConnectionManager deviceManager, IMediator mediator, IThemeStore store)
        : RadEndpoint<ApplyDeviceThemeRequest, ApplyDeviceThemeResponse>
    {
        public override void Configure()
        {
            Put("/api/devices/{deviceId}/theme")
                .Produces<ApplyDeviceThemeResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict)
                .ProducesProblem(StatusCodes.Status502BadGateway)
                .WithName("ApplyDeviceTheme")
                .WithSummary("Apply Device Theme")
                .WithTags("Themes")
                .WithDescription(
                    "Sends the seven menu colors to a TeensyROM device, then resets it so the C64 shows them.\n\n" +
                    "- Resets the C64 and ends whatever is running.\n" +
                    "- The colors are recorded for the device once it accepts them. The theme id is recorded only when that theme exists and holds exactly these colors.\n" +
                    "- Answers 409 (code deviceBusyWithTransfer) when the device is busy with a transfer.\n\n" +
                    "**Validation:**\n" +
                    "- The device id is 1-32 letters, digits, hyphens or underscores\n" +
                    "- Each color is 0-15\n" +
                    "- The theme id, when given, is lowercase letters, digits and single hyphens"
                );
        }

        public override async Task Handle(ApplyDeviceThemeRequest r, CancellationToken ct)
        {
            var device = deviceManager.GetAvailableDevice(r.DeviceId);

            if (device is null)
            {
                SendNotFound($"The device {r.DeviceId} was not found.");
                return;
            }

            var colors = ThemeMapping.ToPart(r.Body.Colors);
            var result = await mediator.Send(new ApplyThemeColorsCommand
            {
                DeviceId = device.Cart.DeviceId,
                CommunicationPort = device.CommunicationPort,
                Colors = colors
            }, ct);

            if (!result.IsSuccess)
            {
                if (result.ActiveTransferJobId is { } jobId)
                {
                    SendProblem(DeviceBusyProblem.Create(r.DeviceId, device.Cart.Name, jobId));
                    return;
                }
                SendExternalError(result.Error);
                return;
            }

            var themeId = r.Body.ThemeId is { } id && store.GetTheme(id)?.Parts.Device == colors ? id : null;
            var record = new DeviceThemeRecord(device.Cart.DeviceId, colors, themeId, DateTimeOffset.UtcNow);

            store.SaveDeviceRecord(record);

            Response = new() { Record = ThemeMapping.ToDto(record) };
            Send();
        }
    }
}
