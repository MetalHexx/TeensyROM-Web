using TeensyRom.Core.Abstractions;

namespace TeensyRom.Api.Endpoints.Audio.ListDevices
{
    public class ListDevicesEndpoint(IAudioCaptureService audioCaptureService)
        : RadEndpointWithoutRequest<ListDevicesResponse>
    {
        public override void Configure()
        {
            Get("/api/audio/devices")
                .Produces<ListDevicesResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("ListAudioDevices")
                .WithSummary("List Audio Input Devices")
                .WithTags("Audio")
                .WithDescription(
                    "Enumerates all available audio input devices on the host system.\n\n" +
                    "**Use Case:**\n" +
                    "Call this endpoint when configuring audio streaming settings to present " +
                    "the user with a list of audio devices to choose from.\n\n" +
                    "**Device Information:**\n" +
                    "- **Index**: Device identifier used to select the device for capture\n" +
                    "- **Name**: Human-readable device name for display in UI\n" +
                    "- **MaxInputChannels**: Number of audio channels the device supports\n" +
                    "- **DefaultSampleRate**: The device's preferred sample rate\n\n" +
                    "Returns an empty list if no audio input devices are available."
                );
        }

        public override Task Handle(CancellationToken ct)
        {
            var devices = audioCaptureService.GetDevices();

            Response = new ListDevicesResponse
            {
                Devices = devices.Select(d => new AudioDeviceDto
                {
                    Index = d.Index,
                    Name = d.Name,
                    MaxInputChannels = d.MaxInputChannels,
                    DefaultSampleRate = d.DefaultSampleRate
                }).ToList()
            };

            Send();
            return Task.CompletedTask;
        }
    }
}
