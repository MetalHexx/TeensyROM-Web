using System.Text;

namespace TeensyRom.Api.Tests.Integration.Fixtures.Archives
{
    /// <summary>
    /// Builds minimal, store-method RAR 4.x archives byte-by-byte. SharpCompress can only read RAR - it
    /// has no writer - and no rar/WinRAR binary is installed in this sandbox, so this is the only way to
    /// produce a hostile `.rar` fixture at all. The block layout (MAIN_HEAD, FILE_HEAD, END_ARC) and the
    /// HEAD_CRC formula below were reverse-engineered against the real
    /// <c>TeensyRom.Api.Tests.Unit/.../Fixtures/parity.rar</c> fixture and verified to reproduce its exact
    /// stored CRCs before being trusted for new archives.
    /// </summary>
    internal static class RarFixtureBuilder
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
            ms.Write([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00]); // "Rar!" signature

            WriteMainHead(ms);

            foreach (var e in entries)
            {
                WriteFileHead(ms, e);
            }

            WriteEndArc(ms);

            return ms.ToArray();
        }

        private static void WriteMainHead(MemoryStream ms)
        {
            var body = new byte[11]; // TYPE FLAGS(2) SIZE(2) HIGH_POS_AV(2) POS_AV(4)
            body[0] = 0x73;
            WriteLE16(body, 1, 0x0000);
            WriteLE16(body, 3, 13);
            WriteLE16(body, 5, 0);
            WriteLE32(body, 7, 0);

            WriteHeaderWithCrc(ms, body);
        }

        /// <summary>
        /// Declared vs. actual: <paramref name="e"/>.DeclaredSizeOverride replaces only UNP_SIZE (what
        /// <c>ReadIndex</c> reports). PACK_SIZE - how many raw bytes physically follow the header, and how
        /// far the reader must skip to find the next block - always matches the real content length, so a
        /// declared-size-bomb fixture (declares huge, contains little) round-trips correctly even though
        /// its numbers disagree on purpose.
        /// </summary>
        private static void WriteFileHead(MemoryStream ms, Entry e)
        {
            var nameBytes = Encoding.ASCII.GetBytes(e.Name);
            var packSize = (uint)e.Content.Length;
            var unpSize = (uint)(e.DeclaredSizeOverride ?? e.Content.Length);

            ushort flags = 0x8000;
            if (e.IsDirectory) flags |= 0x00E0;
            if (e.Encrypted) flags |= 0x0004;

            var headSize = (ushort)(32 + nameBytes.Length);
            var body = new byte[headSize - 2]; // everything but HEAD_CRC
            var o = 0;

            body[o++] = 0x74; // TYPE = FILE_HEAD
            WriteLE16(body, o, flags); o += 2;
            WriteLE16(body, o, headSize); o += 2;
            WriteLE32(body, o, packSize); o += 4;
            WriteLE32(body, o, unpSize); o += 4;
            body[o++] = 3; // HOST_OS = Unix
            WriteLE32(body, o, Crc32.Compute(e.Content)); o += 4;
            WriteLE32(body, o, 0); o += 4; // FTIME
            body[o++] = 20; // UNP_VER
            body[o++] = 0x30; // METHOD = store
            WriteLE16(body, o, (ushort)nameBytes.Length); o += 2;

            uint attr = e.IsSymlink ? 0xA1FFu : e.IsDirectory ? 0x41FFu : 0x81A4u;
            WriteLE32(body, o, attr); o += 4;

            Array.Copy(nameBytes, 0, body, o, nameBytes.Length); o += nameBytes.Length;

            WriteHeaderWithCrc(ms, body);
            ms.Write(e.Content, 0, e.Content.Length);
        }

        private static void WriteEndArc(MemoryStream ms)
        {
            var body = new byte[5]; // TYPE FLAGS(2) SIZE(2)
            body[0] = 0x7B;
            WriteLE16(body, 1, 0x0000);
            WriteLE16(body, 3, 7);

            WriteHeaderWithCrc(ms, body);
        }

        /// HEAD_CRC = the low 16 bits of a standard CRC-32 over the header bytes excluding HEAD_CRC
        /// itself - i.e. exactly <paramref name="bodyAfterCrc"/>, which every caller above already builds
        /// as "everything but the two CRC bytes".
        private static void WriteHeaderWithCrc(MemoryStream ms, byte[] bodyAfterCrc)
        {
            var crc = (ushort)(Crc32.Compute(bodyAfterCrc) & 0xFFFF);
            ms.WriteByte((byte)(crc & 0xFF));
            ms.WriteByte((byte)((crc >> 8) & 0xFF));
            ms.Write(bodyAfterCrc);
        }

        private static void WriteLE16(byte[] buf, int offset, ushort value)
        {
            buf[offset] = (byte)(value & 0xFF);
            buf[offset + 1] = (byte)((value >> 8) & 0xFF);
        }

        private static void WriteLE32(byte[] buf, int offset, uint value)
        {
            buf[offset] = (byte)(value & 0xFF);
            buf[offset + 1] = (byte)((value >> 8) & 0xFF);
            buf[offset + 2] = (byte)((value >> 16) & 0xFF);
            buf[offset + 3] = (byte)((value >> 24) & 0xFF);
        }
    }
}
