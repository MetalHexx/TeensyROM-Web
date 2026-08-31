using SharpCompress.Archives;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Transfers.Archives
{
    /// <summary>
    /// Reads `.zip`, `.7z`, and `.rar` archives through SharpCompress's random-access <see cref="IArchive"/>
    /// API rather than its forward-only reader — 7z's header lives in a footer and solid RAR resists a
    /// forward walk, so <c>ArchiveFactory.OpenArchive</c> is the one entry point that serves all three uniformly
    /// while still opening exactly one entry stream at a time.
    /// </summary>
    public sealed class SharpCompressArchiveReader : IArchiveReader
    {
        private static readonly string[] SupportedExtensions = [".zip", ".7z", ".rar"];

        private readonly ILoggingService _log;

        public SharpCompressArchiveReader(ILoggingService log)
        {
            _log = log;
        }

        public bool IsArchiveExtension(string relativePath)
        {
            var extension = Path.GetExtension(relativePath);
            return Array.Exists(SupportedExtensions, ext => string.Equals(ext, extension, StringComparison.OrdinalIgnoreCase));
        }

        public ArchiveIndex ReadIndex(string archivePath)
        {
            try
            {
                using var archive = ArchiveFactory.OpenArchive(archivePath);

                var entries = new List<ArchiveEntryInfo>();
                long declaredUncompressedBytes = 0;

                foreach (var entry in archive.Entries)
                {
                    RequireNotEncrypted(archivePath, entry);

                    var info = ToEntryInfo(entry);
                    entries.Add(info);

                    if (!info.IsDirectory)
                    {
                        declaredUncompressedBytes += info.DeclaredSizeBytes;
                    }
                }

                return new ArchiveIndex(entries, declaredUncompressedBytes);
            }
            catch (ArchiveReadException)
            {
                throw;
            }
            catch (Exception ex)
            {
                throw Wrap(archivePath, ex);
            }
        }

        public async Task ExtractAsync(
            string archivePath,
            Func<ArchiveEntryInfo, Stream, CancellationToken, Task> onEntry,
            CancellationToken ct)
        {
            IArchive archive;

            try
            {
                archive = ArchiveFactory.OpenArchive(archivePath);
            }
            catch (Exception ex)
            {
                throw Wrap(archivePath, ex);
            }

            using (archive)
            {
                // Entries is lazily parsed — SharpCompress only walks the archive's header on the first
                // MoveNext, well after OpenArchive returns successfully — so a corrupt or truncated
                // archive surfaces its failure here, not above. MoveNext and OpenEntryStream are
                // wrapped individually, not the whole loop, so a cancellation or callback exception from
                // onEntry still propagates untouched instead of being folded into ArchiveReadException.
                using var entries = archive.Entries.GetEnumerator();

                while (true)
                {
                    IArchiveEntry entry;

                    try
                    {
                        if (!entries.MoveNext()) break;
                        entry = entries.Current;
                    }
                    catch (Exception ex)
                    {
                        throw Wrap(archivePath, ex);
                    }

                    ct.ThrowIfCancellationRequested();

                    if (entry.IsDirectory) continue;

                    RequireNotEncrypted(archivePath, entry);

                    var info = ToEntryInfo(entry);

                    Stream stream;
                    try
                    {
                        stream = entry.OpenEntryStream();
                    }
                    catch (Exception ex)
                    {
                        throw Wrap(archivePath, ex);
                    }

                    using (stream)
                    {
                        await onEntry(info, stream, ct).ConfigureAwait(false);
                    }
                }
            }
        }

        private static void RequireNotEncrypted(string archivePath, IArchiveEntry entry)
        {
            if (entry.IsEncrypted)
            {
                throw new ArchiveReadException(
                    $"'{archivePath}' entry '{entry.Key}' is encrypted; encrypted archives are not supported.");
            }
        }

        private static ArchiveEntryInfo ToEntryInfo(IArchiveEntry entry) =>
            new(entry.Key ?? string.Empty, entry.Size, entry.IsDirectory, IsSymlink(entry));

        // No SharpCompress format exposes symlink-ness as a flag, so it is derived from the entry's
        // external attributes, and the Unix st_mode does not land in the same place for every format:
        // ZIP and 7z pack it into the high 16 bits of Attrib (the FILE_ATTRIBUTE_UNIX_EXTENSION
        // convention both formats share), while SharpCompress reports RAR's Attrib as the raw st_mode
        // itself, unshifted. Checking the type nibble at both positions covers all three without
        // risking a false positive — DOS/FAT attribute bytes (ZIP/7z's low word) never set bits above
        // 0x0400, so they can never collide with S_IFLNK's 0xA000. Attrib is null for archives that
        // never recorded a Unix mode (e.g. Windows-authored zips), which correctly yields false rather
        // than guessing.
        private static bool IsSymlink(IArchiveEntry entry)
        {
            if (entry.Attrib is not { } attrib) return false;

            const int symlinkTypeMask = 0xF000;
            const int symlinkTypeValue = 0xA000;

            return (attrib & symlinkTypeMask) == symlinkTypeValue
                || ((attrib >> 16) & symlinkTypeMask) == symlinkTypeValue;
        }

        private ArchiveReadException Wrap(string archivePath, Exception ex)
        {
            _log.InternalWarning($"SharpCompressArchiveReader: failed to read '{archivePath}': {ex.Message}");
            return new ArchiveReadException($"'{archivePath}' could not be read as an archive: {ex.Message}");
        }
    }
}
