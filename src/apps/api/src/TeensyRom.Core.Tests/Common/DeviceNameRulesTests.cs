using TeensyRom.Core.Common;

namespace TeensyRom.Core.Tests.Common;

public class DeviceNameRulesTests
{
    [Theory]
    [InlineData("Kitchen", "Kitchen")]
    [InlineData("  Kitchen \t", "Kitchen")]
    [InlineData("A", "A")]
    [InlineData("TR-1", "TR-1")]
    public void TryNormalize_WithAValidName_ReturnsTheTrimmedName(string raw, string expected)
    {
        DeviceNameRules.TryNormalize(raw, out var name).Should().BeTrue();

        name.Should().Be(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("bad\nname")]
    [InlineData("bad\tname")]
    [InlineData("bad\u0000name")]
    public void TryNormalize_WithAnEmptyOrControlCharacterName_ReturnsFalse(string? raw)
    {
        DeviceNameRules.TryNormalize(raw, out _).Should().BeFalse();
    }

    [Fact]
    public void TryNormalize_AtTheMaxLength_IsValidAndOneOverIsNot()
    {
        DeviceNameRules.TryNormalize(new string('x', DeviceNameRules.MaxLength), out _).Should().BeTrue();
        DeviceNameRules.TryNormalize(new string('x', DeviceNameRules.MaxLength + 1), out _).Should().BeFalse();
    }

    [Fact]
    public void TryNormalize_CountsLengthAfterTrimming()
    {
        var padded = $"  {new string('x', DeviceNameRules.MaxLength)}  ";

        DeviceNameRules.TryNormalize(padded, out var name).Should().BeTrue();

        name.Length.Should().Be(DeviceNameRules.MaxLength);
    }
}
