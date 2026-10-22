using TeensyRom.Core.Storage;

namespace TeensyRom.Core.Entities.Storage
{
    /// <summary>Outcome of reading a directory: found, genuinely absent, or the read itself failed.</summary>
    public sealed class DirectoryReadResult
    {
        public IStorageCacheItem? Item { get; init; }

        /// <summary>Set only when the read itself failed (as opposed to the directory not existing).</summary>
        public string? Failure { get; init; }
        public bool IsNotFound => Item is null && Failure is null;

        public static DirectoryReadResult Found(IStorageCacheItem item) => new() { Item = item };
        public static DirectoryReadResult NotFound() => new();
        public static DirectoryReadResult Failed(string message) => new() { Failure = message };
    }
}
