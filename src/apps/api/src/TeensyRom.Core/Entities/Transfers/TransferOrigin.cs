namespace TeensyRom.Core.Entities.Transfers
{
    public enum TransferOriginKind { Upload, WatchFolder }

    /// <summary>Where a transfer job came from: an HTTP upload, or a watched folder on the engine's host.</summary>
    public sealed record TransferOrigin(TransferOriginKind Kind, string? WatchFolderId = null, string? WatchFolderPath = null)
    {
        public static TransferOrigin Upload { get; } = new(TransferOriginKind.Upload);

        public static TransferOrigin FromWatchFolder(string watchFolderId, string watchFolderPath) =>
            new(TransferOriginKind.WatchFolder, watchFolderId, watchFolderPath);
    }
}
