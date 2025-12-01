using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.Version.GetVersion
{
    /// <summary>
    /// Response model containing the application version information.
    /// </summary>
    public record GetVersionResponse
    {
        /// <summary>
        /// The semantic version of the TeensyROM application.
        /// Format: Major.Minor.Patch[-prerelease]
        /// Example: 1.0.0-alpha.1
        /// </summary>
        [Required] 
        public string Version { get; init; } = string.Empty;
    }
}
