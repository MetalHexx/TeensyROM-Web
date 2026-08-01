using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Threading.Channels;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Audio;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Audio;

/// <summary>
/// Manages the lifecycle of audio streaming pipelines, coordinating capture and encoding.
/// Supports multiple concurrent device streams with thread-safe operations.
/// </summary>
public sealed class AudioStreamManager : IAudioStreamManager, IDisposable
{
    private readonly ConcurrentDictionary<string, StreamContext> _streams = new();
    private readonly IAudioCaptureService _captureService;
    private bool _disposed;

    /// <summary>
    /// Initializes a new instance of the <see cref="AudioStreamManager"/> class.
    /// </summary>
    /// <param name="captureService">The audio capture service for capturing PCM audio from devices.</param>
    public AudioStreamManager(IAudioCaptureService captureService)
    {
        _captureService = captureService ?? throw new ArgumentNullException(nameof(captureService));
    }

    /// <inheritdoc/>
    public void StartStream(string deviceId, AudioStreamConfig config)
    {
        ArgumentNullException.ThrowIfNull(config);
        ArgumentException.ThrowIfNullOrEmpty(deviceId);

        ObjectDisposedException.ThrowIf(_disposed, this);

        // Use GetOrAdd with factory to ensure atomic creation
        _streams.GetOrAdd(deviceId, id =>
        {
            var enabledChannelCount = config.Channels.Count > 0
                ? config.Channels.Count(c => c.Enabled)
                : config.ChannelCount;

            var context = new StreamContext(enabledChannelCount);
            StartCapturePipeline(context, config);
            return context;
        });
    }

    /// <inheritdoc/>
    public void StopStream(string deviceId)
    {
        if (string.IsNullOrEmpty(deviceId))
            return;

        if (_streams.TryRemove(deviceId, out var context))
        {
            context.Dispose();
        }
        // No-op if stream doesn't exist - idempotent behavior
    }

    /// <inheritdoc/>
    public async IAsyncEnumerable<ChannelAudioFrame> GetStream(
        string deviceId,
        [EnumeratorCancellation] CancellationToken ct)
    {
        ArgumentException.ThrowIfNullOrEmpty(deviceId);

        if (!_streams.TryGetValue(deviceId, out var context))
        {
            throw new InvalidOperationException($"No active stream for device '{deviceId}'. Call StartStream first.");
        }

        await foreach (var frame in context.ReadAllAsync(ct))
        {
            yield return frame;
        }
    }

    /// <inheritdoc/>
    public bool IsStreaming(string deviceId)
    {
        if (string.IsNullOrEmpty(deviceId))
            return false;

        return _streams.TryGetValue(deviceId, out var context) && context.IsActive;
    }

