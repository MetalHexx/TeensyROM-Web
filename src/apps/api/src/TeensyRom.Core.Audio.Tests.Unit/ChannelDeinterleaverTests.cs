using FluentAssertions;
using TeensyRom.Core.Audio;
using Xunit;

namespace TeensyRom.Core.Audio.Tests.Unit;

/// <summary>
/// Unit tests for <see cref="ChannelDeinterleaver"/>.
/// Tests verify correct separation of interleaved PCM audio into per-channel arrays.
/// </summary>
public class ChannelDeinterleaverTests
{
    [Fact]
    public void Deinterleave_With2ChannelStereo_SeparatesCorrectly()
    {
        // Arrange: [L0, R0, L1, R1, L2, R2]
        var interleaved = new float[] { 0.1f, 0.2f, 0.3f, 0.4f, 0.5f, 0.6f };

        // Act
        var result = ChannelDeinterleaver.Deinterleave(interleaved, 2);

        // Assert
        result.Should().HaveCount(2);
        result[0].Should().Equal(0.1f, 0.3f, 0.5f); // Left channel
        result[1].Should().Equal(0.2f, 0.4f, 0.6f); // Right channel
    }

    [Fact]
    public void Deinterleave_With4ChannelQuad_SeparatesCorrectly()
    {
        // Arrange: 4 samples, 4 channels each = 16 values
        // [Ch0_S0, Ch1_S0, Ch2_S0, Ch3_S0, Ch0_S1, Ch1_S1, Ch2_S1, Ch3_S1, ...]
        var interleaved = new float[]
        {
            0.0f, 0.1f, 0.2f, 0.3f,  // Sample 0: all channels
            1.0f, 1.1f, 1.2f, 1.3f,  // Sample 1: all channels
            2.0f, 2.1f, 2.2f, 2.3f,  // Sample 2: all channels
            3.0f, 3.1f, 3.2f, 3.3f   // Sample 3: all channels
        };

        // Act
        var result = ChannelDeinterleaver.Deinterleave(interleaved, 4);

        // Assert
        result.Should().HaveCount(4);
        result[0].Should().Equal(0.0f, 1.0f, 2.0f, 3.0f); // Channel 0
        result[1].Should().Equal(0.1f, 1.1f, 2.1f, 3.1f); // Channel 1
        result[2].Should().Equal(0.2f, 1.2f, 2.2f, 3.2f); // Channel 2
        result[3].Should().Equal(0.3f, 1.3f, 2.3f, 3.3f); // Channel 3
    }

    [Fact]
    public void Deinterleave_With1ChannelMono_PassesThroughUnchanged()
    {
        // Arrange
        var monoData = new float[] { 0.1f, 0.2f, 0.3f, 0.4f, 0.5f };

        // Act
        var result = ChannelDeinterleaver.Deinterleave(monoData, 1);

        // Assert
        result.Should().HaveCount(1);
        result[0].Should().Equal(monoData);
    }

    [Fact]
    public void Deinterleave_WithEmptyArray_ReturnsEmptyArraysPerChannel()
    {
        // Arrange
        var emptyData = Array.Empty<float>();

        // Act
        var result = ChannelDeinterleaver.Deinterleave(emptyData, 2);

        // Assert
        result.Should().HaveCount(2);
        result[0].Should().BeEmpty();
        result[1].Should().BeEmpty();
    }

    [Fact]
    public void Deinterleave_With8ChannelData_SeparatesCorrectly()
    {
        // Arrange: 2 samples, 8 channels each = 16 values
        var interleaved = new float[16];
        for (int i = 0; i < 16; i++)
            interleaved[i] = i;

        // Act
        var result = ChannelDeinterleaver.Deinterleave(interleaved, 8);

        // Assert
        result.Should().HaveCount(8);
        foreach (var channel in result)
            channel.Should().HaveCount(2); // 2 samples per channel

        // Verify first channel has values 0, 8
        result[0].Should().Equal(0f, 8f);
        // Verify last channel has values 7, 15
        result[7].Should().Equal(7f, 15f);
    }

    [Fact]
    public void Deinterleave_WithZeroChannelCount_ThrowsArgumentOutOfRangeException()
    {
        // Arrange
        var data = new float[] { 0.1f, 0.2f };

        // Act
        var act = () => ChannelDeinterleaver.Deinterleave(data, 0);

        // Assert
        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithParameterName("channelCount");
    }

    [Fact]
    public void Deinterleave_WithNegativeChannelCount_ThrowsArgumentOutOfRangeException()
    {
        // Arrange
        var data = new float[] { 0.1f, 0.2f };

        // Act
        var act = () => ChannelDeinterleaver.Deinterleave(data, -1);

        // Assert
        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithParameterName("channelCount");
    }

    [Fact]
    public void Deinterleave_WithUnevenDataLength_ThrowsArgumentException()
    {
        // Arrange: 5 values cannot be evenly divided by 2 channels
        var unevenData = new float[] { 0.1f, 0.2f, 0.3f, 0.4f, 0.5f };

        // Act
        var act = () => ChannelDeinterleaver.Deinterleave(unevenData, 2);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("interleaved");
    }

    [Fact]
    public void ExtractChannel_With2ChannelData_ExtractsCorrectChannel()
    {
        // Arrange: [L0, R0, L1, R1, L2, R2]
        var interleaved = new float[] { 0.1f, 0.2f, 0.3f, 0.4f, 0.5f, 0.6f };

        // Act - Extract right channel (index 1)
        var result = ChannelDeinterleaver.ExtractChannel(interleaved, 2, 1);

        // Assert
        result.Should().Equal(0.2f, 0.4f, 0.6f);
    }

    [Fact]
    public void ExtractChannel_WithInvalidChannelIndex_ThrowsArgumentOutOfRangeException()
    {
        // Arrange
        var data = new float[] { 0.1f, 0.2f };

        // Act - Try to extract channel 5 from 2-channel data
        var act = () => ChannelDeinterleaver.ExtractChannel(data, 2, 5);

        // Assert
        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithParameterName("channelToExtract");
    }

    [Fact]
    public void ExtractChannel_WithEmptyData_ReturnsEmptyArray()
    {
        // Arrange
        var emptyData = Array.Empty<float>();

        // Act
        var result = ChannelDeinterleaver.ExtractChannel(emptyData, 2, 0);

        // Assert
        result.Should().BeEmpty();
    }
}
