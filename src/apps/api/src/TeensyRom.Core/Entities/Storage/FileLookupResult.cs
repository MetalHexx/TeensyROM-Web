namespace TeensyRom.Core.Entities.Storage
{
    /// <summary>Outcome of looking up a file: found, genuinely absent, or reading its parent directory failed.</summary>
    public sealed class FileLookupResult
    {
        public FileItem? File { get; init; }

        /// <summary>Set only when the lookup itself failed (as opposed to the file not existing).</summary>
        public string? Failure { get; init; }
        public bool IsNotFound => File is null && Failure is null;

        public static FileLookupResult Found(FileItem file) => new() { File = file };
        public static FileLookupResult NotFound() => new();
        public static FileLookupResult Failed(string message) => new() { Failure = message };
    }
}
