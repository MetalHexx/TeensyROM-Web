using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Models
{
    /// <summary>
    /// Where a transfer job came from. Watch-folder fields are null for an upload.
    /// </summary>
    public class TransferOriginDto
    {
        [Required] public TransferOriginKind Kind { get; set; }
        public string? WatchFolderId { get; set; }
        public string? WatchFolderPath { get; set; }

        public static TransferOriginDto From(TransferOrigin origin) => new()
        {
            Kind = origin.Kind,
            WatchFolderId = origin.WatchFolderId,
            WatchFolderPath = origin.WatchFolderPath
        };
    }
}
