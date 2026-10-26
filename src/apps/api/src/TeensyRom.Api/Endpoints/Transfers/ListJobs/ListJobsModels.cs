using System.ComponentModel.DataAnnotations;
using TeensyRom.Api.Models;

namespace TeensyRom.Api.Endpoints.Transfers.ListJobs
{
    /// <summary>
    /// Response model containing every transfer job the engine currently knows about.
    /// </summary>
    public class ListJobsResponse
    {
        /// <summary>
        /// Every job snapshot, newest start first. Empty when there are no jobs - not a 404.
        /// </summary>
        [Required] public List<TransferJobDto> Jobs { get; set; } = [];
    }
}
