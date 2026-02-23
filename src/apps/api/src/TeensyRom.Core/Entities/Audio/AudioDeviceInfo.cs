namespace TeensyRom.Core.Entities.Audio;

/// <summary>
/// Represents information about an audio input device available on the system.
/// </summary>
public record AudioDeviceInfo
{
    /// <summary>
    /// The PortAudio device index used to identify this device.
    /// </summary>
    public required int Index { get; init; }

    /// <summary>
    /// The human-readable name of the audio device.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// The maximum number of input channels supported by this device.
    /// </summary>
    public required int MaxInputChannels { get; init; }

    /// <summary>
    /// The default sample rate for this device in Hz.
    /// </summary>
    public required double DefaultSampleRate { get; init; }
}
