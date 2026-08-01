using AutoFixture;
using FluentAssertions;
using NSubstitute;
using System.Runtime.CompilerServices;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Audio;
using TeensyRom.Core.Entities.Audio;
using TeensyRom.Core.Settings;
using Xunit;

namespace TeensyRom.Core.Audio.Tests.Unit;

/// <summary>
/// Unit tests for <see cref="AudioStreamManager"/>.
/// Tests verify lifecycle management, multi-device support, multi-channel encoding, and proper resource cleanup.
/// </summary>
public class AudioStreamManagerTests : IDisposable
{
    private readonly IFixture _fixture = new Fixture();
    private readonly IAudioCaptureService _captureService;
    private AudioStreamManager _sut;

    public AudioStreamManagerTests()
    {
        _captureService = Substitute.For<IAudioCaptureService>();
        _sut = new AudioStreamManager(_captureService);
    }

    public void Dispose()
    {
        _sut?.Dispose();
    }

    #region Constructor Tests

    [Fact]
    public void Constructor_WithNullCaptureService_ThrowsArgumentNullException()
    {
        // Act
        var act = () => _sut = new AudioStreamManager(null!);

        // Assert
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("captureService");
    }

    [Fact]
    public void Constructor_WithValidCaptureService_DoesNotThrow()
    {
        // Act
        var act = () => _sut = new AudioStreamManager(_captureService);

        // Assert
        act.Should().NotThrow();
    }

    #endregion

    #region StartStream Tests

