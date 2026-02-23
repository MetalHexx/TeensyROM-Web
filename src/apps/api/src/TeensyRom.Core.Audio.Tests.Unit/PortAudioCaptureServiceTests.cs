using AutoFixture;
using FluentAssertions;
using TeensyRom.Core.Audio;
using TeensyRom.Core.Entities.Audio;
using Xunit;
using Xunit.Sdk;

namespace TeensyRom.Core.Audio.Tests.Unit;

/// <summary>
/// Unit tests for <see cref="PortAudioCaptureService"/>.
/// Note: Tests that require actual PortAudio device enumeration will be skipped
/// if PortAudio is not available (CI environments, machines without audio devices).
/// </summary>
public class PortAudioCaptureServiceTests : IDisposable
{
    private readonly IFixture _fixture = new Fixture();
    private PortAudioCaptureService? _service;

    public void Dispose()
    {
        _service?.Dispose();
    }

    [Fact]
    public void Constructor_DoesNotThrow()
    {
        // Arrange & Act
        var act = () => _service = new PortAudioCaptureService();

        // Assert
        act.Should().NotThrow();
    }

    [Fact]
    public void Dispose_WhenCalledMultipleTimes_DoesNotThrow()
    {
        // Arrange
        _service = new PortAudioCaptureService();

        // Act
        var act = () =>
        {
            _service.Dispose();
            _service.Dispose();
        };

        // Assert
        act.Should().NotThrow();
    }

    [Fact]
    public void StopCapture_WhenNotCapturing_DoesNotThrow()
    {
        // Arrange
        _service = new PortAudioCaptureService();

        // Act
        var act = () => _service.StopCapture();

        // Assert
        act.Should().NotThrow();
    }

