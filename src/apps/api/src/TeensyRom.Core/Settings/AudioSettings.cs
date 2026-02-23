namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// Audio streaming capture and encoding preferences
  /// </summary>
  public record AudioSettings
  {
    /// <summary>
    /// Enable audio streaming from the host audio device
    /// </summary>
    public bool EnableAudioStream { get; set; } = false;

    /// <summary>
    /// Gets or sets the index of the audio input device.
    /// -1 indicates auto-select / not yet configured
    /// Note: This is maintained for backward compatibility but should not be used for
    /// persistent device identification. Use AudioDeviceName instead.
    /// </summary>
    public int AudioDeviceIndex { get; set; } = -1;

    /// <summary>
    /// Gets or sets the name of the audio input device.
    /// This is the primary identifier for device persistence (stable across reconnects).
    /// </summary>
    public string AudioDeviceName { get; set; } = string.Empty;

    /// <summary>
    /// Number of audio channels to capture from the hardware (1 = mono, 2 = stereo, etc.)
    /// This determines how many channels PortAudio opens from the device.
    /// May differ from the number of enabled channels in the Channels list.
    /// </summary>
    public int CaptureChannelCount { get; set; } = 1;

    /// <summary>
    /// Number of audio channels to capture (1 = mono, 2 = stereo)
    /// Deprecated: Use CaptureChannelCount instead. Kept for backward compatibility.
    /// </summary>
    [Obsolete("Use CaptureChannelCount instead.")]
    public int ChannelCount { get; set; } = 1;

    /// <summary>
    /// Sample rate for audio capture in Hz
    /// </summary>
    public int SampleRate { get; set; } = 48000;

    /// <summary>
    /// Per-channel configuration for multi-channel audio streaming.
    /// Each entry defines how a source channel should be named, enabled, and processed.
    /// Empty list indicates single-channel capture or not yet configured.
    /// </summary>
    public List<ChannelConfig> Channels { get; set; } = [];
  }
}