    /// <summary>
    /// Starts the capture pipeline that reads from capture service, deinterleaves, encodes each channel, and writes to channel.
    /// </summary>
    private void StartCapturePipeline(StreamContext context, AudioStreamConfig config)
    {
        // Get enabled channels from config, or fall back to all channels if Channels list is empty
        var enabledChannels = config.Channels.Count > 0
            ? config.Channels.Where(c => c.Enabled).ToList()
            : [..Enumerable.Range(0, config.ChannelCount).Select(i => ChannelConfig.CreateDefault(i))];

        if (enabledChannels.Count == 0)
        {
            throw new ArgumentException("At least one channel must be enabled for audio streaming.", nameof(config));
        }

        // Only create encoder pool when using Opus encoding
        Dictionary<int, OpusEncoderService>? encoderPool = null;
        if (config.UseOpusEncoding)
        {
            encoderPool = new Dictionary<int, OpusEncoderService>();
            var encoderConfig = new AudioStreamConfig
            {
                DeviceIndex = config.DeviceIndex,
                ChannelCount = 1, // Each encoder handles mono only
                SampleRate = config.SampleRate,
                OpusBitrate = config.OpusBitrate
            };

            foreach (var channel in enabledChannels)
            {
                encoderPool[channel.SourceChannel] = new OpusEncoderService(encoderConfig);
            }

            context.SetEncoderPool(encoderPool);
        }

        // Start the capture-encode pipeline in a background task
        var task = Task.Run(async () =>
        {
            try
            {
                await foreach (var pcmChunk in _captureService.StartCapture(config, context.CancellationToken))
                {
                    if (context.CancellationToken.IsCancellationRequested)
                        break;

                    // Convert bytes back to float array for deinterleaving
                    var floatSamples = ConvertBytesToFloats(pcmChunk);

                    // Deinterleave into per-channel mono arrays
                    var deinterleaved = ChannelDeinterleaver.Deinterleave(floatSamples, config.ChannelCount);

                    // Process each enabled channel and write to output
                    foreach (var channel in enabledChannels)
                    {
                        if (context.CancellationToken.IsCancellationRequested)
                            break;

                        var channelData = deinterleaved[channel.SourceChannel];

                        byte[] frameData;
                        if (config.UseOpusEncoding && encoderPool is not null)
                        {
                            // Opus encoding path (default) - ~320 bytes per frame
                            var encoder = encoderPool[channel.SourceChannel];
                            frameData = encoder.Encode(channelData);
                        }
                        else
                        {
                            // Raw PCM path - ~3840 bytes per frame (960 samples * 4 bytes)
                            frameData = ConvertFloatsToBytes(channelData);
                        }

                        // Write channel-tagged frame to output channel
                        if (!context.TryWrite(new ChannelAudioFrame(channel.SourceChannel, frameData)))
                        {
                            // Channel is complete, stop processing
                            break;
                        }
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // Expected when cancellation is requested
            }
            finally
            {
                context.CompleteWriting();
            }
        }, context.CancellationToken);

        context.SetCaptureTask(task);
    }

    /// <summary>
    /// Converts a byte array of PCM float samples to a float array.
    /// </summary>
    private static float[] ConvertBytesToFloats(byte[] bytes)
    {
        var floatCount = bytes.Length / sizeof(float);
        var floats = new float[floatCount];
        Buffer.BlockCopy(bytes, 0, floats, 0, bytes.Length);
        return floats;
    }

    /// <summary>
    /// Converts float samples to raw PCM bytes.
    /// Used when Opus encoding is disabled for lowest latency.
    /// </summary>
    /// <param name="floats">Float samples to convert (typically 960 samples for 20ms at 48kHz)</param>
    /// <returns>Raw PCM bytes (4 bytes per float, e.g., 3840 bytes for 960 samples)</returns>
    public static byte[] ConvertFloatsToBytes(float[] floats)
    {
        var bytes = new byte[floats.Length * sizeof(float)];
        Buffer.BlockCopy(floats, 0, bytes, 0, bytes.Length);
        return bytes;
    }

    /// <inheritdoc/>
    public void Dispose()
    {
        if (_disposed)
            return;

        _disposed = true;

        // Stop all active streams
        foreach (var deviceId in _streams.Keys)
        {
            if (_streams.TryRemove(deviceId, out var context))
            {
                context.Dispose();
            }
        }

        _streams.Clear();
    }

    /// <summary>
    /// Internal context for managing a single device stream's resources.
    /// Supports multiple clients with per-client channels for frame broadcasting.
    /// </summary>
    private sealed class StreamContext : IDisposable
    {
        private readonly ConcurrentDictionary<Guid, Channel<ChannelAudioFrame>> _clientChannels = new();
        private readonly CancellationTokenSource _cts;
        private readonly int _channelCount;
        private Dictionary<int, OpusEncoderService>? _encoderPool;
        private Task? _captureTask;
        private bool _disposed;
        private bool _isActive = true;

        public StreamContext(int channelCount = 1)
        {
            _channelCount = channelCount;
            _cts = new CancellationTokenSource();
        }

        public CancellationToken CancellationToken => _cts.Token;
        public bool IsActive => _isActive && !_cts.Token.IsCancellationRequested;
        public int ClientCount => _clientChannels.Count;

        public void SetEncoderPool(Dictionary<int, OpusEncoderService> encoderPool) => _encoderPool = encoderPool;

        public void SetCaptureTask(Task task) => _captureTask = task;

        /// <summary>
        /// Broadcasts a frame to all registered client channels.
        /// Each client gets its own copy of the frame.
        /// </summary>
        public bool TryWrite(ChannelAudioFrame frame)
        {
            if (_disposed || !_isActive)
                return false;

            // Broadcast to all client channels
            foreach (var kvp in _clientChannels)
            {
                kvp.Value.Writer.TryWrite(frame);
            }
            return true;
        }

        /// <summary>
        /// Registers a new client and returns its dedicated channel reader.
        /// Each client gets its own channel that receives all broadcast frames.
        /// </summary>
        public ChannelReader<ChannelAudioFrame> RegisterClient()
        {
            var clientId = Guid.NewGuid();
            var capacity = Math.Max(5, 10 * _channelCount);
            var channel = Channel.CreateBounded<ChannelAudioFrame>(new BoundedChannelOptions(capacity)
            {
                FullMode = BoundedChannelFullMode.DropOldest,
                SingleReader = true,
                SingleWriter = true
            });

            _clientChannels[clientId] = channel;
            return channel.Reader;
        }

        /// <summary>
        /// Unregisters a client and completes its channel.
        /// Called automatically when client enumeration completes.
        /// </summary>
        public void UnregisterClient(Guid clientId)
        {
            if (_clientChannels.TryRemove(clientId, out var channel))
            {
                channel.Writer.TryComplete();
            }
        }

        public void CompleteWriting()
        {
            _isActive = false;

            // Complete all client channels
            foreach (var channel in _clientChannels.Values)
            {
                channel.Writer.TryComplete();
            }
        }

        public async IAsyncEnumerable<ChannelAudioFrame> ReadAllAsync([EnumeratorCancellation] CancellationToken ct)
        {
            var clientId = Guid.NewGuid();
            var reader = RegisterClient();

            try
            {
                using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(_cts.Token, ct);

                IAsyncEnumerable<ChannelAudioFrame> enumerable = reader.ReadAllAsync(linkedCts.Token);
                await using var enumerator = enumerable.GetAsyncEnumerator(ct);

                while (true)
                {
                    bool hasMore;
                    try
                    {
                        hasMore = await enumerator.MoveNextAsync();
                    }
                    catch (OperationCanceledException)
                    {
                        // Stream was stopped - end enumeration gracefully
                        yield break;
                    }

                    if (!hasMore)
                    {
                        yield break;
                    }

                    yield return enumerator.Current;
                }
            }
            finally
            {
                // Always unregister the client when enumeration ends
                UnregisterClient(clientId);
            }
        }

        public void Dispose()
        {
            if (_disposed)
                return;

            _disposed = true;
            _isActive = false;

            // Cancel the capture operation
            if (!_cts.IsCancellationRequested)
            {
                _cts.Cancel();
            }

            // Complete all client channels
            foreach (var channel in _clientChannels.Values)
            {
                channel.Writer.TryComplete();
            }
            _clientChannels.Clear();

            // Wait for the capture task to complete (with timeout)
            if (_captureTask is not null)
            {
                try
                {
                    _captureTask.Wait(TimeSpan.FromSeconds(5));
                }
                catch (AggregateException)
                {
                    // Ignore exceptions during shutdown
                }
            }

            // Dispose all encoders in the pool
            if (_encoderPool is not null)
            {
                foreach (var encoder in _encoderPool.Values)
                {
                    encoder.Dispose();
                }
                _encoderPool.Clear();
            }

            _cts.Dispose();
        }
    }
}
