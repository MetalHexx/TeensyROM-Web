using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Models
{
    /// <summary>
    /// The single wire shape for a transfer job snapshot. Sent by <c>TransferHub</c> over SignalR and
    /// returned by the transfer query endpoints over HTTP, so both transports observe the same JSON —
    /// the domain <see cref="TransferJobSnapshot"/> never crosses a wire.
    /// </summary>
    public class TransferJobDto
    {
        [Required] public string JobId { get; set; } = string.Empty;
        [Required] public string DeviceId { get; set; } = string.Empty;
        [Required] public TeensyStorageType StorageType { get; set; }
        [Required] public string DestinationDirectory { get; set; } = string.Empty;
        [Required] public TransferJobState State { get; set; }
        [Required] public int FilesReceived { get; set; }
        [Required] public int FilesSent { get; set; }
        [Required] public int FilesFailed { get; set; }
        [Required] public long BytesSent { get; set; }
        public int? TotalFiles { get; set; }
        public string? CurrentFile { get; set; }
        [Required] public DateTime StartedUtc { get; set; }
        [Required] public DateTime LastActivityUtc { get; set; }
        public string? Error { get; set; }
        [Required] public List<TransferFileCompleted> Failures { get; set; } = [];
        [Required] public List<TransferFileCompleted> RecentCompletions { get; set; } = [];
        [Required] public double BytesPerSecond { get; set; }
        [Required] public double FilesPerSecond { get; set; }
        public string? ExpandingArchive { get; set; }
        [Required] public long ExpansionBytesWritten { get; set; }
        [Required] public long ExpansionBytesDeclared { get; set; }
        public int? ExpandedFileCount { get; set; }

        /// <summary>
        /// Maps a domain snapshot to the wire shape. The only place a <see cref="TransferJobSnapshot"/>
        /// is translated for transport — use it from every endpoint and hub that exposes job state.
        /// </summary>
        public static TransferJobDto From(TransferJobSnapshot snapshot) => new()
        {
            JobId = snapshot.JobId,
            DeviceId = snapshot.DeviceId,
            StorageType = snapshot.StorageType,
            DestinationDirectory = snapshot.DestinationDirectory,
            State = snapshot.State,
            FilesReceived = snapshot.FilesReceived,
            FilesSent = snapshot.FilesSent,
            FilesFailed = snapshot.FilesFailed,
            BytesSent = snapshot.BytesSent,
            TotalFiles = snapshot.TotalFiles,
            CurrentFile = snapshot.CurrentFile,
            StartedUtc = snapshot.StartedUtc,
            LastActivityUtc = snapshot.LastActivityUtc,
            Error = snapshot.Error,
            Failures = [.. snapshot.Failures],
            RecentCompletions = [.. snapshot.RecentCompletions],
            BytesPerSecond = snapshot.BytesPerSecond,
            FilesPerSecond = snapshot.FilesPerSecond,
            ExpandingArchive = snapshot.ExpandingArchive,
            ExpansionBytesWritten = snapshot.ExpansionBytesWritten,
            ExpansionBytesDeclared = snapshot.ExpansionBytesDeclared,
            ExpandedFileCount = snapshot.ExpandedFileCount
        };
    }
}
