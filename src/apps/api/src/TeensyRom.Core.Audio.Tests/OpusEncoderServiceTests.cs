using FluentAssertions;
using TeensyRom.Core.Audio;
using TeensyRom.Core.Entities.Audio;
using Xunit;

namespace TeensyRom.Core.Audio.Tests;

/// <summary>
/// Unit tests for OpusEncoderService.
/// Tests verify encoding produces valid output, handles edge cases,
/// and validates configuration requirements.
/// </summary>
public class OpusEncoderServiceTests : IDisposable
{
    private const int DefaultSampleRate = 48000;
    private const int DefaultFrameSize = 960; // 20ms at 48kHz
    private const int DefaultBitrate = 128000;
    private const int MonoChannels = 1;
    private const int StereoChannels = 2;

    private OpusEncoderService? _sut;

    public void Dispose()
    {
        _sut?.Dispose();
    }

    #region Constructor Tests

    [Fact]
    public void Constructor_WithValidMonoConfig_CreatesEncoder()
    {
        // Arrange
        var config = CreateConfig(
            channelCount: MonoChannels,
            sampleRate: DefaultSampleRate,
            bitrate: DefaultBitrate);

        // Act
        _sut = new OpusEncoderService(config);

        // Assert
        _sut.Should().NotBeNull();
        _sut.ChannelCount.Should().Be(MonoChannels);
        _sut.FrameSize.Should().Be(DefaultFrameSize);
    }

    [Fact]
    public void Constructor_WithValidStereoConfig_CreatesEncoder()
    {
        // Arrange
        var config = CreateConfig(
            channelCount: StereoChannels,
            sampleRate: DefaultSampleRate,
            bitrate: DefaultBitrate);

        // Act
        _sut = new OpusEncoderService(config);

        // Assert
        _sut.Should().NotBeNull();
        _sut.ChannelCount.Should().Be(StereoChannels);
        _sut.FrameSize.Should().Be(DefaultFrameSize);
    }

    [Fact]
    public void Constructor_WithNullConfig_ThrowsArgumentNullException()
    {
        // Act
        var act = () => _sut = new OpusEncoderService(null!);

        // Assert
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("config");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(3)]
    [InlineData(-1)]
    public void Constructor_WithInvalidChannelCount_ThrowsArgumentException(int channels)
    {
        // Arrange
        var config = CreateConfig(
            channelCount: channels,
            sampleRate: DefaultSampleRate,
            bitrate: DefaultBitrate);

        // Act
        var act = () => _sut = new OpusEncoderService(config);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*Channel count must be 1 (mono) or 2 (stereo)*");
    }

    [Theory]
    [InlineData(44100)]  // 882 - not a valid Opus frame size
    [InlineData(22050)]  // 441 - not a valid Opus frame size
    public void Constructor_WithInvalidFrameSize_ThrowsArgumentException(int sampleRate)
    {
        // Arrange
        var config = CreateConfig(
            channelCount: MonoChannels,
            sampleRate: sampleRate,
            bitrate: DefaultBitrate);

        // Act
        var act = () => _sut = new OpusEncoderService(config);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*Frame size*is not valid for Opus encoding*");
    }

    #endregion

    #region Encode Tests - Valid Input

    [Fact]
    public void Encode_WithValidMonoPcm_ReturnsNonEmptyOutput()
    {
        // Arrange
        var config = CreateConfig(
            channelCount: MonoChannels,
            sampleRate: DefaultSampleRate,
            bitrate: DefaultBitrate);
        _sut = new OpusEncoderService(config);

        var pcmFrame = CreateSineWaveFrame(DefaultFrameSize, MonoChannels);

        // Act
        var result = _sut.Encode(pcmFrame);

        // Assert
        result.Should().NotBeEmpty();
        result.Length.Should().BeGreaterThan(0);
        // Opus compression should produce output smaller than raw PCM
        result.Length.Should().BeLessThan(DefaultFrameSize * sizeof(short));
    }

    [Fact]
    public void Encode_WithValidStereoPcm_ReturnsNonEmptyOutput()
    {
        // Arrange
        var config = CreateConfig(
            channelCount: StereoChannels,
            sampleRate: DefaultSampleRate,
            bitrate: DefaultBitrate);
        _sut = new OpusEncoderService(config);

        var pcmFrame = CreateSineWaveFrame(DefaultFrameSize, StereoChannels);

        // Act
        var result = _sut.Encode(pcmFrame);

        // Assert
        result.Should().NotBeEmpty();
        result.Length.Should().BeGreaterThan(0);
        // Opus compression should produce output smaller than raw PCM
        result.Length.Should().BeLessThan(DefaultFrameSize * StereoChannels * sizeof(short));
    }

    [Fact]
    public void Encode_WithSilence_ReturnsValidSmallOutput()
    {
        // Arrange
        var config = CreateConfig(
            channelCount: MonoChannels,
            sampleRate: DefaultSampleRate,
            bitrate: DefaultBitrate);
        _sut = new OpusEncoderService(config);

        var silenceFrame = CreateSilenceFrame(DefaultFrameSize);

        // Act
        var result = _sut.Encode(silenceFrame);

        // Assert
        result.Should().NotBeEmpty();
        // Silence should compress very well
        result.Length.Should().BeGreaterThan(0);
    }

    [Fact]
    public void Encode_WithMaxAmplitude_ReturnsValidOutput()
    {
        // Arrange
        var config = CreateConfig(
            channelCount: MonoChannels,
            sampleRate: DefaultSampleRate,
            bitrate: DefaultBitrate);
        _sut = new OpusEncoderService(config);

        var maxAmplitudeFrame = CreateMaxAmplitudeFrame(DefaultFrameSize);

        // Act
        var result = _sut.Encode(maxAmplitudeFrame);

        // Assert
        result.Should().NotBeEmpty();
        result.Length.Should().BeGreaterThan(0);
    }

