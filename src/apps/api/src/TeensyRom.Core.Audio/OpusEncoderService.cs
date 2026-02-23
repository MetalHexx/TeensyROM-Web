using Concentus.Enums;
using Concentus.Structs;
using TeensyRom.Core.Entities.Audio;

namespace TeensyRom.Core.Audio;

/// <summary>
/// Encodes PCM float audio samples to Opus frames.
/// Wraps the Concentus Opus encoder library for use in the audio streaming pipeline.
/// </summary>
/// <remarks>
/// This service is NOT thread-safe. Create one instance per audio stream.
/// Frame size must be one of: 120, 240, 480, 960, 1920, or 2880 samples (at 48kHz).
/// For 20ms frames at 48kHz, use 960 samples.
/// </remarks>
public sealed class OpusEncoderService : IDisposable
{
    private readonly OpusEncoder _encoder;
    private readonly int _channels;
    private readonly int _frameSize;
    private readonly short[] _shortBuffer;
    private readonly byte[] _outputBuffer;
    private bool _disposed;

    /// <summary>
    /// Valid Opus frame sizes in samples per channel.
    /// </summary>
    public static readonly int[] ValidFrameSizes = [120, 240, 480, 960, 1920, 2880];

    /// <summary>
    /// Gets the expected frame size in samples for 20ms at the specified sample rate.
    /// </summary>
    /// <param name="sampleRate">The sample rate in Hz.</param>
    /// <returns>The frame size in samples.</returns>
    public static int GetFrameSizeFor20ms(int sampleRate) => sampleRate / 50;

    /// <summary>
    /// Validates that the frame size is compatible with Opus encoding.
    /// </summary>
    /// <param name="frameSize">The frame size to validate.</param>
    /// <returns>True if the frame size is valid; otherwise, false.</returns>
    public static bool IsValidFrameSize(int frameSize) => Array.IndexOf(ValidFrameSizes, frameSize) >= 0;

    /// <summary>
    /// Initializes a new instance of the <see cref="OpusEncoderService"/> class.
    /// </summary>
    /// <param name="config">The audio stream configuration containing sample rate, channels, and bitrate.</param>
    /// <exception cref="ArgumentNullException">Thrown when config is null.</exception>
    /// <exception cref="ArgumentException">Thrown when frame size is invalid for Opus encoding.</exception>
    public OpusEncoderService(AudioStreamConfig config)
    {
        ArgumentNullException.ThrowIfNull(config);

        _channels = config.ChannelCount;
        _frameSize = GetFrameSizeFor20ms(config.SampleRate);

        if (!IsValidFrameSize(_frameSize))
        {
            throw new ArgumentException(
                $"Frame size {_frameSize} is not valid for Opus encoding. " +
                $"Valid frame sizes at {config.SampleRate}Hz would require a different frame duration. " +
                $"Valid sizes are: {string.Join(", ", ValidFrameSizes)}. " +
                $"Use 48000Hz sample rate for 960 samples (20ms frames).",
                nameof(config));
        }

        if (_channels is not 1 and not 2)
        {
            throw new ArgumentException(
                $"Channel count must be 1 (mono) or 2 (stereo). Got: {_channels}",
                nameof(config));
        }

        _encoder = OpusEncoder.Create(
            config.SampleRate,
            _channels,
            OpusApplication.OPUS_APPLICATION_AUDIO);

        _encoder.Bitrate = config.OpusBitrate;
        _encoder.Complexity = 10; // Maximum quality
        _encoder.UseDTX = false; // No discontinuous transmission
        _encoder.UseInbandFEC = true; // Enable forward error correction

        // Pre-allocate buffers to avoid per-frame allocations
        _shortBuffer = new short[_frameSize * _channels];
        _outputBuffer = new byte[_frameSize * _channels * sizeof(short)];
    }

    /// <summary>
    /// Encodes a frame of PCM float samples to an Opus frame.
    /// </summary>
    /// <param name="pcmFrame">
    /// The PCM float samples in the range [-1.0, 1.0].
    /// For stereo, samples are interleaved: [L0, R0, L1, R1, ...].
    /// Length must equal frameSize * channelCount.
    /// </param>
    /// <returns>
    /// The encoded Opus frame as a byte array.
    /// The returned array is reused between calls - copy if you need to retain the data.
    /// </returns>
    /// <exception cref="ArgumentNullException">Thrown when pcmFrame is null.</exception>
    /// <exception cref="ArgumentException">Thrown when pcmFrame length doesn't match expected frame size.</exception>
    /// <exception cref="ObjectDisposedException">Thrown when the encoder has been disposed.</exception>
    public byte[] Encode(float[] pcmFrame)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        ArgumentNullException.ThrowIfNull(pcmFrame);

        int expectedLength = _frameSize * _channels;
        if (pcmFrame.Length != expectedLength)
        {
            throw new ArgumentException(
                $"PCM frame length {pcmFrame.Length} doesn't match expected size {expectedLength} " +
                $"(frameSize={_frameSize} * channels={_channels})",
                nameof(pcmFrame));
        }

        // Convert float PCM to short PCM (Concentus requires short[])
        ConvertFloatToShort(pcmFrame, _shortBuffer);

        // Encode to Opus
        int encodedLength = _encoder.Encode(
            _shortBuffer,
            0,
            _frameSize,
            _outputBuffer,
            0,
            _outputBuffer.Length);

        if (encodedLength < 0)
        {
            throw new InvalidOperationException(
                $"Opus encoding failed with error code: {encodedLength}");
        }

        // Return exactly the encoded portion (reused buffer)
        if (encodedLength == _outputBuffer.Length)
        {
            return _outputBuffer;
        }

        // Create a new array for the exact size if different from buffer
        var result = new byte[encodedLength];
        Buffer.BlockCopy(_outputBuffer, 0, result, 0, encodedLength);
        return result;
    }

    /// <summary>
    /// Converts float PCM samples to short PCM samples with clipping.
    /// </summary>
    /// <param name="floats">Input float samples in range [-1.0, 1.0].</param>
    /// <param name="shorts">Output short samples.</param>
    private static void ConvertFloatToShort(ReadOnlySpan<float> floats, Span<short> shorts)
    {
        for (int i = 0; i < floats.Length; i++)
        {
            // Clamp to [-1.0, 1.0] and scale to short range
            float sample = Math.Clamp(floats[i], -1f, 1f);
            shorts[i] = (short)(sample * short.MaxValue);
        }
    }

    /// <summary>
    /// Gets the number of channels configured for this encoder.
    /// </summary>
    public int ChannelCount => _channels;

    /// <summary>
    /// Gets the frame size in samples per channel configured for this encoder.
    /// </summary>
    public int FrameSize => _frameSize;

    /// <summary>
    /// Gets or sets the bitrate in bits per second.
    /// </summary>
    public int Bitrate
    {
        get => _encoder.Bitrate;
        set => _encoder.Bitrate = value;
    }

    /// <summary>
    /// Releases all resources used by the <see cref="OpusEncoderService"/>.
    /// Note: OpusEncoder is a struct in Concentus and doesn't require explicit disposal.
    /// </summary>
    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        // OpusEncoder is a struct in Concentus and doesn't implement IDisposable.
        // Clear the buffers to help GC
        Array.Clear(_shortBuffer);
        Array.Clear(_outputBuffer);
        _disposed = true;
    }
}
