using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.DjLibrary.ListDjSets
{
    /// <summary>
    /// Response model listing the stored DJ sets.
    /// </summary>
    public record ListDjSetsResponse
    {
        /// <summary>
        /// A summary of each readable set, ordered by name. Sets whose file is corrupt are left out.
        /// </summary>
        [Required] public List<DjSetSummaryDto> Sets { get; set; } = [];
    }
}
