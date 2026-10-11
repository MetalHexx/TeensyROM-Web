using TeensyRom.Core.Common;

namespace TeensyRom.Core.Tests.Common;

public class StandInDeviceIdTests
{
    [Theory]
    [InlineData(1, "Unknown")]
    [InlineData(2, "Unknown-2")]
    [InlineData(10, "Unknown-10")]
    public void ForOrdinal_NumbersTheStandInsOfARun(int ordinal, string expected)
    {
        StandInDeviceId.ForOrdinal(ordinal).Should().Be(expected);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(10)]
    public void IsStandIn_RecognisesEveryIdForOrdinalMakes(int ordinal)
    {
        StandInDeviceId.IsStandIn(StandInDeviceId.ForOrdinal(ordinal)).Should().BeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("ABC123")]
    [InlineData("UnknownChip")]
    [InlineData("unknown")]
    [InlineData("Unknown-")]
    [InlineData("Unknown-Lab")]
    [InlineData("Unknown-2x")]
    [InlineData("Unknown-02")]
    [InlineData("Unknown-1")]
    [InlineData("Unknown-0")]
    [InlineData("Unknown-+2")]
    [InlineData("Unknown--2")]
    [InlineData("Unknown-2-3")]
    [InlineData("Unknown-99999999999")]
    public void IsStandIn_WithARealChipIdOrNothing_IsFalse(string? deviceId)
    {
        StandInDeviceId.IsStandIn(deviceId).Should().BeFalse();
    }
}