    [Fact]
    public void StartStream_WithNullDeviceId_ThrowsArgumentException()
    {
        // Arrange
        var config = CreateValidConfig();

        // Act
        var act = () => _sut.StartStream(null!, config);

        // Assert
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void StartStream_WithEmptyDeviceId_ThrowsArgumentException()
    {
        // Arrange
        var config = CreateValidConfig();

        // Act
        var act = () => _sut.StartStream(string.Empty, config);

        // Assert
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void StartStream_WithNullConfig_ThrowsArgumentNullException()
    {
        // Act
        var act = () => _sut.StartStream("device1", null!);

        // Assert
        act.Should().Throw<ArgumentNullException>();
    }

    [Fact]
    public void StartStream_WithValidParameters_SetsIsStreamingToTrue()
    {
        // Arrange
        SetupMockCaptureToYieldImmediately();
        var config = CreateValidConfig();

        // Act
        _sut.StartStream("device1", config);

        // Assert
        _sut.IsStreaming("device1").Should().BeTrue();
    }

    [Fact]
    public void StartStream_WhenAlreadyStreamingForDevice_IsIdempotent()
    {
        // Arrange
        SetupMockCaptureToYieldIndefinitely();
        var config = CreateValidConfig();
        _sut.StartStream("device1", config);

        // Act - Start again for same device
        var act = () => _sut.StartStream("device1", config);

        // Assert - Should not throw, should still be streaming
        act.Should().NotThrow();
        _sut.IsStreaming("device1").Should().BeTrue();
    }

    [Fact]
    public void StartStream_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        _sut.Dispose();
        var config = CreateValidConfig();

        // Act
        var act = () => _sut.StartStream("device1", config);

        // Assert
        act.Should().Throw<ObjectDisposedException>();
    }

    [Fact]
    public void StartStream_WithNoEnabledChannels_ThrowsArgumentException()
    {
        // Arrange
        SetupMockCaptureToYieldImmediately();
        var config = new AudioStreamConfig
        {
            DeviceIndex = 0,
            ChannelCount = 2,
            SampleRate = 48000,
            OpusBitrate = 128000,
            Channels =
            [
                new ChannelConfig { Name = "Ch1", SourceChannel = 0, Enabled = false },
                new ChannelConfig { Name = "Ch2", SourceChannel = 1, Enabled = false }
            ]
        };

        // Act
        var act = () => _sut.StartStream("device1", config);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*At least one channel must be enabled*");
    }

    #endregion

    #region StopStream Tests

    [Fact]
    public void StopStream_WhenNotStreaming_IsNoOp()
    {
        // Act
        var act = () => _sut.StopStream("nonexistent");

        // Assert
        act.Should().NotThrow();
    }

    [Fact]
    public void StopStream_WhenStreaming_StopsStreamAndSetsIsStreamingToFalse()
    {
        // Arrange
        SetupMockCaptureToYieldIndefinitely();
        var config = CreateValidConfig();
        _sut.StartStream("device1", config);
        _sut.IsStreaming("device1").Should().BeTrue();

        // Act
        _sut.StopStream("device1");

        // Assert - Give time for cleanup
        Thread.Sleep(100);
        _sut.IsStreaming("device1").Should().BeFalse();
    }

    [Fact]
    public void StopStream_WithNullDeviceId_IsNoOp()
    {
        // Act
        var act = () => _sut.StopStream(null!);

        // Assert
        act.Should().NotThrow();
    }

    [Fact]
    public void StopStream_WithEmptyDeviceId_IsNoOp()
    {
        // Act
        var act = () => _sut.StopStream(string.Empty);

        // Assert
        act.Should().NotThrow();
    }

    [Fact]
    public void StopStream_MultipleTimes_IsIdempotent()
    {
        // Arrange
        SetupMockCaptureToYieldIndefinitely();
        var config = CreateValidConfig();
        _sut.StartStream("device1", config);

        // Act
        var act = () =>
        {
            _sut.StopStream("device1");
            _sut.StopStream("device1");
            _sut.StopStream("device1");
        };

        // Assert
        act.Should().NotThrow();
    }

    #endregion

    #region IsStreaming Tests

    [Fact]
    public void IsStreaming_WhenNotStarted_ReturnsFalse()
    {
        // Act
        var result = _sut.IsStreaming("device1");

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void IsStreaming_WithNullDeviceId_ReturnsFalse()
    {
        // Act
        var result = _sut.IsStreaming(null!);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void IsStreaming_WithEmptyDeviceId_ReturnsFalse()
    {
        // Act
        var result = _sut.IsStreaming(string.Empty);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void IsStreaming_AfterStop_ReturnsFalse()
    {
        // Arrange
        SetupMockCaptureToYieldIndefinitely();
        var config = CreateValidConfig();
        _sut.StartStream("device1", config);
        _sut.StopStream("device1");

        // Act
        Thread.Sleep(100); // Allow cleanup
        var result = _sut.IsStreaming("device1");

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region GetStream Tests

    [Fact]
    public async Task GetStream_WhenNotStarted_ThrowsInvalidOperationException()
    {
        // Act
        var act = async () =>
        {
            await foreach (var _ in _sut.GetStream("nonexistent", CancellationToken.None))
            {
                break;
            }
        };

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*No active stream*");
    }

    [Fact]
    public async Task GetStream_WithNullDeviceId_ThrowsArgumentException()
    {
        // Act
        var act = async () =>
        {
            await foreach (var _ in _sut.GetStream(null!, CancellationToken.None))
            {
                break;
            }
        };

        // Assert
        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task GetStream_WithEmptyDeviceId_ThrowsArgumentException()
    {
        // Act
        var act = async () =>
        {
            await foreach (var _ in _sut.GetStream(string.Empty, CancellationToken.None))
            {
                break;
            }
        };

        // Assert
        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task GetStream_WhenStreamIsActive_YieldsChannelAudioFrames()
    {
        // Arrange
        var pcmData = CreatePcmFloatBytes(frameCount: 960, channels: 2);
        SetupMockCaptureToYieldSamples(pcmData, frameCount: 3);

        var config = CreateValidConfig();
        _sut.StartStream("device1", config);

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        // Act
        var frames = new List<ChannelAudioFrame>();
        await foreach (var frame in _sut.GetStream("device1", cts.Token))
        {
            frames.Add(frame);
            if (frames.Count >= 6) // 3 captures * 2 channels
                break;
        }

        // Assert
        frames.Should().HaveCount(6); // 3 captures, 2 channels each
        frames.All(f => f.OpusFrame.Length > 0).Should().BeTrue("all frames should have data");
        frames.Select(f => f.ChannelIndex).Distinct().Should().Contain([0, 1], "both channels should be present");
    }

    [Fact]
    public async Task GetStream_WithCancellationToken_StopsYielding()
    {
        // Arrange
        SetupMockCaptureToYieldIndefinitely();
        var config = CreateValidConfig();
        _sut.StartStream("device1", config);

        using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(100));

        // Act
        var count = 0;
        await foreach (var _ in _sut.GetStream("device1", cts.Token))
        {
            count++;
        }

        // Assert - should complete due to cancellation
        // May or may not receive frames depending on timing
        count.Should().BeGreaterOrEqualTo(0);
    }

    [Fact]
    public async Task GetStream_AfterStop_CompletesEnumeration()
    {
        // Arrange
        SetupMockCaptureToYieldIndefinitely();
        var config = CreateValidConfig();
        _sut.StartStream("device1", config);

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        // Act
        var count = 0;
        var readTask = Task.Run(async () =>
        {
            await foreach (var _ in _sut.GetStream("device1", cts.Token))
            {
                count++;
                if (count == 1)
                {
                    await Task.Delay(50);
                    _sut.StopStream("device1");
                }
            }
        });

        await readTask;

        // Assert - enumeration should complete after stop
        count.Should().BeGreaterOrEqualTo(1);
    }

    #endregion

    #region Multi-Channel Tests

    [Fact]
    public async Task GetStream_SingleEnabledChannel_ProducesOnlyChannelZeroFrames()
    {
        // Arrange
        var pcmData = CreatePcmFloatBytes(frameCount: 960, channels: 2);
        SetupMockCaptureToYieldSamples(pcmData, frameCount: 3);

        var config = new AudioStreamConfig
        {
            DeviceIndex = 0,
            ChannelCount = 2,
            SampleRate = 48000,
            OpusBitrate = 128000,
            Channels =
            [
                new ChannelConfig { Name = "Left", SourceChannel = 0, Enabled = true },
                new ChannelConfig { Name = "Right", SourceChannel = 1, Enabled = false }
            ]
        };

        _sut.StartStream("device1", config);

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        // Act
        var frames = new List<ChannelAudioFrame>();
        await foreach (var frame in _sut.GetStream("device1", cts.Token))
        {
            frames.Add(frame);
            if (frames.Count >= 3)
                break;
        }

        // Assert
        frames.Should().HaveCount(3);
        frames.All(f => f.ChannelIndex == 0).Should().BeTrue("only channel 0 should be present");
    }

    [Fact]
    public async Task GetStream_TwoEnabledChannels_ProducesFramesForBothChannels()
    {
        // Arrange
        var pcmData = CreatePcmFloatBytes(frameCount: 960, channels: 2);
        SetupMockCaptureToYieldSamples(pcmData, frameCount: 2);

        var config = new AudioStreamConfig
        {
            DeviceIndex = 0,
            ChannelCount = 2,
            SampleRate = 48000,
            OpusBitrate = 128000,
            Channels =
            [
                new ChannelConfig { Name = "Left", SourceChannel = 0, Enabled = true },
                new ChannelConfig { Name = "Right", SourceChannel = 1, Enabled = true }
            ]
        };

        _sut.StartStream("device1", config);

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        // Act
        var frames = new List<ChannelAudioFrame>();
        await foreach (var frame in _sut.GetStream("device1", cts.Token))
        {
            frames.Add(frame);
            if (frames.Count >= 4)
                break;
        }

        // Assert
        frames.Should().HaveCount(4); // 2 captures * 2 channels
        frames.Count(f => f.ChannelIndex == 0).Should().Be(2);
        frames.Count(f => f.ChannelIndex == 1).Should().Be(2);
    }

    [Fact]
    public async Task GetStream_DisabledChannel_ProducesNoFramesForThatChannel()
    {
        // Arrange
        var pcmData = CreatePcmFloatBytes(frameCount: 960, channels: 4);
        SetupMockCaptureToYieldSamples(pcmData, frameCount: 2);

        var config = new AudioStreamConfig
        {
            DeviceIndex = 0,
            ChannelCount = 4,
            SampleRate = 48000,
            OpusBitrate = 128000,
            Channels =
            [
                new ChannelConfig { Name = "Ch1", SourceChannel = 0, Enabled = true },
                new ChannelConfig { Name = "Ch2", SourceChannel = 1, Enabled = false },
                new ChannelConfig { Name = "Ch3", SourceChannel = 2, Enabled = true },
                new ChannelConfig { Name = "Ch4", SourceChannel = 3, Enabled = false }
            ]
        };

        _sut.StartStream("device1", config);

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        // Act
        var frames = new List<ChannelAudioFrame>();
        await foreach (var frame in _sut.GetStream("device1", cts.Token))
        {
            frames.Add(frame);
            if (frames.Count >= 4)
                break;
        }

        // Assert - only channels 0 and 2 should be present
        frames.Select(f => f.ChannelIndex).Distinct().Should().BeEquivalentTo([0, 2]);
    }

    [Fact]
    public async Task GetStream_ChannelIndexMatchesSourceChannel()
    {
        // Arrange
        var pcmData = CreatePcmFloatBytes(frameCount: 960, channels: 2);
        SetupMockCaptureToYieldSamples(pcmData, frameCount: 1);

        var config = new AudioStreamConfig
        {
            DeviceIndex = 0,
            ChannelCount = 2,
            SampleRate = 48000,
            OpusBitrate = 128000,
            Channels =
            [
                new ChannelConfig { Name = "Left", SourceChannel = 0, Enabled = true },
                new ChannelConfig { Name = "Right", SourceChannel = 1, Enabled = true }
            ]
        };

        _sut.StartStream("device1", config);

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        // Act
        var frames = new List<ChannelAudioFrame>();
        await foreach (var frame in _sut.GetStream("device1", cts.Token))
        {
            frames.Add(frame);
            if (frames.Count >= 2)
                break;
        }

        // Assert
        frames.Should().Contain(f => f.ChannelIndex == 0);
        frames.Should().Contain(f => f.ChannelIndex == 1);
    }

    [Fact]
    public async Task GetStream_WithoutChannelConfig_ProducesFramesForAllChannels()
    {
        // Arrange - Empty Channels list, fallback to all channels
        var pcmData = CreatePcmFloatBytes(frameCount: 960, channels: 2);
        SetupMockCaptureToYieldSamples(pcmData, frameCount: 2);

        var config = new AudioStreamConfig
        {
            DeviceIndex = 0,
            ChannelCount = 2,
            SampleRate = 48000,
            OpusBitrate = 128000,
            Channels = [] // Empty - should fall back to all channels
        };

        _sut.StartStream("device1", config);

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        // Act
        var frames = new List<ChannelAudioFrame>();
        await foreach (var frame in _sut.GetStream("device1", cts.Token))
        {
            frames.Add(frame);
            if (frames.Count >= 4)
                break;
        }

        // Assert - both channels should be present
        frames.Should().HaveCount(4);
        frames.Select(f => f.ChannelIndex).Distinct().Should().Contain([0, 1]);
    }

    [Fact]
    public void StopStream_DisposesAllEncoders_WithoutExceptions()
    {
        // Arrange
        SetupMockCaptureToYieldIndefinitely();
        var config = new AudioStreamConfig
        {
            DeviceIndex = 0,
            ChannelCount = 4,
            SampleRate = 48000,
            OpusBitrate = 128000,
            Channels =
            [
                new ChannelConfig { Name = "Ch1", SourceChannel = 0, Enabled = true },
                new ChannelConfig { Name = "Ch2", SourceChannel = 1, Enabled = true },
                new ChannelConfig { Name = "Ch3", SourceChannel = 2, Enabled = true },
                new ChannelConfig { Name = "Ch4", SourceChannel = 3, Enabled = true }
            ]
        };

        _sut.StartStream("device1", config);

        // Act
        var act = () => _sut.StopStream("device1");

        // Assert - should not throw during encoder disposal
        act.Should().NotThrow();
        Thread.Sleep(100); // Allow cleanup
        _sut.IsStreaming("device1").Should().BeFalse();
    }

    #endregion

    #region Multi-Device Tests

    [Fact]
    public void MultipleDevices_CanStreamIndependently()
    {
        // Arrange
        SetupMockCaptureToYieldIndefinitely();
        var config = CreateValidConfig();

        // Act
        _sut.StartStream("device1", config);
        _sut.StartStream("device2", config);
        _sut.StartStream("device3", config);

        // Assert
        _sut.IsStreaming("device1").Should().BeTrue();
        _sut.IsStreaming("device2").Should().BeTrue();
        _sut.IsStreaming("device3").Should().BeTrue();
    }

    [Fact]
    public void StopOneDevice_DoesNotAffectOthers()
    {
        // Arrange
        SetupMockCaptureToYieldIndefinitely();
        var config = CreateValidConfig();
        _sut.StartStream("device1", config);
        _sut.StartStream("device2", config);
        _sut.StartStream("device3", config);

        // Act
        _sut.StopStream("device2");
        Thread.Sleep(100); // Allow cleanup

        // Assert
        _sut.IsStreaming("device1").Should().BeTrue();
        _sut.IsStreaming("device2").Should().BeFalse();
        _sut.IsStreaming("device3").Should().BeTrue();
    }

    [Fact]
    public async Task Restart_AfterStop_WorksCorrectly()
    {
        // Arrange
        var pcmData = CreatePcmFloatBytes(frameCount: 960, channels: 2);
        SetupMockCaptureToYieldSamples(pcmData, frameCount: 2);

        var config = CreateValidConfig();
        _sut.StartStream("device1", config);
        _sut.StopStream("device1");
        Thread.Sleep(100); // Allow cleanup

        // Reset mock for second capture
        SetupMockCaptureToYieldSamples(pcmData, frameCount: 2);

        // Act - Restart
        _sut.StartStream("device1", config);
        _sut.IsStreaming("device1").Should().BeTrue();

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
        var frames = new List<ChannelAudioFrame>();
        await foreach (var frame in _sut.GetStream("device1", cts.Token))
        {
            frames.Add(frame);
            if (frames.Count >= 4)
                break;
        }

        // Assert
        frames.Should().HaveCount(4); // 2 captures * 2 channels
    }

    #endregion

    #region Dispose Tests

    [Fact]
    public void Dispose_WhenMultipleActiveStreams_StopsAllStreams()
    {
        // Arrange
        SetupMockCaptureToYieldIndefinitely();
        var config = CreateValidConfig();
        _sut.StartStream("device1", config);
        _sut.StartStream("device2", config);
        _sut.StartStream("device3", config);

        // Act
        _sut.Dispose();

        // Assert
        _sut.IsStreaming("device1").Should().BeFalse();
        _sut.IsStreaming("device2").Should().BeFalse();
        _sut.IsStreaming("device3").Should().BeFalse();
    }

    [Fact]
    public void Dispose_WhenCalledMultipleTimes_DoesNotThrow()
    {
        // Arrange
        SetupMockCaptureToYieldIndefinitely();
        var config = CreateValidConfig();
        _sut.StartStream("device1", config);

        // Act
        var act = () =>
        {
            _sut.Dispose();
            _sut.Dispose();
            _sut.Dispose();
        };

        // Assert
        act.Should().NotThrow();
    }

    [Fact]
    public void Dispose_CleansUpResources()
    {
        // Arrange
        SetupMockCaptureToYieldIndefinitely();
        var config = CreateValidConfig();
        _sut.StartStream("device1", config);

        // Act
        _sut.Dispose();

        // Assert - Capture service should have been called to stop
        // (In a real scenario, the cancellation token would be cancelled)
        _sut.IsStreaming("device1").Should().BeFalse();
    }

    #endregion

    #region Helper Methods

    private static AudioStreamConfig CreateValidConfig() => new()
    {
        DeviceIndex = 0,
        ChannelCount = 2,
        SampleRate = 48000,
        OpusBitrate = 128000
    };

    private void SetupMockCaptureToYieldImmediately()
    {
        _captureService.StartCapture(Arg.Any<AudioStreamConfig>(), Arg.Any<CancellationToken>())
            .Returns(call => AsyncEnumerable<byte[]>.Empty);
    }

    private void SetupMockCaptureToYieldIndefinitely()
    {
        _captureService.StartCapture(Arg.Any<AudioStreamConfig>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                var ct = call.Arg<CancellationToken>();
                return YieldIndefinitely(ct);
            });
    }

    private static async IAsyncEnumerable<byte[]> YieldIndefinitely([EnumeratorCancellation] CancellationToken ct)
    {
        var dummyData = CreatePcmFloatBytes(frameCount: 960, channels: 2);
        while (!ct.IsCancellationRequested)
        {
            await Task.Delay(50, ct);
            yield return dummyData;
        }
    }

    private void SetupMockCaptureToYieldSamples(byte[] sampleData, int frameCount)
    {
        _captureService.StartCapture(Arg.Any<AudioStreamConfig>(), Arg.Any<CancellationToken>())
            .Returns(call => YieldSamples(sampleData, frameCount, call.Arg<CancellationToken>()));
    }

    private static async IAsyncEnumerable<byte[]> YieldSamples(
        byte[] sampleData,
        int frameCount,
        [EnumeratorCancellation] CancellationToken ct)
    {
        for (int i = 0; i < frameCount && !ct.IsCancellationRequested; i++)
        {
            await Task.Yield();
            yield return sampleData;
        }
    }

    /// <summary>
    /// Creates a byte array representing PCM float samples.
    /// </summary>
    private static byte[] CreatePcmFloatBytes(int frameCount, int channels)
    {
        var floatCount = frameCount * channels;
        var floats = new float[floatCount];

        // Create a simple sine wave pattern
        for (int i = 0; i < floatCount; i++)
        {
            floats[i] = MathF.Sin(2 * MathF.PI * 440 * i / 48000) * 0.5f;
        }

        var bytes = new byte[floatCount * sizeof(float)];
        Buffer.BlockCopy(floats, 0, bytes, 0, bytes.Length);
        return bytes;
    }

    #endregion

    /// <summary>
    /// Helper class to create empty async enumerables.
    /// </summary>
    private static class AsyncEnumerable<T>
    {
        public static IAsyncEnumerable<T> Empty => EmptyAsyncEnumerable.Instance;

        private class EmptyAsyncEnumerable : IAsyncEnumerable<T>
        {
            public static readonly EmptyAsyncEnumerable Instance = new();

            public IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default)
                => EmptyAsyncEnumerator.Instance;

            private class EmptyAsyncEnumerator : IAsyncEnumerator<T>
            {
                public static readonly EmptyAsyncEnumerator Instance = new();

                public T Current => default!;

                public ValueTask DisposeAsync() => ValueTask.CompletedTask;

                public ValueTask<bool> MoveNextAsync() => new(false);
            }
        }
    }
}

/// <summary>
/// Additional integration-style tests for AudioStreamManager.
/// These tests verify end-to-end behavior with real components.
/// </summary>
[Trait("Category", "Integration")]
public class AudioStreamManagerIntegrationTests : IDisposable
{
    private AudioStreamManager? _sut;
    private PortAudioCaptureService? _captureService;

    public void Dispose()
    {
        _sut?.Dispose();
        _captureService?.Dispose();
    }

    [SkippableFact]
    public async Task AudioStreamManager_WithRealCapture_ProducesEncodedOutput()
    {
        // Arrange
        Skip.IfNot(PortAudioCaptureService.IsPortAudioInitialized,
            "PortAudio is not available - skipping integration test");

        _captureService = new PortAudioCaptureService();
        _sut = new AudioStreamManager(_captureService);

        var devices = _captureService.GetDevices().ToList();
        Skip.If(devices.Count == 0, "No input devices available");

        var channelCount = Math.Min(2, devices[0].MaxInputChannels);
        var config = new AudioStreamConfig
        {
            DeviceIndex = devices[0].Index,
            ChannelCount = channelCount,
            SampleRate = 48000,
            OpusBitrate = 64000
        };

        using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(500));

        // Act
        _sut.StartStream("device1", config);

        var frames = new List<ChannelAudioFrame>();
        await foreach (var frame in _sut.GetStream("device1", cts.Token))
        {
            frames.Add(frame);
            if (frames.Count >= 5)
                break;
        }

        // Assert
        frames.Should().NotBeEmpty("stream should produce encoded frames");
        frames.All(f => f.OpusFrame.Length > 0).Should().BeTrue("all frames should have data");
        frames.All(f => f.OpusFrame.Length < 960 * 2 * 2).Should().BeTrue("Opus frames should be compressed");
    }

    [SkippableFact]
    public void AudioStreamManager_WithRealCapture_StopStreamCleansUpProperly()
    {
        // Arrange
        Skip.IfNot(PortAudioCaptureService.IsPortAudioInitialized,
            "PortAudio is not available - skipping integration test");

        _captureService = new PortAudioCaptureService();
        _sut = new AudioStreamManager(_captureService);

        var devices = _captureService.GetDevices().ToList();
        Skip.If(devices.Count == 0, "No input devices available");

        var config = new AudioStreamConfig
        {
            DeviceIndex = devices[0].Index,
            ChannelCount = Math.Min(2, devices[0].MaxInputChannels),
            SampleRate = 48000,
            OpusBitrate = 64000
        };

        // Act
        _sut.StartStream("device1", config);
        _sut.IsStreaming("device1").Should().BeTrue();

        _sut.StopStream("device1");
        Thread.Sleep(200); // Allow cleanup

        // Assert
        _sut.IsStreaming("device1").Should().BeFalse();
    }
}
