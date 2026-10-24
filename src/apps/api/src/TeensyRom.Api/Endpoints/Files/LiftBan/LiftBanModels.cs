using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.Files.LiftBan
{
    /// <summary>
    /// Which ban list an entry is lifted from.
    /// </summary>
    public enum BanKind
    {
        /// <summary>
        /// The banned files list, which holds whole file names.
        /// </summary>
        File,

        /// <summary>
        /// The banned folders list, which holds folder entries.
        /// </summary>
        Folder
    }

    /// <summary>
    /// Request model for lifting one ban entry. Bans are engine-wide, so no device is needed.
    /// </summary>
    public class LiftBanRequest
    {
        /// <summary>
        /// A file name, a file path, or a folder entry. For files only the last path segment is used.
        /// </summary>
        [FromQuery]
        public string Entry { get; set; } = string.Empty;

        /// <summary>
        /// Whether to lift the entry from the banned files list or the banned folders list.
        /// </summary>
        [FromQuery]
        public BanKind Kind { get; set; } = BanKind.File;
    }

    public class LiftBanRequestValidator : AbstractValidator<LiftBanRequest>
    {
        public LiftBanRequestValidator()
        {
            RuleFor(x => x.Entry)
                .NotEmpty().WithMessage("Entry is required.")
                .Must(entry => !entry.Any(char.IsControl)).WithMessage("Entry must not contain control characters.");

            RuleFor(x => x.Kind)
                .IsInEnum().WithMessage("Kind must be a valid enum value.");
        }
    }

    /// <summary>
    /// Response model for the result of a lift ban operation.
    /// </summary>
    public class LiftBanResponse
    {
        /// <summary>
        /// A message indicating the result of the operation.
        /// </summary>
        [Required] public string Message { get; set; } = string.Empty;

        /// <summary>
        /// The file name or folder entry the request resolved to.
        /// </summary>
        [Required] public string Entry { get; set; } = string.Empty;

        /// <summary>
        /// The ban list the entry was looked up in.
        /// </summary>
        [Required] public BanKind Kind { get; set; }

        /// <summary>
        /// True when at least one entry was removed. False when nothing matched and nothing was saved.
        /// </summary>
        [Required] public bool Lifted { get; set; }
    }
}
