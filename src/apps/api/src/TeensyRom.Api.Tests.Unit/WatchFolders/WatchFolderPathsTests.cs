using TeensyRom.Api.WatchFolders;

namespace TeensyRom.Api.Tests.Unit.WatchFolders;

public class WatchFolderPathsTests
{
    private static readonly string Root = Path.GetPathRoot(Path.GetTempPath())!;
    private static readonly char Sep = Path.DirectorySeparatorChar;

    [Fact]
    public void Normalize_TrimsTrailingSeparatorAndResolvesDots()
    {
        var path = Path.Combine(Root, "games", "c64") + Sep;
        var messy = Path.Combine(Root, "games", "x", "..", "c64") + Sep;

        WatchFolderPaths.Normalize(messy).Should().Be(Path.Combine(Root, "games", "c64"));
        WatchFolderPaths.Normalize(path).Should().Be(Path.Combine(Root, "games", "c64"));
    }

    [Fact]
    public void Normalize_KeepsTheSeparatorOfARoot()
    {
        WatchFolderPaths.Normalize(Root).Should().Be(Root);
    }

    [Fact]
    public void IsNestedIn_ChildInsideParent_IsTrue()
    {
        var parent = Path.Combine(Root, "games");
        var child = Path.Combine(parent, "c64", "tapes");

        WatchFolderPaths.IsNestedIn(child, parent).Should().BeTrue();
        WatchFolderPaths.IsNestedIn(parent, child).Should().BeFalse();
    }

    [Fact]
    public void IsNestedIn_SamePath_IsFalse()
    {
        var path = Path.Combine(Root, "games");

        WatchFolderPaths.IsNestedIn(path, path).Should().BeFalse();
    }

    [Fact]
    public void IsNestedIn_SiblingSharingANamePrefix_IsFalse()
    {
        WatchFolderPaths.IsNestedIn(Path.Combine(Root, "games2"), Path.Combine(Root, "games")).Should().BeFalse();
    }

    [Fact]
    public void IsNestedIn_AnythingUnderARoot_IsTrue()
    {
        WatchFolderPaths.IsNestedIn(Path.Combine(Root, "games"), Root).Should().BeTrue();
        WatchFolderPaths.IsNestedIn(Root, Path.Combine(Root, "games")).Should().BeFalse();
    }

    [Fact]
    public void AreSame_FollowsTheFilesystemCaseRule()
    {
        var lower = Path.Combine(Root, "games");
        var upper = Path.Combine(Root, "GAMES");

        WatchFolderPaths.AreSame(lower, upper).Should().Be(OperatingSystem.IsWindows());
        WatchFolderPaths.IsNestedIn(Path.Combine(upper, "c64"), lower).Should().Be(OperatingSystem.IsWindows());
    }
}
