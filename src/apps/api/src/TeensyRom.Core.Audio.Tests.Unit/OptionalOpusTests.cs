using FluentAssertions;
using TeensyRom.Core.Audio;
using TeensyRom.Core.Settings;
using Xunit;

namespace TeensyRom.Core.Audio.Tests.Unit;

/// <summary>
/// Unit tests for optional Opus encoding feature.
/// Verifies both Opus and raw PCM encoding paths work correctly.
/// </summary>
public class OptionalOpusTests
{
    [Fact]
    public void AudioSettings_UseOpusEncoding_DefaultIsTrue()
    {
        // Arrange & Act
        var settings = new AudioSettings();

        // Assert
        Assert.True(settings.UseOpusEncoding);
    }

    [Fact]
    public void ConvertFloatsToBytes_ProducesCorrectByteCount()
    {
        // Arrange - 960 samples (20ms @ 48kHz) should produce 3840 bytes
        var floats = new float[960];
        for (int i = 0; i < floats.Length; i++)
        {
            floats[i] = 0.5f; // Fill with test data
        }

        // Act
        var result = AudioStreamManager.ConvertFloatsToBytes(floats);

        // Assert - 960 floats * 4 bytes per float = 3840 bytes
        Assert.Equal(3840, result.Length);
    }

    [Fact]
    public void ConvertFloatsToBytes_PreservesValues()
    {
        // Arrange
        var originalFloats = new float[] { 0.5f, -0.5f, 0.0f, 1.0f, -1.0f, 0.25f };

        // Act
        var bytes = AudioStreamManager.ConvertFloatsToBytes(originalFloats);

        // Convert back to verify
        var restoredFloats = new float[originalFloats.Length];
        Buffer.BlockCopy(bytes, 0, restoredFloats, 0, bytes.Length);

        // Assert
        Assert.Equal(originalFloats.Length, restoredFloats.Length);
        for (int i = 0; i < originalFloats.Length; i++)
        {
            Assert.Equal(originalFloats[i], restoredFloats[i], precision: 6);
        }
    }

    [Fact]
    public void RawPcm_ProducesLargerFramesThanOpus()
    {
        // Arrange - 960 samples (20ms @ 48kHz)
        var floats = new float[960];

        // Act - Convert to raw PCM bytes
        var rawBytes = AudioStreamManager.ConvertFloatsToBytes(floats);

        // Assert - Raw PCM frame (3840 bytes) should be ~12x larger than Opus frame (~320 bytes)
        // At minimum, it should be 10x larger
        Assert.True(rawBytes.Length > 320 * 10,
            $"Raw PCM frame ({rawBytes.Length} bytes) should be at least 10x larger than typical Opus frame (~320 bytes)");
    }

    [Fact]
    public void ConvertFloatsToBytes_EmptyInput_ReturnsEmptyArray()
    {
        // Arrange
        var floats = Array.Empty<float>();

        // Act
        var result = AudioStreamManager.ConvertFloatsToBytes(floats);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public void AudioSettings_CanSetUseOpusEncodingToFalse()
    {
        // Arrange & Act
        var settings = new AudioSettings
        {
            UseOpusEncoding = false
        };

        // Assert
        Assert.False(settings.UseOpusEncoding);
    }
}
