using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.GetTuneGrids
{
    /// <summary>
    /// Request model for reading the beat grids kept for one tune.
    /// </summary>
    public record GetTuneGridsRequest
    {
        /// <summary>
        /// The tune SID hash: 32 lowercase hexadecimal characters.
        /// </summary>
        [FromRoute] public string SidHash { get; set; } = string.Empty;
    }

    /// <summary>
    /// Response model carrying the beat grids kept for a tune.
    /// </summary>
    public record GetTuneGridsResponse
    {
        /// <summary>
        /// The grids, or null when there are none for that tune or their file is corrupt.
        /// </summary>
        public DjTuneGridsDto? Grids { get; set; }
    }

    // Validators
    public class GetTuneGridsRequestValidator : AbstractValidator<GetTuneGridsRequest>
    {
        public GetTuneGridsRequestValidator()
        {
            RuleFor(x => x.SidHash)
                .Must(DjLibraryIds.IsSidHash).WithMessage("SID hash must be 32 lowercase hexadecimal characters.");
        }
    }
}
