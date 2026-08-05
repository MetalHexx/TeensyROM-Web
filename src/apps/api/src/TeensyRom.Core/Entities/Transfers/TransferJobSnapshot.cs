using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Core.Entities.Transfers
{
    public sealed record TransferJobSnapshot
    {
        public required string JobId { get; init; }
        public required string DeviceId { get; init; }
        public required TeensyStorageType StorageType { get; init; }
        public required string DestinationDirectory { get; init; }
        public required TransferJobState State { get; init; }
        public required int FilesReceived { get; init; }   // uploads accepted into staging
        public required int FilesSent { get; init; }       // written to the device successfully
        public required int FilesFailed { get; init; }
        public required long BytesSent { get; init; }
        public int? TotalFiles { get; init; }               // null until sealed; then FilesReceived
        public string? CurrentFile { get; init; }            // relative path being written, or null
        public required DateTime StartedUtc { get; init; }
        public required DateTime LastActivityUtc { get; init; }
        public string? Error { get; init; }                  // set on Aborted
        public required IReadOnlyList<TransferFileCompleted> Failures { get; init; }
    }
}