    [Fact]
    public void Encode_WithMultipleFrames_ReturnsValidOutputForEach()
    {
        // Arrange
        var config = CreateConfig(
            channelCount: MonoChannels,
            sampleRate: DefaultSampleRate,
            bitrate: DefaultBitrate);
        _sut = new OpusEncoderService(config);

        // Act & Assert - encoder should handle multiple frames without reinitialization
        for (int i = 0; i < 10; i++)
        {
            var frame = CreateSineWaveFrame(DefaultFrameSize, MonoChannels, frequency: 440 + i * 100);
            var result = _sut.Encode(frame);
            result.Should().NotBeEmpty($"frame {i} should produce output");
        }
    }

    #endregion

    #region Encode Tests - Error Cases

    [Fact]
    public void Encode_WithNullFrame_ThrowsArgumentNullException()
    {
        // Arrange
        var config = CreateConfig(
            channelCount: MonoChannels,
            sampleRate: DefaultSampleRate,
            bitrate: DefaultBitrate);
        _sut = new OpusEncoderService(config);

        // Act
        var act = () => _sut.Encode(null!);

        // Assert
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("pcmFrame");
    }

    [Fact]
    public void Encode_WithWrongFrameSize_ThrowsArgumentException()
    {
        // Arrange
        var config = CreateConfig(
            channelCount: MonoChannels,
            sampleRate: DefaultSampleRate,
            bitrate: DefaultBitrate);
        _sut = new OpusEncoderService(config);

        var wrongSizeFrame = new float[500]; // Wrong size

        // Act
        var act = () => _sut.Encode(wrongSizeFrame);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*PCM frame length*doesn't match expected size*");
    }

    [Fact]
    public void Encode_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var config = CreateConfig(
            channelCount: MonoChannels,
            sampleRate: DefaultSampleRate,
            bitrate: DefaultBitrate);
        _sut = new OpusEncoderService(config);
        _sut.Dispose();

        var frame = CreateSineWaveFrame(DefaultFrameSize, MonoChannels);

        // Act
        var act = () => _sut.Encode(frame);

        // Assert
        act.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region Configuration Tests

    [Fact]
    public void Bitrate_CanBeModifiedAfterConstruction()
    {
        // Arrange
        var config = CreateConfig(
            channelCount: MonoChannels,
            sampleRate: DefaultSampleRate,
            bitrate: DefaultBitrate);
        _sut = new OpusEncoderService(config);

        // Act
        _sut.Bitrate = 64000;

        // Assert
        _sut.Bitrate.Should().Be(64000);
    }

    [Theory]
    [InlineData(64000)]   // 64 kbps
    [InlineData(96000)]   // 96 kbps
    [InlineData(128000)]  // 128 kbps
    [InlineData(192000)]  // 192 kbps
    public void Encode_WithDifferentBitrates_ProducesValidOutput(int bitrate)
    {
        // Arrange
        var config = CreateConfig(
            channelCount: MonoChannels,
            sampleRate: DefaultSampleRate,
            bitrate: bitrate);
        _sut = new OpusEncoderService(config);

        var frame = CreateSineWaveFrame(DefaultFrameSize, MonoChannels);

        // Act
        var result = _sut.Encode(frame);

        // Assert
        result.Should().NotBeEmpty();
    }

    #endregion

    #region Static Helper Tests

    [Theory]
    [InlineData(48000, 960)]   // 48kHz -> 20ms
    [InlineData(24000, 480)]   // 24kHz -> 20ms
    [InlineData(16000, 320)]   // 16kHz -> 20ms (not valid for Opus)
    [InlineData(12000, 240)]   // 12kHz -> 20ms
    public void GetFrameSizeFor20ms_ReturnsCorrectFrameSize(int sampleRate, int expectedFrameSize)
    {
        // Act
        var result = OpusEncoderService.GetFrameSizeFor20ms(sampleRate);

        // Assert
        result.Should().Be(expectedFrameSize);
    }

    [Theory]
    [InlineData(120, true)]
    [InlineData(240, true)]
    [InlineData(480, true)]
    [InlineData(960, true)]
    [InlineData(1920, true)]
    [InlineData(2880, true)]
    [InlineData(100, false)]
    [InlineData(500, false)]
    [InlineData(1000, false)]
    public void IsValidFrameSize_ReturnsCorrectResult(int frameSize, bool expected)
    {
        // Act
        var result = OpusEncoderService.IsValidFrameSize(frameSize);

        // Assert
        result.Should().Be(expected);
    }

    #endregion

    #region Helper Methods

    private static AudioStreamConfig CreateConfig(int channelCount, int sampleRate, int bitrate) => new()
    {
        DeviceIndex = 0,
        ChannelCount = channelCount,
        SampleRate = sampleRate,
        OpusBitrate = bitrate
    };

    private static float[] CreateSilenceFrame(int frameSize) => new float[frameSize];

    private static float[] CreateMaxAmplitudeFrame(int frameSize)
    {
        var frame = new float[frameSize];
        for (int i = 0; i < frameSize; i++)
        {
            frame[i] = i % 2 == 0 ? 1.0f : -1.0f; // Alternating max amplitude
        }
        return frame;
    }

    private static float[] CreateSineWaveFrame(int frameSize, int channels, float frequency = 440f)
    {
        var frame = new float[frameSize * channels];
        for (int i = 0; i < frameSize; i++)
        {
            float sample = MathF.Sin(2 * MathF.PI * frequency * i / DefaultSampleRate);
            for (int c = 0; c < channels; c++)
            {
                frame[i * channels + c] = sample;
            }
        }
        return frame;
    }

    #endregion
}
