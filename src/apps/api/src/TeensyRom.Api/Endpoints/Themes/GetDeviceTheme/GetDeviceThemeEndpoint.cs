using TeensyRom.Core.Themes;

namespace TeensyRom.Api.Endpoints.Themes.GetDeviceTheme
{
    public class GetDeviceThemeEndpoint(IThemeStore store) : RadEndpoint<GetDeviceThemeRequest, GetDeviceThemeResponse>
    {
        public override void Configure()
        {
            Get("/api/devices/{deviceId}/theme")
                .Produces<GetDeviceThemeResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .WithName("GetDeviceTheme")
                .WithSummary("Get Device Theme")
                .WithTags("Themes")
                .WithDescription(
                    "Reads the colors last applied to a device. The device does not need to be connected.\n\n" +
                    "A device with no record reports the factory colors with isRecorded false.\n\n" +
                    "**Validation:**\n" +
                    "- The device id is 1-32 letters, digits, hyphens or underscores"
                );
        }

        public override Task Handle(GetDeviceThemeRequest r, CancellationToken ct)
        {
            var record = store.GetDeviceRecord(r.DeviceId);

            Response = new()
            {
                Record = record is null
                    ? new DeviceThemeRecordDto
                    {
                        DeviceId = r.DeviceId,
                        Colors = ThemeMapping.ToDto(ThemeDefaults.FactoryColors),
                        ThemeId = ThemeDefaults.FactoryThemeId,
                        AppliedAt = null,
                        IsRecorded = false
                    }
                    : ThemeMapping.ToDto(record)
            };
            Send();
            return Task.CompletedTask;
        }
    }
}
