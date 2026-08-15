using System.Text.RegularExpressions;

namespace TeensyRom.Api.Transfers.Archives
{
    /// <summary>
    /// Turns an archive entry's own path into a normalized relative path safe to append to a destination.
    /// Pure — no file access, no platform probing. Refuses rather than sanitizes: a name that has to be
    /// rewritten to be safe is a name that was trying something.
    ///
    /// This resolver deliberately does not police characters or reserved words that Windows rejects, and it
    /// applies one fixed length limit rather than the running platform's. Both omissions have the same cause:
    /// nothing derived from an entry name ever becomes a host filename. Scratch and staging both name files
    /// with opaque counters, so the host filesystem never sees an archive's names at all, and Windows' shorter
    /// path ceiling is unreachable by construction. The only place the real name matters is the device path,
    /// which the fixed 4096 bound covers. This is the resolution of the platform-path-length requirement — it
    /// is answered by design rather than by a check, and that has to be written down, or a future reader adds
    /// a RuntimeInformation.IsOSPlatform branch here and starts refusing legitimate archives packed on Linux.
    /// </summary>
    public static class ArchiveEntryPathResolver
    {
        private const int MaxPathLength = 4096;
        private static readonly Regex WindowsDriveRoot = new(@"^[A-Za-z]:[/\\]", RegexOptions.Compiled);

        /// <summary>
        /// Resolves an archive entry's path into a normalized, safe relative path.
        /// Returns false with a reason when the entry name is unusable.
        /// </summary>
        public static bool TryResolve(string entryPath, out string relativePath, out string? error)
        {
            relativePath = string.Empty;

            if (string.IsNullOrWhiteSpace(entryPath))
            {
                error = "Archive entry path is empty.";
                return false;
            }

            if (entryPath.Length > MaxPathLength)
            {
                error = "Archive entry path exceeds the maximum allowed length.";
                return false;
            }

            var normalized = entryPath.Replace('\\', '/');

            if (normalized.StartsWith('/') || WindowsDriveRoot.IsMatch(normalized))
            {
                error = "Archive entry path must not be rooted.";
                return false;
            }

            while (normalized.Contains("//"))
            {
                normalized = normalized.Replace("//", "/");
            }

            normalized = normalized.TrimStart('/');

            if (string.IsNullOrWhiteSpace(normalized))
            {
                error = "Archive entry path is empty.";
                return false;
            }

            var segments = normalized.Split('/', StringSplitOptions.RemoveEmptyEntries);

            if (segments.Length == 0 || segments.Any(s => s is "." or ".."))
            {
                error = "Archive entry path must not contain '.' or '..' segments.";
                return false;
            }

            relativePath = normalized;
            error = null;
            return true;
        }
    }

    /// <summary>
    /// Tracks device-side relative paths produced within one expansion, case-insensitively.
    /// Returns false for the second entry that differs only in case — deterministic and reported,
    /// never a silent overwrite.
    /// </summary>
    public sealed class ArchiveEntryPathSet
    {
        private readonly HashSet<string> _paths = new(StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// Attempts to add a relative path to the set. Returns false if a path differing only in case
        /// has already been added.
        /// </summary>
        public bool TryAdd(string relativePath)
        {
            return _paths.Add(relativePath);
        }
    }
}
