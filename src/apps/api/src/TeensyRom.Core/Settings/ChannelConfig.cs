namespace TeensyRom.Core.Settings;

/// <summary>
/// Configuration for a single audio channel in a multi-channel audio stream.
/// Each channel can be independently enabled/disabled and mapped to a source channel.
/// </summary>
public record ChannelConfig
{
    /// <summary>
    /// The 0-based index of the source channel in the interleaved PCM input.
    /// Maps to the physical input channel on the audio interface.
    /// </summary>
    public int SourceChannel { get; init; }

    /// <summary>
    /// Whether this channel should be included in the audio stream.
    /// Disabled channels are not captured, encoded, or transmitted.
    /// </summary>
    public bool Enabled { get; init; } = true;

    /// <summary>
    /// Creates a default channel configuration for the specified channel index.
    /// </summary>
    /// <param name="channelIndex">The 0-based channel index.</param>
    /// <returns>A new ChannelConfig with enabled state.</returns>
    public static ChannelConfig CreateDefault(int channelIndex) => new()
    {
        SourceChannel = channelIndex,
        Enabled = true
    };
}
