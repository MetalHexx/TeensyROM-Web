namespace TeensyRom.Api.Endpoints.DjLibrary.GetDjLibraryState
{
    /// <summary>
    /// Response model carrying the DJ library state.
    /// </summary>
    public record GetDjLibraryStateResponse
    {
        /// <summary>
        /// The id of the current set, or null when none is.
        /// </summary>
        public string? CurrentSetId { get; set; }
    }
}
