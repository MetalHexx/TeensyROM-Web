using TeensyRom.Core.Entities.Audio;

namespace TeensyRom.Core.Abstractions;

/// <summary>
/// Provides low-level audio capture functionality from input devices.
/// </summary>
public interface IAudioCaptureService
{
    /// <summary>
    /// Enumerates all available audio input devices on the system.
    /// </summary>
    /// <returns>An enumerable collection of audio device information.</returns>
    IEnumerable<AudioDeviceInfo> GetDevices();

    /// <summary>
    /// Looks up an audio device by name using case-insensitive substring matching.
    /// This provides stable device identification across application restarts and USB reconnections,
    /// as device indices can change when devices are added/removed.
    /// </summary>
    /// <param name="name">The device name or substring to search for.</param>
    /// <returns>The matching AudioDeviceInfo, or null if no device matches.</returns>
    AudioDeviceInfo? GetDeviceByName(string name);

    /// <summary>
    /// Starts capturing PCM audio data from the specified device configuration.
    /// </summary>
    /// <param name="config">The audio stream configuration specifying device and format settings.</param>
    /// <param name="ct">Cancellation token to stop the capture operation.</param>
    /// <returns>An async enumerable yielding raw PCM audio byte arrays.</returns>
    IAsyncEnumerable<byte[]> StartCapture(AudioStreamConfig config, CancellationToken ct);

    /// <summary>
    /// Stops any active audio capture operation.
    /// </summary>
    void StopCapture();
}
