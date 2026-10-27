using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.WatchFolders.RemoveWatchFolder
{
    /// <summary>
    /// Request model for removing a watch folder.
    /// </summary>
    public class RemoveWatchFolderRequest
    {
        /// <summary>
        /// The ID of the watch folder to remove.
        /// </summary>
        [FromRoute] public string WatchFolderId { get; set; } = string.Empty;
    }

    public class RemoveWatchFolderRequestValidator : AbstractValidator<RemoveWatchFolderRequest>
    {
        public RemoveWatchFolderRequestValidator()
        {
            RuleFor(x => x.WatchFolderId).NotEmpty().WithMessage("Watch folder ID is required.");
        }
    }

    /// <summary>
    /// Response model for a removed watch folder.
    /// </summary>
    public class RemoveWatchFolderResponse
    {
        /// <summary>A confirmation message.</summary>
        [Required] public string Message { get; set; } = string.Empty;
    }
}
