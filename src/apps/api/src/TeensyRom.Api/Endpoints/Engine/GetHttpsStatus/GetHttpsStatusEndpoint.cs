using TeensyRom.Api.Https;

namespace TeensyRom.Api.Endpoints.Engine.GetHttpsStatus
{
    public class GetHttpsStatusEndpoint(HttpsState state) : RadEndpointWithoutRequest<GetHttpsStatusResponse>
    {
        public override void Configure()
        {
            Get("/api/engine/https")
                .Produces<GetHttpsStatusResponse>(StatusCodes.Status200OK)
                .WithName("GetHttpsStatus")
                .WithSummary("Get the HTTPS Status")
                .WithTags("Engine")
                .WithDescription(
                    "Reports whether the engine is serving https in this run, and the certificate behind it.\n\n" +
                    "- The values describe the engine run as a whole, so a created or re-issued certificate is reported until the engine restarts.\n" +
                    "- When https is not being served, **problem** says why and the engine keeps serving http."
                );
        }

        public override Task Handle(CancellationToken ct)
        {
            var certificate = state.Certificate;

            Response = new GetHttpsStatusResponse
            {
                Port = state.Port,
                Listening = state.Listening,
                Problem = state.Problem,
                Names = certificate?.Names.ToList() ?? [],
                IssuedAt = certificate?.IssuedAt,
                ExpiresAt = certificate?.ExpiresAt,
                Change = certificate?.Change ?? HttpsCertificateChange.None,
                ChangeReason = certificate?.Reason
            };
            Send();
            return Task.CompletedTask;
        }
    }
}
