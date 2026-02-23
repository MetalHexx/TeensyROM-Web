using PortAudioSharp;
using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Audio;
using PortAudioStream = PortAudioSharp.Stream;

namespace TeensyRom.Core.Audio;

/// <summary>
/// Provides audio capture functionality using PortAudio for cross-platform audio input.
/// Implements lazy initialization of PortAudio and thread-safe capture lifecycle.
/// </summary>
public sealed class PortAudioCaptureService : IAudioCaptureService, IDisposable
{
    private const int DefaultSampleRate = 48000;
    private const int FramesPerBuffer = 960; // 20ms @ 48kHz (standard Opus frame duration)

    private static readonly Lazy<bool> _portAudioInitialized = new(() =>
    {
        try
        {
            PortAudio.Initialize();
            return true;
        }
        catch
        {
            return false;
        }
    }, LazyThreadSafetyMode.ExecutionAndPublication);

    private readonly object _captureLock = new();
    private PortAudioStream? _activeStream;
    private volatile bool _isCapturing;
    private bool _disposed;

    /// <summary>
    /// Gets a value indicating whether PortAudio has been successfully initialized.
    /// </summary>
    public static bool IsPortAudioInitialized => _portAudioInitialized.Value;

    /// <inheritdoc/>
    public IEnumerable<AudioDeviceInfo> GetDevices()
    {
        EnsurePortAudioInitialized();

        var count = PortAudio.DeviceCount;
        var devices = new List<AudioDeviceInfo>();

        for (int i = 0; i < count; i++)
        {
            var info = PortAudio.GetDeviceInfo(i);
            if (info.maxInputChannels > 0)
            {
                devices.Add(new AudioDeviceInfo
                {
                    Index = i,
                    Name = info.name ?? $"Device {i}",
                    MaxInputChannels = info.maxInputChannels,
                    DefaultSampleRate = info.defaultSampleRate
                });
            }
        }

        return devices;
    }

    /// <inheritdoc/>
    public AudioDeviceInfo? GetDeviceByName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return null;

        // Case-insensitive substring match for resilience against minor name variations
        // (e.g., USB bus numbers, "(USB)" suffixes that may change)
        var devices = GetDevices();
        return devices.FirstOrDefault(d =>
            d.Name.Contains(name, StringComparison.OrdinalIgnoreCase));
    }

    /// <inheritdoc/>
    public async IAsyncEnumerable<byte[]> StartCapture(
        AudioStreamConfig config,
        [EnumeratorCancellation] CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(config);

        if (config.ChannelCount <= 0)
            throw new ArgumentException("Channel count must be greater than zero.", nameof(config));
        if (config.SampleRate <= 0)
            throw new ArgumentException("Sample rate must be greater than zero.", nameof(config));

        EnsurePortAudioInitialized();

        lock (_captureLock)
        {
            if (_isCapturing)
                throw new InvalidOperationException("Capture is already in progress. Call StopCapture() first.");

            _isCapturing = true;
        }

        var queue = new ConcurrentQueue<byte[]>();
        var dataAvailable = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

        // Calculate frames per buffer based on 20ms frame duration
        var framesPerBuffer = (uint)(config.SampleRate / 50); // 50 = 1000ms / 20ms

        StreamCallbackResult Callback(
            nint input,
            nint output,
            uint frameCount,
            ref StreamCallbackTimeInfo timeInfo,
            StreamCallbackFlags flags,
            nint userData)
        {
            if (ct.IsCancellationRequested)
                return StreamCallbackResult.Abort;

            try
            {
                // Each float is 4 bytes; copy the raw PCM bytes into queue
                var byteCount = (int)frameCount * config.ChannelCount * sizeof(float);
                var buffer = new byte[byteCount];
                Marshal.Copy(input, buffer, 0, byteCount);
                queue.Enqueue(buffer);
                dataAvailable.TrySetResult(true);
                return StreamCallbackResult.Continue;
            }
            catch
            {
                return StreamCallbackResult.Abort;
            }
        }

        DeviceInfo? deviceInfo = PortAudio.GetDeviceInfo(config.DeviceIndex);
        if (deviceInfo is null)
        {
            _isCapturing = false;
            throw new ArgumentException($"Device with index {config.DeviceIndex} not found.", nameof(config));
        }

        var streamParams = new StreamParameters
        {
            device = config.DeviceIndex,
            channelCount = Math.Min(config.ChannelCount, deviceInfo.Value.maxInputChannels),
            sampleFormat = SampleFormat.Float32,
            suggestedLatency = deviceInfo.Value.defaultLowInputLatency,
        };

        PortAudioStream? stream = null;
        try
        {
            stream = new PortAudioStream(
                inParams: streamParams,
                outParams: null,
                sampleRate: config.SampleRate,
                framesPerBuffer: framesPerBuffer,
                streamFlags: StreamFlags.ClipOff,
                callback: Callback,
                userData: nint.Zero);

            lock (_captureLock)
            {
                if (_disposed)
                {
                    stream.Dispose();
                    throw new ObjectDisposedException(nameof(PortAudioCaptureService));
                }
                _activeStream = stream;
            }

            stream.Start();

            while (!ct.IsCancellationRequested && _isCapturing)
            {
                // Wait for data with timeout to allow cancellation checks
                var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
                dataAvailable = tcs;

                try
                {
                    await tcs.Task.WaitAsync(TimeSpan.FromSeconds(2), ct);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (TimeoutException)
                {
                    // Timeout is acceptable - continue polling
                    continue;
                }

                while (queue.TryDequeue(out var chunk))
                {
                    if (ct.IsCancellationRequested)
                        break;
                    yield return chunk;
                }
            }
        }
        finally
        {
            lock (_captureLock)
            {
                if (stream is not null)
                {
                    try
                    {
                        stream.Stop();
                    }
                    catch
                    {
                        // Ignore errors during stream stop
                    }
                    stream.Dispose();
                }
                _activeStream = null;
                _isCapturing = false;
            }

            // Clear any remaining queued data
            while (queue.TryDequeue(out _)) { }
        }
    }

    /// <inheritdoc/>
    public void StopCapture()
    {
        lock (_captureLock)
        {
            if (!_isCapturing || _activeStream is null)
                return;

            try
            {
                _activeStream.Stop();
            }
            catch
            {
                // Ignore errors during stream stop
            }

            _activeStream.Dispose();
            _activeStream = null;
            _isCapturing = false;
        }
    }

    /// <summary>
    /// Ensures PortAudio is initialized before use.
    /// </summary>
    private static void EnsurePortAudioInitialized()
    {
        if (!_portAudioInitialized.Value)
            throw new InvalidOperationException("Failed to initialize PortAudio. Ensure PortAudio native libraries are available.");
    }

    /// <inheritdoc/>
    public void Dispose()
    {
        lock (_captureLock)
        {
            if (_disposed)
                return;

            _disposed = true;

            if (_activeStream is not null)
            {
                try
                {
                    _activeStream.Stop();
                }
                catch
                {
                    // Ignore errors during stream stop
                }
                _activeStream.Dispose();
                _activeStream = null;
            }

            _isCapturing = false;
        }

        // Note: We don't call PortAudio.Terminate() here because:
        // 1. This is a singleton service in the DI container
        // 2. PortAudio is initialized lazily and should remain available
        // 3. Other services might still be using PortAudio
        // If explicit cleanup is needed, implement IAsyncDisposable or register a shutdown callback
    }
}
