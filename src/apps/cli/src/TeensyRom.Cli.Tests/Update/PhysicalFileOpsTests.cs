using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

public sealed class PhysicalFileOpsTests : IDisposable
{
    private readonly Scratch _scratch = new();
    private readonly PhysicalFileOps _files = new();

    public void Dispose() => _scratch.Dispose();

    [Fact]
    public void FreeSpace_OfAFolderThatExists_IsPositive()
    {
        _files.FreeSpace(_scratch.Folder).Should().BeGreaterThan(0);
    }

    [Fact]
    public void FreeSpace_OfAPathThatDoesNotExistYet_IsThatOfTheNearestFolderAboveIt()
    {
        _files.FreeSpace(_scratch.At("not/yet/created")).Should().BeGreaterThan(0);
    }

    [Fact]
    public void DeleteEmptyDirectory_RemovesAnEmptyFolder_AndIgnoresAMissingOne()
    {
        Directory.CreateDirectory(_scratch.At("empty"));

        _files.DeleteEmptyDirectory(_scratch.At("empty"));
        _files.DeleteEmptyDirectory(_scratch.At("empty"));

        Directory.Exists(_scratch.At("empty")).Should().BeFalse();
    }

    [Fact]
    public void DeleteEmptyDirectory_FailsAndKeepsEverything_WhenAnythingIsInTheFolder()
    {
        var file = _scratch.Write("busy/sub/file.txt", "content");

        var delete = () => _files.DeleteEmptyDirectory(_scratch.At("busy"));

        delete.Should().Throw<IOException>();
        File.ReadAllText(file).Should().Be("content");
    }
}
