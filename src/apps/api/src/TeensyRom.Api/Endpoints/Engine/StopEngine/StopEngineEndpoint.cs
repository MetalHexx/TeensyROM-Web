using TeensyRom.Api.Http;
using TeensyRom.Api.Services;

namespace TeensyRom.Api.Endpoints.Engine.StopEngine
{
    /// <summary>
    /// Stops the engine for a caller on the engine's own machine. Known limitation: loopback is the only gate and
    /// the UI CORS policy allows any origin, so a web page open in a local browser can also stop the engine
    /// (denial of service only).
    /// </summary>
    public class StopEngineEndpoint(IEngineShutdown shutdown) : RadEndpointWithoutRequest<StopEngineResponse>
    {
        public override void Configure()
        {
            Post("/api/engine/stop")
                .Produces<StopEngineResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .WithName("StopEngine")
                .WithSummary("Stop the Engine")
                .WithTags("Engine")
                .WithDescription(
                    "Gracefully shuts the TeensyROM engine down, ending its process and releasing its instance lock.\n\n" +
                    "- Only callers on the machine the engine runs on are accepted; any other caller receives a 403 and the engine keeps running.\n" +
                    "- The response is sent before the engine begins stopping."
                );
        }

        public override Task Handle(CancellationToken ct)
        {
            if (!LocalCaller.IsLoopback(HttpContext.Connection.RemoteIpAddress))
            {
                SendProblem(TypedResults.Problem(
                    title: "Forbidden",
                    statusCode: StatusCodes.Status403Forbidden,
                    detail: "The engine can only be stopped from the machine it runs on."
                ));
                return Task.CompletedTask;
            }

            Response = new StopEngineResponse();
            Send();
            shutdown.RequestStop();
            return Task.CompletedTask;
        }
    }
}
