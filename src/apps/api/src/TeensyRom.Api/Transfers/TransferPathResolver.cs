using System.Text.RegularExpressions;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Device-side path rules for a client-supplied relative path. Pure and unit-testable. The host side
    /// is already closed by opaque staged filenames; this is the guard for the path the file lands at on
    /// the device.
    /// </summary>
    public static class TransferPathResolver
    {
        private const int MaxPathLength = 4096;
        private static readonly Regex WindowsDriveRoot = new(@"^[A-Za-z]:[/\\]", RegexOptions.Compiled);

        /// Returns false with a reason when the relative path is unusable.
        public static bool TryResolve(
            DirectoryPath destination, string clientRelativePath, out FilePath targetPath, out string? error)
        {
            targetPath = null!;

            if (string.IsNullOrWhiteSpace(clientRelativePath))
            {
                error = "Relative path is empty.";
                return false;
            }

            if (clientRelativePath.Length > MaxPathLength)
            {
                error = "Relative path exceeds the maximum allowed length.";
                return false;
            }

            var normalized = clientRelativePath.Replace('\\', '/');

            if (normalized.StartsWith('/') || WindowsDriveRoot.IsMatch(normalized))
            {
                error = "Relative path must not be rooted.";
                return false;
            }

            while (normalized.Contains("//"))
            {
                normalized = normalized.Replace("//", "/");
            }

            normalized = normalized.TrimStart('/');

            if (string.IsNullOrWhiteSpace(normalized))
            {
                error = "Relative path is empty.";
                return false;
            }

            var segments = normalized.Split('/', StringSplitOptions.RemoveEmptyEntries);

            if (segments.Length == 0 || segments.Any(s => s is "." or ".."))
            {
                error = "Relative path must not contain '.' or '..' segments.";
                return false;
            }

            try
            {
                var relativeFilePath = new FilePath(normalized);
                targetPath = destination.Combine(relativeFilePath);
                error = null;
                return true;
            }
            catch (ArgumentException ex)
            {
                error = ex.Message;
                return false;
            }
        }
    }
}
