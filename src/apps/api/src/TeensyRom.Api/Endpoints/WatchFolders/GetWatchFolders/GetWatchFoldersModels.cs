using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.WatchFolders.GetWatchFolders
{
    /// <summary>
    /// Response model listing every watch folder.
    /// </summary>
    public class GetWatchFoldersResponse
    {
        /// <summary>The watch folders, in the order they were added.</summary>
        [Required] public List<WatchFolderDto> WatchFolders { get; set; } = [];
    }
}
