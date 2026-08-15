using System.Runtime.CompilerServices;
using System.Text;
using TeensyRom.Api.Transfers.Archives;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Tests.Unit.Transfers.Archives;

public class SharpCompressArchiveReaderTests
{
    private static readonly string FixturesDirectory = GetFixturesDirectory();

    private readonly SharpCompressArchiveReader _reader = new(Substitute.For<ILoggingService>());

    public static TheoryData<string> ParityFixtures =>
        new() { "parity.zip", "parity.7z", "parity.rar" };

    public static TheoryData<string> UnreadableFixtures =>
        new() { "corrupt.zip", "truncated.zip", "encrypted.zip", "mismatched.zip" };

    [Theory]
    [MemberData(nameof(ParityFixtures))]
    public void ReadIndex_AcrossFormats_ReturnsSameEntrySetAndByteTotal(string fixtureName)
    {
        var index = _reader.ReadIndex(Fixture(fixtureName));

        index.Entries.Select(e => Normalize(e.Path)).OrderBy(p => p)
            .Should().Equal("ro_dir", "ro_dir/ro_file.txt");
        index.Entries.Should().ContainSingle(e => e.IsDirectory && e.DeclaredSizeBytes == 0);
        index.Entries.Should().ContainSingle(e => !e.IsDirectory && e.DeclaredSizeBytes == 9);
        index.Entries.Should().OnlyContain(e => !e.IsSymlink);
        index.DeclaredUncompressedBytes.Should().Be(9);
    }

    [Theory]
    [MemberData(nameof(ParityFixtures))]
    public async Task ExtractAsync_AcrossFormats_YieldsTheFileEntrysBytes(string fixtureName)
    {
        var received = new List<(string Path, byte[] Bytes)>();

        await _reader.ExtractAsync(
            Fixture(fixtureName),
            async (entry, stream, ct) =>
            {
                entry.IsDirectory.Should().BeFalse("directory entries must not reach the callback");
                using var buffer = new MemoryStream();
                await stream.CopyToAsync(buffer, ct);
                received.Add((Normalize(entry.Path), buffer.ToArray()));
            },
            CancellationToken.None);

        received.Should().ContainSingle();
        received[0].Path.Should().Be("ro_dir/ro_file.txt");
        Encoding.UTF8.GetString(received[0].Bytes).Should().Be("readonly\n");
    }

    [Fact]
    public async Task ExtractAsync_MultiEntryArchive_YieldsEveryEntryInArchiveOrderOneAtATime()
    {
        var received = new List<(string Path, string Content)>();
        var concurrentCallbacks = 0;

        await _reader.ExtractAsync(
            Fixture("multi.zip"),
            async (entry, stream, ct) =>
            {
                var depth = Interlocked.Increment(ref concurrentCallbacks);
                try
                {
                    depth.Should().Be(1, "the reader must finish one entry's callback before starting the next");
                    using var buffer = new MemoryStream();
                    await stream.CopyToAsync(buffer, ct);
                    received.Add((entry.Path, Encoding.UTF8.GetString(buffer.ToArray())));
                }
                finally
                {
                    Interlocked.Decrement(ref concurrentCallbacks);
                }
            },
            CancellationToken.None);

        received.Should().Equal(("a.txt", "a\n"), ("b.txt", "b\n"), ("c.txt", "c\n"));
    }

    [Fact]
    public void ReadIndex_SymlinkFixture_FlagsSymlinkEntryButNotRegularFile()
    {
        var index = _reader.ReadIndex(Fixture("symlink.zip"));

        index.Entries.Should().ContainSingle(e => e.Path == "target.txt" && !e.IsSymlink);
        index.Entries.Should().ContainSingle(e => e.Path == "link_to_target.txt" && e.IsSymlink);
    }

    [Theory]
    [MemberData(nameof(UnreadableFixtures))]
    public void ReadIndex_UnreadableArchive_ThrowsArchiveReadException(string fixtureName)
    {
        var act = () => _reader.ReadIndex(Fixture(fixtureName));

        act.Should().Throw<ArchiveReadException>();
    }

    [Theory]
    [MemberData(nameof(UnreadableFixtures))]
    public async Task ExtractAsync_UnreadableArchive_ThrowsArchiveReadException(string fixtureName)
    {
        var act = () => _reader.ExtractAsync(
            Fixture(fixtureName), (_, _, _) => Task.CompletedTask, CancellationToken.None);

        await act.Should().ThrowAsync<ArchiveReadException>();
    }

    [Theory]
    [InlineData("game.zip", true)]
    [InlineData("game.7z", true)]
    [InlineData("game.rar", true)]
    [InlineData("GAME.ZIP", true)]
    [InlineData("nested/dir/game.RaR", true)]
    [InlineData("game.d64", false)]
    [InlineData("archive.zip.bak", false)]
    [InlineData("noextension", false)]
    public void IsArchiveExtension_MatchesSupportedExtensionsCaseInsensitively(string path, bool expected)
    {
        _reader.IsArchiveExtension(path).Should().Be(expected);
    }

    private static string Fixture(string name) => Path.Combine(FixturesDirectory, name);

    private static string Normalize(string path) => path.Replace('\\', '/').TrimEnd('/');

    private static string GetFixturesDirectory([CallerFilePath] string testFilePath = "") =>
        Path.Combine(Path.GetDirectoryName(testFilePath)!, "Fixtures");
}