    [Fact]
    public async Task StartCapture_WithNullConfig_ThrowsArgumentNullException()
    {
        // Arrange
        _service = new PortAudioCaptureService();

        // Act
        var act = async () =>
        {
            await foreach (var _ in _service.StartCapture(null!, CancellationToken.None))
            {
                break;
            }
        };

        // Assert
        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    [Fact]
    public async Task StartCapture_WithZeroChannelCount_ThrowsArgumentException()
    {
        // Arrange
        _service = new PortAudioCaptureService();
        var config = new AudioStreamConfig
        {
            DeviceIndex = 0,
            ChannelCount = 0,
            SampleRate = 48000,
            OpusBitrate = 64000
        };

        // Act
        var act = async () =>
        {
            await foreach (var _ in _service.StartCapture(config, CancellationToken.None))
            {
                break;
            }
        };

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("Channel count must be greater than zero.*");
    }

    [Fact]
    public async Task StartCapture_WithNegativeChannelCount_ThrowsArgumentException()
    {
        // Arrange
        _service = new PortAudioCaptureService();
        var config = new AudioStreamConfig
        {
            DeviceIndex = 0,
            ChannelCount = -1,
            SampleRate = 48000,
            OpusBitrate = 64000
        };

        // Act
        var act = async () =>
        {
            await foreach (var _ in _service.StartCapture(config, CancellationToken.None))
            {
                break;
            }
        };

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("Channel count must be greater than zero.*");
    }

    [Fact]
    public async Task StartCapture_WithZeroSampleRate_ThrowsArgumentException()
    {
        // Arrange
        _service = new PortAudioCaptureService();
        var config = new AudioStreamConfig
        {
            DeviceIndex = 0,
            ChannelCount = 2,
            SampleRate = 0,
            OpusBitrate = 64000
        };

        // Act
        var act = async () =>
        {
            await foreach (var _ in _service.StartCapture(config, CancellationToken.None))
            {
                break;
            }
        };

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("Sample rate must be greater than zero.*");
    }

    [Fact]
    public async Task StartCapture_WithNegativeSampleRate_ThrowsArgumentException()
    {
        // Arrange
        _service = new PortAudioCaptureService();
        var config = new AudioStreamConfig
        {
            DeviceIndex = 0,
            ChannelCount = 2,
            SampleRate = -1,
            OpusBitrate = 64000
        };

        // Act
        var act = async () =>
        {
            await foreach (var _ in _service.StartCapture(config, CancellationToken.None))
            {
                break;
            }
        };

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("Sample rate must be greater than zero.*");
    }

    [Fact]
    public async Task StartCapture_WithPreCancelledToken_YieldsNoData()
    {
        // Arrange
        _service = new PortAudioCaptureService();
        var config = _fixture.Build<AudioStreamConfig>()
            .With(x => x.DeviceIndex, 0)
            .With(x => x.ChannelCount, 2)
            .With(x => x.SampleRate, 48000)
            .Create();
        var cts = new CancellationTokenSource();
        cts.Cancel();

        // Act
        var results = new List<byte[]>();
        await foreach (var chunk in _service.StartCapture(config, cts.Token))
        {
            results.Add(chunk);
        }

        // Assert
        results.Should().BeEmpty();
    }

    [Fact]
    public void GetDevices_WhenPortAudioNotInitialized_ThrowsInvalidOperationException()
    {
        // This test verifies the behavior when PortAudio native libraries are unavailable
        // The actual behavior depends on whether PortAudio can be initialized

        // Arrange
        _service = new PortAudioCaptureService();

        // Act & Assert
        // If PortAudio is available, this should not throw
        // If PortAudio is unavailable, it should throw InvalidOperationException
        try
        {
            var devices = _service.GetDevices();
            devices.Should().NotBeNull();
        }
        catch (InvalidOperationException ex)
        {
            ex.Message.Should().Contain("Failed to initialize PortAudio");
        }
    }

    [Fact]
    public void StopCapture_AfterDispose_DoesNotThrow()
    {
        // Arrange
        _service = new PortAudioCaptureService();
        _service.Dispose();

        // Act
        var act = () => _service.StopCapture();

        // Assert
        act.Should().NotThrow();
    }

    [Fact]
    public void GetDeviceByName_WithNullName_ReturnsNull()
    {
        // Arrange
        _service = new PortAudioCaptureService();

        // Act
        var result = _service.GetDeviceByName(null!);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public void GetDeviceByName_WithEmptyName_ReturnsNull()
    {
        // Arrange
        _service = new PortAudioCaptureService();

        // Act
        var result = _service.GetDeviceByName(string.Empty);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public void GetDeviceByName_WithWhitespaceName_ReturnsNull()
    {
        // Arrange
        _service = new PortAudioCaptureService();

        // Act
        var result = _service.GetDeviceByName("   ");

        // Assert
        result.Should().BeNull();
    }
}

/// <summary>
/// Integration tests that require actual PortAudio devices.
/// These tests are skipped in CI environments without audio hardware.
/// </summary>
[Trait("Category", "Integration")]
public class PortAudioCaptureServiceIntegrationTests : IAsyncLifetime, IDisposable
{
    private readonly IFixture _fixture = new Fixture();
    private PortAudioCaptureService? _service;

    public Task InitializeAsync()
    {
        _service = new PortAudioCaptureService();
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        return Task.CompletedTask;
    }

    public void Dispose()
    {
        _service?.Dispose();
    }

    [SkippableFact]
    public void GetDeviceByName_WithExactMatch_ReturnsDevice()
    {
        // Arrange
        Skip.IfNot(PortAudioCaptureService.IsPortAudioInitialized,
            "PortAudio is not available - skipping integration test");

        var devices = _service!.GetDevices().ToList();
        Skip.If(devices.Count == 0, "No input devices available");

        var targetDevice = devices[0];

        // Act
        var result = _service.GetDeviceByName(targetDevice.Name);

        // Assert
        result.Should().NotBeNull();
        result!.Index.Should().Be(targetDevice.Index);
        result.Name.Should().Be(targetDevice.Name);
    }

    [SkippableFact]
    public void GetDeviceByName_WithCaseInsensitiveMatch_ReturnsDevice()
    {
        // Arrange
        Skip.IfNot(PortAudioCaptureService.IsPortAudioInitialized,
            "PortAudio is not available - skipping integration test");

        var devices = _service!.GetDevices().ToList();
        Skip.If(devices.Count == 0, "No input devices available");

        var targetDevice = devices[0];
        var upperCaseName = targetDevice.Name.ToUpperInvariant();

        // Act
        var result = _service.GetDeviceByName(upperCaseName);

        // Assert
        result.Should().NotBeNull();
        result!.Index.Should().Be(targetDevice.Index);
    }

    [SkippableFact]
    public void GetDeviceByName_WithSubstringMatch_ReturnsDevice()
    {
        // Arrange
        Skip.IfNot(PortAudioCaptureService.IsPortAudioInitialized,
            "PortAudio is not available - skipping integration test");

        var devices = _service!.GetDevices().ToList();
        Skip.If(devices.Count == 0, "No input devices available");

        var targetDevice = devices[0];
        // Use a substring of the device name (first 3 chars, if name is long enough)
        var substring = targetDevice.Name.Length > 3
            ? targetDevice.Name.Substring(0, 3)
            : targetDevice.Name;

        // Act
        var result = _service.GetDeviceByName(substring);

        // Assert
        result.Should().NotBeNull();
    }

    [SkippableFact]
    public void GetDeviceByName_WithNonExistentName_ReturnsNull()
    {
        // Arrange
        Skip.IfNot(PortAudioCaptureService.IsPortAudioInitialized,
            "PortAudio is not available - skipping integration test");

        // Act
        var result = _service!.GetDeviceByName("NonExistentDevice12345");

        // Assert
        result.Should().BeNull();
    }

    [SkippableFact]
    public void GetDevices_ReturnsOnlyInputCapableDevices()
    {
        // Arrange
        Skip.IfNot(PortAudioCaptureService.IsPortAudioInitialized,
            "PortAudio is not available - skipping integration test");

        // Act
        var devices = _service!.GetDevices().ToList();

        // Assert
        devices.Should().NotBeEmpty("at least one input device should be available");
        devices.All(d => d.MaxInputChannels > 0).Should().BeTrue(
            "all returned devices should have input capability");
    }

    [SkippableFact]
    public void GetDevices_ReturnsDevicesWithValidMetadata()
    {
        // Arrange
        Skip.IfNot(PortAudioCaptureService.IsPortAudioInitialized,
            "PortAudio is not available - skipping integration test");

        // Act
        var devices = _service!.GetDevices().ToList();

        // Assert
        foreach (var device in devices)
        {
            device.Index.Should().BeGreaterOrEqualTo(0);
            device.Name.Should().NotBeNullOrEmpty();
            device.MaxInputChannels.Should().BeGreaterThan(0);
            device.DefaultSampleRate.Should().BeGreaterThan(0);
        }
    }

    [SkippableFact]
    public async Task StartCapture_WithValidConfig_YieldsPcmData()
    {
        // Arrange
        Skip.IfNot(PortAudioCaptureService.IsPortAudioInitialized,
            "PortAudio is not available - skipping integration test");

        var devices = _service!.GetDevices().ToList();
        Skip.If(devices.Count == 0, "No input devices available");

        var config = new AudioStreamConfig
        {
            DeviceIndex = devices[0].Index,
            ChannelCount = Math.Min(2, devices[0].MaxInputChannels),
            SampleRate = 48000,
            OpusBitrate = 64000
        };

        using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(500));

        // Act
        var results = new List<byte[]>();
        await foreach (var chunk in _service.StartCapture(config, cts.Token))
        {
            results.Add(chunk);
            if (results.Count >= 5) // Get at least 5 chunks
                break;
        }

        // Assert
        results.Should().NotBeEmpty("capture should produce PCM data");
        results.All(c => c.Length > 0).Should().BeTrue("all chunks should have data");

        // Verify chunk size matches expected frame size
        // At 48kHz, 20ms = 960 samples * channels * sizeof(float)
        var expectedBytesPerChunk = 960 * config.ChannelCount * sizeof(float);
        results.All(c => c.Length == expectedBytesPerChunk).Should().BeTrue(
            $"all chunks should be {expectedBytesPerChunk} bytes");
    }

    [SkippableFact]
    public async Task StartCapture_WithStopCapture_StopsYieldingData()
    {
        // Arrange
        Skip.IfNot(PortAudioCaptureService.IsPortAudioInitialized,
            "PortAudio is not available - skipping integration test");

        var devices = _service!.GetDevices().ToList();
        Skip.If(devices.Count == 0, "No input devices available");

        var config = new AudioStreamConfig
        {
            DeviceIndex = devices[0].Index,
            ChannelCount = Math.Min(2, devices[0].MaxInputChannels),
            SampleRate = 48000,
            OpusBitrate = 64000
        };

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var captureCount = 0;

        // Act - start capture in background
        var captureTask = Task.Run(async () =>
        {
            await foreach (var chunk in _service.StartCapture(config, cts.Token))
            {
                Interlocked.Increment(ref captureCount);
                if (captureCount == 3)
                {
                    _service.StopCapture();
                }
            }
        });

        await captureTask;

        // Assert
        captureCount.Should().BeGreaterOrEqualTo(3, "should have received at least 3 chunks before stop");
    }
}
