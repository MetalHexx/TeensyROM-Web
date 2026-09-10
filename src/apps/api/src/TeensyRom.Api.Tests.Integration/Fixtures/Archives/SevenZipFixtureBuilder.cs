using SharpCompress.Common;
using SharpCompress.Writers.SevenZip;

namespace TeensyRom.Api.Tests.Integration.Fixtures.Archives
{
    /// <summary>
    /// Builds `.7z` fixtures through SharpCompress's own <see cref="SevenZipWriter"/> - unlike RAR, 7z
    /// writing is actually supported, so there is no need for a hand-rolled format here. The writer's
    /// public surface is narrower than the zip/rar builders' though: it exposes no external-attributes or
    /// declared-vs-actual-size control, and empirically normalizes away a leading `/` or a drive prefix
    /// before the name ever reaches the archive. Symlink, both size-bomb shapes, encrypted, and the
    /// absolute/drive-rooted escape techniques are therefore not constructible for this format and are
    /// deliberately absent from the safety suite for `.7z` - see the suite's own top-of-file note.
    /// </summary>
    internal static class SevenZipFixtureBuilder
    {
        public sealed record Entry(string Name, byte[] Content, bool IsDirectory = false);

        public static byte[] Build(params Entry[] entries)
        {
            using var ms = new MemoryStream();
            var options = new SevenZipWriterOptions(CompressionType.LZMA2) { LeaveStreamOpen = true };

            using (var writer = new SevenZipWriter(ms, options))
            {
                foreach (var e in entries)
                {
                    if (e.IsDirectory)
                    {
                        writer.WriteDirectory(e.Name, null);
                    }
                    else
                    {
                        using var content = new MemoryStream(e.Content);
                        writer.Write(e.Name, content, null);
                    }
                }
            }

            return ms.ToArray();
        }
    }
}
