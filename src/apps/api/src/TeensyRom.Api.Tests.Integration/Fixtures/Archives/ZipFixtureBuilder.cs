using System.Text;

namespace TeensyRom.Api.Tests.Integration.Fixtures.Archives
{
    /// <summary>
    /// Builds minimal, store-method ZIP archives byte-by-byte rather than through
    /// <c>System.IO.Compression</c> or a third-party writer, because several hostile fixtures need a
    /// declared size that lies about the real one (a bomb) or an external-attributes value no managed
    /// writer exposes (a symlink entry) - both are just fields in the central directory record once you
    /// are writing it yourself. No environment tool in this sandbox can author <c>.rar</c> at all
    /// (SharpCompress is read-only for RAR, and no rar/WinRAR binary is installed here), so this class's
    /// sibling <see cref="RarFixtureBuilder"/> needs the same low-level approach - this one exists mainly
    /// so both formats share one technique instead of mixing a managed writer for zip with hand-rolled
    /// bytes for rar.
    /// </summary>
    internal static class ZipFixtureBuilder
    {
        public sealed record Entry(
            string Name,
            byte[] Content,
            bool IsDirectory = false,
            bool IsSymlink = false,
            bool Encrypted = false,
            long? DeclaredSizeOverride = null);

        public static byte[] Build(params Entry[] entries)
        {
            using var ms = new MemoryStream();
            var localOffsets = new uint[entries.Length];

            for (var i = 0; i < entries.Length; i++)
            {
                localOffsets[i] = (uint)ms.Position;
                WriteLocalHeader(ms, entries[i]);
            }

            var centralStart = (uint)ms.Position;

            for (var i = 0; i < entries.Length; i++)
            {
                WriteCentralHeader(ms, entries[i], localOffsets[i]);
            }

            var centralSize = (uint)ms.Position - centralStart;
            WriteEndOfCentralDirectory(ms, (ushort)entries.Length, centralSize, centralStart);

            return ms.ToArray();
        }

        private static void WriteLocalHeader(MemoryStream ms, Entry e)
        {
            var nameBytes = Encoding.UTF8.GetBytes(e.Name);
            var crc = Crc32.Compute(e.Content);
            var flags = e.Encrypted ? (ushort)0x0001 : (ushort)0x0000;

            Span<byte> header = stackalloc byte[30];
            header[0] = 0x50; header[1] = 0x4B; header[2] = 0x03; header[3] = 0x04;
            WriteLE16(header, 4, 20);
            WriteLE16(header, 6, flags);
            WriteLE16(header, 8, 0); // method = store
            WriteLE16(header, 10, 0);
            WriteLE16(header, 12, 0x21);
            WriteLE32(header, 14, crc);
            WriteLE32(header, 18, (uint)e.Content.Length); // compressed size stays truthful
            WriteLE32(header, 22, (uint)e.Content.Length); // local uncompressed size stays truthful
            WriteLE16(header, 26, (ushort)nameBytes.Length);
            WriteLE16(header, 28, 0);

            ms.Write(header);
            ms.Write(nameBytes);
            ms.Write(e.Content);
        }

        /// <summary>
        /// The only place a fixture can lie: <paramref name="e"/>.DeclaredSizeOverride replaces just the
        /// central directory's uncompressed-size field, which is what a random-access reader trusts for
        /// its index. The local header (and the real bytes that follow it, written above) stay truthful,
        /// so extraction - if the walk ever reaches it - still streams the real byte count.
        /// </summary>
        private static void WriteCentralHeader(MemoryStream ms, Entry e, uint localOffset)
        {
            var nameBytes = Encoding.UTF8.GetBytes(e.Name);
            var crc = Crc32.Compute(e.Content);
            var declaredUncompressed = (uint)(e.DeclaredSizeOverride ?? e.Content.Length);
            var flags = e.Encrypted ? (ushort)0x0001 : (ushort)0x0000;

            uint externalAttrs = e.IsSymlink
                ? 0xA1FFu << 16
                : e.IsDirectory
                    ? (0x41EDu << 16) | 0x10
                    : 0x81A4u << 16;

            Span<byte> header = stackalloc byte[46];
            header[0] = 0x50; header[1] = 0x4B; header[2] = 0x01; header[3] = 0x02;
            WriteLE16(header, 4, 0x0314); // version made by: unix host, version 20
            WriteLE16(header, 6, 20);
            WriteLE16(header, 8, flags);
            WriteLE16(header, 10, 0);
            WriteLE16(header, 12, 0);
            WriteLE16(header, 14, 0x21);
            WriteLE32(header, 16, crc);
            WriteLE32(header, 20, (uint)e.Content.Length);
            WriteLE32(header, 24, declaredUncompressed);
            WriteLE16(header, 28, (ushort)nameBytes.Length);
            WriteLE16(header, 30, 0);
            WriteLE16(header, 32, 0);
            WriteLE16(header, 34, 0);
            WriteLE16(header, 36, 0);
            WriteLE32(header, 38, externalAttrs);
            WriteLE32(header, 42, localOffset);

            ms.Write(header);
            ms.Write(nameBytes);
        }

        private static void WriteEndOfCentralDirectory(MemoryStream ms, ushort count, uint centralSize, uint centralOffset)
        {
            Span<byte> eocd = stackalloc byte[22];
            eocd[0] = 0x50; eocd[1] = 0x4B; eocd[2] = 0x05; eocd[3] = 0x06;
            WriteLE16(eocd, 4, 0);
            WriteLE16(eocd, 6, 0);
            WriteLE16(eocd, 8, count);
            WriteLE16(eocd, 10, count);
            WriteLE32(eocd, 12, centralSize);
            WriteLE32(eocd, 16, centralOffset);
            WriteLE16(eocd, 20, 0);

            ms.Write(eocd);
        }

        private static void WriteLE16(Span<byte> buf, int offset, ushort value)
        {
            buf[offset] = (byte)(value & 0xFF);
            buf[offset + 1] = (byte)((value >> 8) & 0xFF);
        }

        private static void WriteLE32(Span<byte> buf, int offset, uint value)
        {
            buf[offset] = (byte)(value & 0xFF);
            buf[offset + 1] = (byte)((value >> 8) & 0xFF);
            buf[offset + 2] = (byte)((value >> 16) & 0xFF);
            buf[offset + 3] = (byte)((value >> 24) & 0xFF);
        }
    }
}
