using TeensyRom.Api.Transfers.Archives;

namespace TeensyRom.Api.Tests.Unit.Transfers.Archives;

public class ArchiveEntryPathResolverTests
{
    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void TryResolve_EmptyOrWhitespaceEntryPath_ReturnsFalseWithReason(string entryPath)
    {
        var resolved = ArchiveEntryPathResolver.TryResolve(entryPath, out _, out var error);

        resolved.Should().BeFalse();
        error.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void TryResolve_PathExceedsMaxLength_ReturnsFalseWithReason()
    {
        var longPath = "a/" + new string('b', 4100);

        var resolved = ArchiveEntryPathResolver.TryResolve(longPath, out _, out var error);

        resolved.Should().BeFalse();
        error.Should().NotBeNullOrWhiteSpace();
    }

    [Theory]
    [InlineData("/abs/escape.sid")]
    [InlineData("/rooted")]
    [InlineData("C:\\escape.sid")]
    [InlineData("D:/escape.sid")]
    public void TryResolve_RootedPath_ReturnsFalseWithReason(string entryPath)
    {
        var resolved = ArchiveEntryPathResolver.TryResolve(entryPath, out _, out var error);

        resolved.Should().BeFalse();
        error.Should().NotBeNullOrWhiteSpace();
    }

    [Theory]
    [InlineData("../escape.sid")]
    [InlineData("a/../../escape.sid")]
    [InlineData("a\\..\\..\\escape.sid")]
    [InlineData(".")]
    [InlineData("..")]
    [InlineData("sub/../file.sid")]
    [InlineData("sub/./file.sid")]
    [InlineData("a//..//b")]
    public void TryResolve_PathWithDotOrDoubleDotSegments_ReturnsFalseWithReason(string entryPath)
    {
        var resolved = ArchiveEntryPathResolver.TryResolve(entryPath, out _, out var error);

        resolved.Should().BeFalse();
        error.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void TryResolve_SimpleRelativePath_ResolvesSuccessfully()
    {
        var resolved = ArchiveEntryPathResolver.TryResolve("sub/dir/file.sid", out var relativePath, out var error);

        resolved.Should().BeTrue();
        error.Should().BeNull();
        relativePath.Should().Be("sub/dir/file.sid");
    }

    [Fact]
    public void TryResolve_BackslashSeparatedPath_NormalisesToForwardSlashes()
    {
        var resolved = ArchiveEntryPathResolver.TryResolve("sub\\dir\\file.sid", out var relativePath, out var error);

        resolved.Should().BeTrue();
        error.Should().BeNull();
        relativePath.Should().Be("sub/dir/file.sid");
    }

    [Fact]
    public void TryResolve_RepeatedSeparators_CollapsesThem()
    {
        var resolved = ArchiveEntryPathResolver.TryResolve("sub//dir///file.sid", out var relativePath, out _);

        resolved.Should().BeTrue();
        relativePath.Should().Be("sub/dir/file.sid");
    }

    [Fact]
    public void TryResolve_MixedBackslashAndForwardSlash_NormalisesAndCollapses()
    {
        var resolved = ArchiveEntryPathResolver.TryResolve("sub\\dir//file.sid", out var relativePath, out _);

        resolved.Should().BeTrue();
        relativePath.Should().Be("sub/dir/file.sid");
    }

    [Fact]
    public void ArchiveEntryPathSet_TryAdd_AcceptsFirstOccurrence()
    {
        var set = new ArchiveEntryPathSet();

        var added = set.TryAdd("Music/Tune.sid");

        added.Should().BeTrue();
    }

    [Fact]
    public void ArchiveEntryPathSet_TryAdd_RejectsSecondOccurrenceWithDifferentCase()
    {
        var set = new ArchiveEntryPathSet();
        set.TryAdd("Music/Tune.sid");

        var addedDuplicate = set.TryAdd("music/tune.sid");

        addedDuplicate.Should().BeFalse();
    }

    [Fact]
    public void ArchiveEntryPathSet_TryAdd_AcceptsDifferentPaths()
    {
        var set = new ArchiveEntryPathSet();
        set.TryAdd("Music/Tune.sid");

        var addedDifferent = set.TryAdd("Effects/Sound.sid");

        addedDifferent.Should().BeTrue();
    }

    [Fact]
    public void ArchiveEntryPathSet_TryAdd_TracksMultiplePaths()
    {
        var set = new ArchiveEntryPathSet();

        var result1 = set.TryAdd("Music/Tune.sid");
        var result2 = set.TryAdd("Effects/Sound.sid");
        var result3 = set.TryAdd("Samples/Sample.sid");
        var result4 = set.TryAdd("music/tune.sid");

        result1.Should().BeTrue();
        result2.Should().BeTrue();
        result3.Should().BeTrue();
        result4.Should().BeFalse();
    }
}
