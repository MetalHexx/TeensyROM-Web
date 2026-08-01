using FluentAssertions;
using TeensyRom.Api.Endpoints.Settings;
using TeensyRom.Core.Settings;
using Xunit;

namespace TeensyRom.Api.Tests.Unit;

/// <summary>
/// Unit tests for settings mappers verifying correct mapping between
/// ChannelConfig entities and ChannelConfigDto DTOs.
/// </summary>
public class SettingsMapperTests
{

    #region ChannelConfig Mapping Tests

    [Fact]
    public void ChannelConfigDto_ToEntity_MapsAllProperties()
    {
        // Arrange
        var dto = new ChannelConfigDto
        {
            SourceChannel = 0,
            Enabled = true
        };

        // Act - Simulate SaveSettingsMapper mapping
        var entity = MapChannelConfigToEntity(dto);

        // Assert
        entity.SourceChannel.Should().Be(0);
        entity.Enabled.Should().BeTrue();
    }

    [Fact]
    public void ChannelConfig_ToDto_MapsAllProperties()
    {
        // Arrange
        var entity = new ChannelConfig
        {
            SourceChannel = 1,
            Enabled = false
        };

        // Act - Simulate GetSettingsMapper mapping
        var dto = MapChannelConfigToDto(entity);

        // Assert
        dto.SourceChannel.Should().Be(1);
        dto.Enabled.Should().BeFalse();
    }

    [Fact]
    public void ChannelConfig_RoundTrip_PreservesAllData()
    {
        // Arrange
        var original = new ChannelConfig
        {
            SourceChannel = 2,
            Enabled = true
        };

        // Act - Entity → DTO → Entity
        var dto = MapChannelConfigToDto(original);
        var roundTripped = MapChannelConfigToEntity(dto);

        // Assert
        roundTripped.SourceChannel.Should().Be(original.SourceChannel);
        roundTripped.Enabled.Should().Be(original.Enabled);
    }

    #endregion

    #region AudioSettings Mapping Tests

    [Fact]
    public void AudioSettingsDto_ToEntity_MapsChannelsList()
    {
        // Arrange
        var dto = new AudioSettingsDto
        {
            EnableAudioStream = true,
            AudioDeviceIndex = 2,
            AudioDeviceName = "Arturia AudioFuse",
            CaptureChannelCount = 4,
            SampleRate = 48000,
            Channels =
            [
                new ChannelConfigDto { SourceChannel = 0, Enabled = true },
                new ChannelConfigDto { SourceChannel = 1, Enabled = false },
                new ChannelConfigDto { SourceChannel = 2, Enabled = true },
                new ChannelConfigDto { SourceChannel = 3, Enabled = false }
            ]
        };

        // Act
        var entity = MapAudioSettingsToEntity(dto);

        // Assert
        entity.EnableAudioStream.Should().BeTrue();
        entity.AudioDeviceIndex.Should().Be(2);
        entity.AudioDeviceName.Should().Be("Arturia AudioFuse");
        entity.CaptureChannelCount.Should().Be(4);
        entity.SampleRate.Should().Be(48000);
        entity.Channels.Should().HaveCount(4);
        entity.Channels[0].SourceChannel.Should().Be(0);
        entity.Channels[1].Enabled.Should().BeFalse();
        entity.Channels[2].SourceChannel.Should().Be(2);
    }

    [Fact]
    public void AudioSettings_ToDto_MapsChannelsList()
    {
        // Arrange
        var entity = new AudioSettings
        {
            EnableAudioStream = true,
            AudioDeviceIndex = 1,
            AudioDeviceName = "Focusrite Scarlett",
            CaptureChannelCount = 2,
            SampleRate = 48000,
            Channels =
            [
                new ChannelConfig { SourceChannel = 0, Enabled = true },
                new ChannelConfig { SourceChannel = 1, Enabled = true }
            ]
        };

        // Act
        var dto = MapAudioSettingsToDto(entity);

        // Assert
        dto.EnableAudioStream.Should().BeTrue();
        dto.AudioDeviceIndex.Should().Be(1);
        dto.AudioDeviceName.Should().Be("Focusrite Scarlett");
        dto.CaptureChannelCount.Should().Be(2);
        dto.SampleRate.Should().Be(48000);
        dto.Channels.Should().HaveCount(2);
        dto.Channels[0].SourceChannel.Should().Be(0);
        dto.Channels[1].SourceChannel.Should().Be(1);
    }

