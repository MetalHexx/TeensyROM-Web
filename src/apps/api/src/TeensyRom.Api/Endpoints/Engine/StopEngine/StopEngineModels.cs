using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.Engine.StopEngine
{
    /// <summary>
    /// Response returned when a stop request has been accepted.
    /// </summary>
    public class StopEngineResponse
    {
        /// <summary>
        /// A human-readable confirmation that the engine is shutting down.
        /// </summary>
        [Required]
        public string Message { get; set; } = "The TeensyROM engine is stopping.";
    }
}
