using Microsoft.AspNetCore.SignalR;
using System.Runtime.CompilerServices;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Audio;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Endpoints.Audio.Hub;

/// <summary>
/// SignalR hub for streaming audio from host audio devices to connected clients.
/// Supports per-device audio streaming with per-channel Opus encoding.
/// </summary>
public sealed class AudioHub(
    IAudioStreamManager streamManager,
    IAudioCaptureService captureService,
    ISettingsService settingsService) : Microsoft.AspNetCore.SignalR.Hub
{
    /// <summary>
    /// Streams channel-tagged Opus-encoded audio frames from the specified TeensyROM device's audio source.
    /// Each frame contains the channel index and the Opus-encoded mono audio data for that channel.
    /// </summary>
    /// <param name="deviceId">The TeensyROM device identifier to stream audio for.</param>
    /// <param name="ct">Cancellation token to stop the stream.</param>
    /// <returns>An async enumerable of <see cref="ChannelAudioFrame"/> records.</returns>
    public async IAsyncEnumerable<ChannelAudioFrame> StreamAudio(
        string deviceId,
        [EnumeratorCancellation] CancellationToken ct)
    {
        await foreach (var frame in streamManager.GetStream(deviceId, ct))
        {
            yield return frame;
        }
    }

    /// <summary>
    /// Starts audio capture for the specified TeensyROM device using saved audio settings.
    /// Resolves the audio device by name for stable identification across reconnections.
    /// </summary>
    /// <param name="deviceId">The TeensyROM device identifier to start audio capture for.</param>
    public void StartCapture(string deviceId)
    {
        var settings = settingsService.GetSettings();
        var deviceSettings = settings.KnownDevices.FirstOrDefault(d => d.DeviceId == deviceId);

        if (deviceSettings?.AudioSettings == null)
        {
            throw new HubException($"No audio settings configured for device {deviceId}. Configure audio settings first.");
        }

        var audioSettings = deviceSettings.AudioSettings;

        // Resolve device by name first, fall back to index if name not available
        AudioDeviceInfo? deviceInfo = null;
        if (!string.IsNullOrWhiteSpace(audioSettings.AudioDeviceName))
        {
            deviceInfo = captureService.GetDeviceByName(audioSettings.AudioDeviceName);
        }

        // Fallback to index if name lookup failed (backward compatibility)
        if (deviceInfo == null && audioSettings.AudioDeviceIndex >= 0)
        {
            var devices = captureService.GetDevices().ToList();
            deviceInfo = devices.FirstOrDefault(d => d.Index == audioSettings.AudioDeviceIndex);
        }

        if (deviceInfo == null)
        {
            throw new HubException($"Audio device '{audioSettings.AudioDeviceName}' (index {audioSettings.AudioDeviceIndex}) not found. Check audio device connection.");
        }

#pragma warning disable CS0618 // ChannelCount is obsolete but still read for backward compatibility
        var captureChannelCount = audioSettings.CaptureChannelCount > 0
            ? audioSettings.CaptureChannelCount
            : audioSettings.ChannelCount; // Fallback for old settings
#pragma warning restore CS0618

        var config = new AudioStreamConfig
        {
            DeviceIndex = deviceInfo.Index,
            DeviceName = deviceInfo.Name,
            ChannelCount = captureChannelCount,
            SampleRate = 48000, // Opus requires 48kHz; PortAudio resamples from device native rate
            OpusBitrate = 128000, // 128 kbps
            Channels = audioSettings.Channels
        };

        streamManager.StartStream(deviceId, config);
    }

    /// <summary>
    /// Stops audio capture for the specified TeensyROM device.
    /// </summary>
    /// <param name="deviceId">The TeensyROM device identifier to stop audio capture for.</param>
    public void StopCapture(string deviceId)
    {
        streamManager.StopStream(deviceId);
    }

    /// <summary>
    /// Gets the list of available audio input devices on the host system.
    /// </summary>
    /// <returns>A list of audio device information records.</returns>
    public IEnumerable<AudioDeviceRecord> GetDevices()
    {
        return captureService.GetDevices()
            .Select(d => new AudioDeviceRecord(d.Index, d.Name, d.MaxInputChannels, d.DefaultSampleRate));
    }

    /// <summary>
    /// Checks if audio streaming is currently active for the specified device.
    /// </summary>
    /// <param name="deviceId">The TeensyROM device identifier to check.</param>
    /// <returns>True if streaming is active, false otherwise.</returns>
    public bool IsStreaming(string deviceId)
    {
        return streamManager.IsStreaming(deviceId);
    }

    /// <summary>
    /// Record representing an audio input device.
    /// </summary>
    public record AudioDeviceRecord(int Index, string Name, int MaxInputChannels, double DefaultSampleRate);
}
