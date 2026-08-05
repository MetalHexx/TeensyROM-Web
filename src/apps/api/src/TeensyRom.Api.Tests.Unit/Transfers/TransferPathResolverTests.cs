using TeensyRom.Api.Transfers;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class TransferPathResolverTests
{
    private static readonly DirectoryPath Destination = new("/dest");

    [Theory]
    [InlineData("../escape")]
    [InlineData("/rooted")]
    [InlineData("a/../../b")]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("C:\\foo")]
    [InlineData("sub/../file.sid")]
    [InlineData(".")]
    [InlineData("..")]
    public void TryResolve_UnusablePath_ReturnsFalseWithReason(string clientRelativePath)
    {
        var resolved = TransferPathResolver.TryResolve(Destination, clientRelativePath, out _, out var error);

        resolved.Should().BeFalse();
        error.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void TryResolve_SimpleRelativePath_ProducesCombinedTargetPath()
    {
        var resolved = TransferPathResolver.TryResolve(Destination, "sub/dir/file.sid", out var targetPath, out var error);

        resolved.Should().BeTrue();
        error.Should().BeNull();
        targetPath.Value.Should().Be("/dest/sub/dir/file.sid");
    }

    [Fact]
    public void TryResolve_BackslashSeparatedPath_NormalisesToForwardSlashes()
    {
        var resolved = TransferPathResolver.TryResolve(Destination, "sub\\dir\\file.sid", out var targetPath, out _);

        resolved.Should().BeTrue();
        targetPath.Value.Should().Be("/dest/sub/dir/file.sid");
    }

    [Fact]
    public void TryResolve_RepeatedSeparators_CollapsesThem()
    {
        var resolved = TransferPathResolver.TryResolve(Destination, "sub//dir///file.sid", out var targetPath, out _);

        resolved.Should().BeTrue();
        targetPath.Value.Should().Be("/dest/sub/dir/file.sid");
    }

    [Fact]
    public void TryResolve_PathBeyondLengthCeiling_ReturnsFalse()
    {
        var longPath = "a/" + new string('b', 4100);

        var resolved = TransferPathResolver.TryResolve(Destination, longPath, out _, out var error);

        resolved.Should().BeFalse();
        error.Should().NotBeNullOrWhiteSpace();
    }
}
