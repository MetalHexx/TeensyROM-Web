using System.ComponentModel.DataAnnotations;
using TeensyRom.Api.Https;

namespace TeensyRom.Api.Endpoints.Engine.GetHttpsStatus
{
    /// <summary>
    /// What HTTPS did for the current engine run.
    /// </summary>
    public record GetHttpsStatusResponse
    {
        /// <summary>
        /// The port the engine serves, or would serve, https on.
        /// </summary>
        [Required]
        public int Port { get; init; }

        /// <summary>
        /// True when the engine is serving https on <see cref="Port"/> in this run.
        /// </summary>
        [Required]
        public bool Listening { get; init; }

        /// <summary>
        /// Why https is not being served, as a sentence for the user. Null while listening.
        /// </summary>
        public string? Problem { get; init; }

        /// <summary>
        /// The DNS names and IP addresses the certificate covers. Empty when there is no certificate.
        /// </summary>
        [Required]
        public List<string> Names { get; init; } = [];

        /// <summary>
        /// When the certificate became valid. Null when there is no certificate.
        /// </summary>
        public DateTimeOffset? IssuedAt { get; init; }

        /// <summary>
        /// When the certificate expires. Null when there is no certificate.
        /// </summary>
        public DateTimeOffset? ExpiresAt { get; init; }

        /// <summary>
        /// What happened to the certificate when this engine started: None, Created or Reissued. It holds until the engine restarts.
        /// </summary>
        [Required]
        public HttpsCertificateChange Change { get; init; }

        /// <summary>
        /// Why the certificate was re-issued: Unreadable, Expiring, HostNameChanged or NewAddress. Null unless Change is Reissued.
        /// </summary>
        public HttpsCertificateChangeReason? ChangeReason { get; init; }
    }
}
