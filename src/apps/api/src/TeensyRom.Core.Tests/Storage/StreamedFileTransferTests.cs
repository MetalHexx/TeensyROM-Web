using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Tests.Storage;

public class StreamedFileTransferTests : IDisposable
{
    private readonly string _tempDir = Directory.CreateTempSubdirectory("streamed-file-transfer-tests-").FullName;

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }

    [Theory]
    [InlineData(1)]
    [InlineData(100)]
    [InlineData(20_000)] // spans multiple 16 KB read chunks
    public void FromFile_ChecksumMatchesFileTransferItem_ForVariousSizes(int fileSize)
    {
        var bytes = new byte[fileSize];
        new Random(42).NextBytes(bytes);
        var path = WriteFile(bytes);
        var target = new FilePath("/target.prg");

        var expected = new FileTransferItem(path, target, TeensyStorageType.SD);
        var actual = StreamedFileTransfer.FromFile(path, target, TeensyStorageType.SD);

        actual.Checksum.Should().Be(expected.Checksum);
    }

    [Fact]
    public void FromFile_ChecksumWrapsIdenticallyToFileTransferItem_WhenByteSumExceeds65535()
    {
        var bytes = Enumerable.Repeat((byte)255, 300).ToArray();
        var byteSum = bytes.Sum(b => (int)b);
        byteSum.Should().BeGreaterThan(ushort.MaxValue);

        var path = WriteFile(bytes);
        var target = new FilePath("/target.prg");

        var expected = new FileTransferItem(path, target, TeensyStorageType.SD);
        var actual = StreamedFileTransfer.FromFile(path, target, TeensyStorageType.SD);

        actual.Checksum.Should().Be(expected.Checksum);
    }

    [Fact]
    public void FromFile_StreamLength_MatchesFileInfoLength()
    {
        var bytes = new byte[12_345];
        var path = WriteFile(bytes);

        var transfer = StreamedFileTransfer.FromFile(path, new FilePath("/target.prg"), TeensyStorageType.SD);

        transfer.StreamLength.Should().Be((uint)new FileInfo(path).Length);
    }

    [Fact]
    public void FromFile_Throws_WhenSourceFileIsMissing()
    {
        var missingPath = Path.Combine(_tempDir, "missing.prg");

        var act = () => StreamedFileTransfer.FromFile(missingPath, new FilePath("/target.prg"), TeensyStorageType.SD);

        act.Should().Throw<FileNotFoundException>();
    }

    [Fact]
    public void OpenRead_ReturnsIndependentStreamsWithFullContent()
    {
        var bytes = new byte[5_000];
        new Random(7).NextBytes(bytes);
        var path = WriteFile(bytes);
        var transfer = StreamedFileTransfer.FromFile(path, new FilePath("/target.prg"), TeensyStorageType.SD);

        using var streamOne = transfer.OpenRead();
        using var streamTwo = transfer.OpenRead();

        streamOne.ReadByte();

        streamTwo.Should().NotBeSameAs(streamOne);
        streamTwo.Position.Should().Be(0);

        using var buffer = new MemoryStream();
        streamTwo.CopyTo(buffer);
        buffer.ToArray().Should().Equal(bytes);
    }

    private string WriteFile(byte[] bytes)
    {
        var path = Path.Combine(_tempDir, $"{Guid.NewGuid():N}.prg");
        File.WriteAllBytes(path, bytes);
        return path;
    }
}
