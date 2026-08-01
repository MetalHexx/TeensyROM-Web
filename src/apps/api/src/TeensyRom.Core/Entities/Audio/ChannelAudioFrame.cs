namespace TeensyRom.Core.Entities.Audio;

/// <summary>
/// Represents a single Opus-encoded audio frame tagged with its source channel index.
/// Used for multi-channel streaming where each channel is independently encoded.
/// </summary>
/// <param name="ChannelIndex">The 0-based index of the source channel this frame belongs to.</param>
/// <param name="OpusFrame">The Opus-encoded audio data for this channel (mono).</param>
public record ChannelAudioFrame(int ChannelIndex, byte[] OpusFrame);
