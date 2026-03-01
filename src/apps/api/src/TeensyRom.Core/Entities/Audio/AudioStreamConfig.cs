using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Entities.Audio;

/// <summary>
/// Configuration value object for an audio capture and encoding stream.
/// </summary>
public record AudioStreamConfig
{
    /// <summary>
    /// The PortAudio device index to capture audio from.
    /// Resolved at runtime from DeviceName via IAudioCaptureService.GetDeviceByName().
    /// </summary>
    public required int DeviceIndex { get; init; }

    /// <summary>
    /// The stable device name used to identify the audio input device.
    /// This persists across application restarts and device reconnections.
    /// DeviceIndex is resolved from this name at stream start time.
    /// </summary>
    public string DeviceName { get; init; } = string.Empty;

    /// <summary>
    /// The number of audio channels to capture from hardware (e.g., 1 for mono, 2 for stereo).
    /// </summary>
    public required int ChannelCount { get; init; }

    /// <summary>
    /// The sample rate in Hz (e.g., 48000).
    /// </summary>
    public required int SampleRate { get; init; }

    /// <summary>
    /// The Opus encoder bitrate in bits per second.
    /// </summary>
    public required int OpusBitrate { get; init; }

    /// <summary>
    /// Per-channel configuration for multi-channel audio streaming.
    /// Defines which channels to encode, their names, and enable/disable state.
    /// </summary>
    public List<ChannelConfig> Channels { get; init; } = [];

    /// <summary>
    /// When true, audio is compressed using Opus codec (~16 KB/s per channel).
    /// When false, raw PCM is sent for lowest latency (~188 KB/s per channel).
    /// </summary>
    public bool UseOpusEncoding { get; init; } = true;
}
