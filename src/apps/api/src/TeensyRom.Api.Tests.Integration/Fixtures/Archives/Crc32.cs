namespace TeensyRom.Api.Tests.Integration.Fixtures.Archives
{
    /// <summary>
    /// Standard IEEE CRC-32 (the same polynomial ZIP and RAR both use for their own header/data
    /// checksums). Needed because the fixture builders write raw archive bytes by hand rather than
    /// through a real compression library, so nothing else computes this for them.
    /// </summary>
    internal static class Crc32
    {
        private static readonly uint[] Table = BuildTable();

        private static uint[] BuildTable()
        {
            var table = new uint[256];

            for (uint i = 0; i < 256; i++)
            {
                var c = i;

                for (var k = 0; k < 8; k++)
                {
                    c = (c & 1) != 0 ? 0xEDB88320 ^ (c >> 1) : c >> 1;
                }

                table[i] = c;
            }

            return table;
        }

        public static uint Compute(ReadOnlySpan<byte> data)
        {
            var crc = 0xFFFFFFFFu;

            foreach (var b in data)
            {
                crc = Table[(crc ^ b) & 0xFF] ^ (crc >> 8);
            }

            return crc ^ 0xFFFFFFFFu;
        }
    }
}
