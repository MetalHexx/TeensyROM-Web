using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.GetTuneMemory
{
    /// <summary>
    /// Request model for reading the memory kept for one tune.
    /// </summary>
    public record GetTuneMemoryRequest
    {
        /// <summary>
        /// The tune SID hash: 32 lowercase hexadecimal characters.
        /// </summary>
        [FromRoute] public string SidHash { get; set; } = string.Empty;
    }

    /// <summary>
    /// Response model carrying the memory kept for a tune.
    /// </summary>
    public record GetTuneMemoryResponse
    {
        /// <summary>
        /// The memory, or null when there is none for that tune or its file is corrupt.
        /// </summary>
        public DjTuneMemoryDto? Memory { get; set; }
    }

    // Validators
    public class GetTuneMemoryRequestValidator : AbstractValidator<GetTuneMemoryRequest>
    {
        public GetTuneMemoryRequestValidator()
        {
            RuleFor(x => x.SidHash)
                .Must(DjLibraryIds.IsSidHash).WithMessage("SID hash must be 32 lowercase hexadecimal characters.");
        }
    }
}
