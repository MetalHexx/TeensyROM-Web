using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Serial.Recovery;

namespace TeensyRom.Core.Serial.Tests.Unit.Recovery
{
    public class VersionReplyMapperTests
    {
        [Theory]
        [InlineData("v0.8.0.9", "0.8.0.9")]
        [InlineData("v0.9-pr65", "0.9-pr65")]
        [InlineData("v0.9*", "0.9*")]
        [InlineData("v0.9-pr65*", "0.9-pr65*")]
        public void Apply_CopiesTheWholeFirmwareVersionOntoTheCart(string token, string expected)
        {
            var cart = new Cart();

            VersionReplyMapper.Apply(VersionReplyParser.Parse($"FW: TeensyROM+ {token}\r\n"), cart);

            cart.FwVersion.Should().Be(expected);
        }

        [Fact]
        public void Apply_ATaggedFullBuild_StaysCompatible()
        {
            var cart = new Cart();

            VersionReplyMapper.Apply(VersionReplyParser.Parse("FW: TeensyROM+ v0.9-pr65*\r\n"), cart);

            cart.IsCompatible.Should().BeTrue();
            cart.IsMinimalFirmware.Should().BeFalse();
        }

        [Fact]
        public void Apply_ATaggedMinimalBuild_KeepsTheTagWithoutTheMinimalMarker()
        {
            var cart = new Cart();

            VersionReplyMapper.Apply(VersionReplyParser.Parse("FW: TeensyROM+ v0.9-pr65*(minimal)\r\n"), cart);

            cart.FwVersion.Should().Be("0.9-pr65*");
            cart.IsMinimalFirmware.Should().BeTrue();
            cart.IsCompatible.Should().BeFalse("a minimal image is never a compatible full cart");
        }

        [Fact]
        public void Apply_AReplyWithNoVersion_LeavesTheVersionEmpty()
        {
            var cart = new Cart { FwVersion = "0.9" };

            VersionReplyMapper.Apply(VersionReply.Empty, cart);

            cart.FwVersion.Should().BeEmpty();
        }
    }
}
