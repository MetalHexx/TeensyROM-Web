using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.WatchFolders.SetWatchFolderEnabled
{
    /// <summary>
    /// Request model for turning a watch folder on or off.
    /// </summary>
    public class SetWatchFolderEnabledRequest
    {
        /// <summary>
        /// The ID of the watch folder.
        /// </summary>
        [FromRoute] public string WatchFolderId { get; set; } = string.Empty;

        /// <summary>
        /// The JSON request body, bound as a whole.
        /// </summary>
        [FromBody] public SetWatchFolderEnabledBody Body { get; set; } = new();
    }

    /// <summary>
    /// The JSON body of a set-enabled request.
    /// </summary>
    public class SetWatchFolderEnabledBody
    {
        /// <summary>
        /// True to watch the folder, false to turn it off.
        /// </summary>
        public bool Enabled { get; set; }
    }

    public class SetWatchFolderEnabledRequestValidator : AbstractValidator<SetWatchFolderEnabledRequest>
    {
        public SetWatchFolderEnabledRequestValidator()
        {
            RuleFor(x => x.WatchFolderId).NotEmpty().WithMessage("Watch folder ID is required.");
        }
    }

    /// <summary>
    /// Response model for a watch folder turned on or off.
    /// </summary>
    public class SetWatchFolderEnabledResponse
    {
        /// <summary>The watch folder as it is now.</summary>
        [Required] public WatchFolderDto WatchFolder { get; set; } = null!;
    }
}
