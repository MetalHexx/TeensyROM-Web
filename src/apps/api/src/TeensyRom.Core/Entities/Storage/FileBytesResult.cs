namespace TeensyRom.Core.Entities.Storage
{
    public enum FileBytesError { NotFound, StorageUnavailable, Failed }

    public sealed class FileBytesResult
    {
        public byte[]? Bytes { get; init; }
        public FileBytesError? Error { get; init; }
        public bool IsSuccess => Bytes is not null;

        public static FileBytesResult Success(byte[] bytes) => new() { Bytes = bytes };
        public static FileBytesResult Failure(FileBytesError error) => new() { Error = error };
    }
}
