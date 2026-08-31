namespace TeensyRom.Api.Tests.Integration.Fixtures.Archives
{
    public enum ArchiveFormat { Zip, SevenZip, Rar }

    /// <summary>
    /// One entry spec shared across all three format builders, so a test describes a hostile archive
    /// once and asks for it in whichever format(s) the technique applies to. Not every field is honored
    /// by every format - <see cref="SevenZipFixtureBuilder"/>'s own doc comment lists which techniques
    /// `.7z` cannot express and why.
    /// </summary>
    internal sealed record EntrySpec(
        string Name,
        byte[] Content,
        bool IsDirectory = false,
        bool IsSymlink = false,
        bool Encrypted = false,
        long? DeclaredSizeOverride = null);

    /// <summary>
    /// Dispatches one entry list to the right format-specific builder and names the fixture's file
    /// extension - the two format-agnostic pieces every safety test needs. This is the "small builder"
    /// the task calls for: no rar-authoring tool exists in this sandbox and SharpCompress cannot write
    /// RAR at all, so every fixture in the suite - not only the size bombs - is generated here rather
    /// than committed as opaque binaries. See the suite's own top-of-file note for the full rationale.
    /// </summary>
    internal static class HostileArchiveFactory
    {
        public static string Extension(ArchiveFormat format) => format switch
        {
            ArchiveFormat.Zip => ".zip",
            ArchiveFormat.SevenZip => ".7z",
            ArchiveFormat.Rar => ".rar",
            _ => throw new ArgumentOutOfRangeException(nameof(format))
        };

        public static byte[] Build(ArchiveFormat format, params EntrySpec[] entries) => format switch
        {
            ArchiveFormat.Zip => ZipFixtureBuilder.Build([.. entries.Select(e =>
                new ZipFixtureBuilder.Entry(e.Name, e.Content, e.IsDirectory, e.IsSymlink, e.Encrypted, e.DeclaredSizeOverride))]),
            ArchiveFormat.Rar => RarFixtureBuilder.Build([.. entries.Select(e =>
                new RarFixtureBuilder.Entry(e.Name, e.Content, e.IsDirectory, e.IsSymlink, e.Encrypted, e.DeclaredSizeOverride))]),
            ArchiveFormat.SevenZip => SevenZipFixtureBuilder.Build([.. entries.Select(e =>
                new SevenZipFixtureBuilder.Entry(e.Name, e.Content, e.IsDirectory))]),
            _ => throw new ArgumentOutOfRangeException(nameof(format))
        };

        /// A structurally-tagged but unreadable archive: enough of the right magic bytes to route to the
        /// right reader, nothing that reader can actually parse past that.
        public static byte[] BuildCorrupt(ArchiveFormat format) => format switch
        {
            ArchiveFormat.Zip => [0x50, 0x4B, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8],
            ArchiveFormat.Rar => [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            ArchiveFormat.SevenZip => [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C, 1, 2, 3, 4, 5, 6, 7, 8],
            _ => throw new ArgumentOutOfRangeException(nameof(format))
        };

        /// A real, valid single-entry archive with its tail physically cut off - a valid start, an
        /// incomplete end.
        public static byte[] BuildTruncated(ArchiveFormat format)
        {
            var valid = Build(format, new EntrySpec("full.sid", "0123456789ABCDEF0123456789ABCDEF"u8.ToArray()));
            var cut = Math.Max(10, valid.Length / 3);
            return valid[..(valid.Length - cut)];
        }
    }
}