    [Fact]
    public void AudioSettings_RoundTrip_PreservesAllData()
    {
        // Arrange
        var original = new AudioSettings
        {
            EnableAudioStream = true,
            AudioDeviceIndex = 0,
            AudioDeviceName = "Test Device",
            CaptureChannelCount = 8,
            SampleRate = 48000,
            Channels =
            [
                new ChannelConfig { SourceChannel = 0, Enabled = true },
                new ChannelConfig { SourceChannel = 1, Enabled = true },
                new ChannelConfig { SourceChannel = 2, Enabled = false },
                new ChannelConfig { SourceChannel = 3, Enabled = true }
            ]
        };

        // Act - Entity → DTO → Entity
        var dto = MapAudioSettingsToDto(original);
        var roundTripped = MapAudioSettingsToEntity(dto);

        // Assert
        roundTripped.EnableAudioStream.Should().Be(original.EnableAudioStream);
        roundTripped.AudioDeviceIndex.Should().Be(original.AudioDeviceIndex);
        roundTripped.AudioDeviceName.Should().Be(original.AudioDeviceName);
        roundTripped.CaptureChannelCount.Should().Be(original.CaptureChannelCount);
        roundTripped.SampleRate.Should().Be(original.SampleRate);
        roundTripped.Channels.Should().HaveCount(original.Channels.Count);
        for (int i = 0; i < original.Channels.Count; i++)
        {
            roundTripped.Channels[i].SourceChannel.Should().Be(original.Channels[i].SourceChannel);
            roundTripped.Channels[i].Enabled.Should().Be(original.Channels[i].Enabled);
        }
    }

    [Fact]
    public void AudioSettingsDto_WithEmptyChannels_MapsToEmptyList()
    {
        // Arrange
        var dto = new AudioSettingsDto
        {
            EnableAudioStream = false,
            AudioDeviceIndex = -1,
            AudioDeviceName = "",
            CaptureChannelCount = 1,
            SampleRate = 48000,
            Channels = []
        };

        // Act
        var entity = MapAudioSettingsToEntity(dto);

        // Assert
        entity.Channels.Should().BeEmpty();
    }

    [Fact]
    public void AudioSettingsDto_WithNullChannels_MapsToEmptyList()
    {
        // Arrange
        var dto = new AudioSettingsDto
        {
            EnableAudioStream = false,
            AudioDeviceIndex = -1,
            AudioDeviceName = "",
            CaptureChannelCount = 1,
            SampleRate = 48000,
            Channels = null!
        };

        // Act
        var entity = MapAudioSettingsToEntity(dto);

        // Assert
        entity.Channels.Should().BeEmpty();
    }

    [Fact]
    public void AudioSettingsDto_WithZeroCaptureChannelCount_DefaultsToOne()
    {
        // Arrange
        var dto = new AudioSettingsDto
        {
            EnableAudioStream = true,
            AudioDeviceIndex = 0,
            AudioDeviceName = "Test Device",
            CaptureChannelCount = 0,
            SampleRate = 48000,
            Channels = []
        };

        // Act
        var entity = MapAudioSettingsToEntity(dto);

        // Assert
        entity.CaptureChannelCount.Should().Be(1);
    }

    [Fact]
    public void AudioSettings_DefaultCaptureChannelCount_IsOne()
    {
        // Arrange - AudioSettings default for CaptureChannelCount is 1
        var entity = new AudioSettings();

        // Assert
        entity.CaptureChannelCount.Should().Be(1);
    }

    #endregion

    #region Mapper Helper Methods (replicate actual mapper logic)

    private static ChannelConfig MapChannelConfigToEntity(ChannelConfigDto dto)
    {
        return new ChannelConfig
        {
            SourceChannel = dto.SourceChannel,
            Enabled = dto.Enabled
        };
    }

    private static ChannelConfigDto MapChannelConfigToDto(ChannelConfig entity)
    {
        return new ChannelConfigDto
        {
            SourceChannel = entity.SourceChannel,
            Enabled = entity.Enabled
        };
    }

    private static AudioSettings MapAudioSettingsToEntity(AudioSettingsDto dto)
    {
        return new AudioSettings
        {
            EnableAudioStream = dto.EnableAudioStream,
            AudioDeviceIndex = dto.AudioDeviceIndex,
            AudioDeviceName = dto.AudioDeviceName,
            CaptureChannelCount = dto.CaptureChannelCount > 0 ? dto.CaptureChannelCount : 1,
            SampleRate = dto.SampleRate,
            Channels = dto.Channels?.Select(MapChannelConfigToEntity).ToList() ?? []
        };
    }

    private static AudioSettingsDto MapAudioSettingsToDto(AudioSettings entity)
    {
        return new AudioSettingsDto
        {
            EnableAudioStream = entity.EnableAudioStream,
            AudioDeviceIndex = entity.AudioDeviceIndex,
            AudioDeviceName = entity.AudioDeviceName,
            CaptureChannelCount = entity.CaptureChannelCount,
            SampleRate = entity.SampleRate,
            Channels = entity.Channels.Select(MapChannelConfigToDto).ToList()
        };
    }

    #endregion
}
