using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.GetDjSet
{
    /// <summary>
    /// Request model for reading one DJ set.
    /// </summary>
    public record GetDjSetRequest
    {
        /// <summary>
        /// The set id: a lowercase GUID in the hyphenated format.
        /// </summary>
        [FromRoute] public string SetId { get; set; } = string.Empty;
    }

    /// <summary>
    /// Response model carrying a DJ set.
    /// </summary>
    public record GetDjSetResponse
    {
        /// <summary>
        /// The set, or null when there is none with that id or its file is corrupt.
        /// </summary>
        public DjSetDto? Set { get; set; }
    }

    // Validators
    public class GetDjSetRequestValidator : AbstractValidator<GetDjSetRequest>
    {
        public GetDjSetRequestValidator()
        {
            RuleFor(x => x.SetId)
                .Must(DjLibraryIds.IsSetId).WithMessage("Set ID must be a lowercase GUID.");
        }
    }
}
