using System.Buffers;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Entities.Storage
{
    /// <summary>
    /// A lazy handle on a staged file destined for the device - unlike <see cref="FileTransferItem"/>,
    /// it never buffers the file's contents in memory. <see cref="FromFile"/> reads the file once, with a
    /// rented buffer, to compute the length and checksum; the caller streams the body separately via
    /// <see cref="OpenRead"/>.
    /// </summary>
    public sealed class StreamedFileTransfer
    {
        public string SourcePath { get; }
        public FilePath TargetPath { get; }
        public TeensyStorageType TargetStorage { get; }
        public uint StreamLength { get; }
        public ushort Checksum { get; }

        private StreamedFileTransfer(string sourcePath, FilePath targetPath, TeensyStorageType targetStorage, uint streamLength, ushort checksum)
        {
            SourcePath = sourcePath;
            TargetPath = targetPath;
            TargetStorage = targetStorage;
            StreamLength = streamLength;
            Checksum = checksum;
        }

        /// <summary>
        /// Stages a file for transfer, computing its length and checksum from a single sequential read.
        /// </summary>
        /// <exception cref="FileNotFoundException">The file does not exist at <paramref name="sourcePath"/>.</exception>
        public static StreamedFileTransfer FromFile(string sourcePath, FilePath targetPath, TeensyStorageType targetStorage)
        {
            if (!File.Exists(sourcePath))
            {
                throw new FileNotFoundException($"A file was not found at: {sourcePath}");
            }

            var streamLength = (uint)new FileInfo(sourcePath).Length;
            var checksum = ComputeChecksum(sourcePath);

            return new StreamedFileTransfer(sourcePath, targetPath, targetStorage, streamLength, checksum);
        }

        /// <summary>
        /// Opens a fresh read stream over the staged file. Callers dispose it; a new instance is
        /// returned on every call so a caller can reopen after a failed attempt.
        /// </summary>
        public Stream OpenRead() => new FileStream(SourcePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);

        private static ushort ComputeChecksum(string sourcePath)
        {
            // Mirrors FileTransferItem's `Checksum += buffer[i]` wraparound (a ushort compound
            // assignment), just accumulated in a wider integer and masked down instead of relying on
            // the implicit narrowing cast - the wrap must match exactly or the device rejects the file.
            uint sum = 0;
            var buffer = ArrayPool<byte>.Shared.Rent(16 * 1024);

            try
            {
                using var stream = new FileStream(sourcePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                int bytesRead;

                while ((bytesRead = stream.Read(buffer, 0, buffer.Length)) > 0)
                {
                    for (var i = 0; i < bytesRead; i++)
                    {
                        sum += buffer[i];
                    }
                }
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buffer);
            }

            return (ushort)(sum & 0xFFFF);
        }
    }
}
