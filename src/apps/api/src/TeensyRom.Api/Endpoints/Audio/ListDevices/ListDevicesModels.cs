using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.Audio.ListDevices
{
    /// <summary>
    /// Response containing a list of available audio input devices.
    /// </summary>
    public record ListDevicesResponse
    {
        /// <summary>
        /// List of audio input devices available on the host system.
        /// </summary>
        [Required] public List<AudioDeviceDto> Devices { get; set; } = [];
    }

    /// <summary>
    /// Information about an audio input device.
    /// </summary>
    public record AudioDeviceDto
    {
        /// <summary>
        /// The device index used to identify this device for audio capture.
        /// </summary>
        [Required] public int Index { get; set; }

        /// <summary>
        /// The human-readable name of the audio device.
        /// </summary>
        [Required] public string Name { get; set; } = string.Empty;

        /// <summary>
        /// The maximum number of input channels supported by this device.
        /// </summary>
        [Required] public int MaxInputChannels { get; set; }

        /// <summary>
        /// The default sample rate for this device in Hz.
        /// </summary>
        [Required] public double DefaultSampleRate { get; set; }
    }
}
