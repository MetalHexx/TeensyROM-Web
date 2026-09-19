using TeensyRom.Core.Common;

namespace TeensyRom.Core.Tests.Common;

public class FileHelperTests
{
    [Theory]
    [InlineData("19307720", true)]
    [InlineData("Unknown-2", true)]
    [InlineData("PSM2ZAKI", true)]
    [InlineData("", false)]
    [InlineData("!!invalid", false)]
    [InlineData("invalid@@", false)]
    [InlineData("12345!!&^#", false)]
    [InlineData("123456789012345678901234567890123", false)]
    public void IsValidDeviceId_ReturnsExpectedResult(string deviceId, bool expected)
    {
        var result = deviceId.IsValidDeviceId();

        result.Should().Be(expected);
    }
}
