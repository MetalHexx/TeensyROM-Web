using TeensyRom.Core.Entities.Audio;

namespace TeensyRom.Core.Abstractions;

/// <summary>
/// Manages the lifecycle of audio streaming pipelines, coordinating capture and encoding.
/// </summary>
public interface IAudioStreamManager
{
    /// <summary>
    /// Starts a capture and encode pipeline for the specified device.
    /// </summary>
    /// <param name="deviceId">A unique identifier for the device stream (e.g., device index as string).</param>
    /// <param name="config">The audio stream configuration for capture and encoding.</param>
    void StartStream(string deviceId, AudioStreamConfig config);

    /// <summary>
    /// Stops and disposes the capture and encode pipeline for the specified device.
    /// </summary>
    /// <param name="deviceId">The unique identifier of the device stream to stop.</param>
    void StopStream(string deviceId);

    /// <summary>
    /// Gets an async enumerable of channel-tagged Opus-encoded audio frames from the specified device stream.
    /// Each frame contains the channel index and the Opus-encoded mono audio data for that channel.
    /// </summary>
    /// <param name="deviceId">The unique identifier of the device stream to read from.</param>
    /// <param name="ct">Cancellation token to stop reading from the stream.</param>
    /// <returns>An async enumerable yielding <see cref="ChannelAudioFrame"/> records for all enabled channels.</returns>
    IAsyncEnumerable<ChannelAudioFrame> GetStream(string deviceId, CancellationToken ct);

    /// <summary>
    /// Checks whether a stream is currently active for the specified device.
    /// </summary>
    /// <param name="deviceId">The unique identifier of the device to check.</param>
    /// <returns>True if the device is currently streaming; otherwise, false.</returns>
    bool IsStreaming(string deviceId);
}
