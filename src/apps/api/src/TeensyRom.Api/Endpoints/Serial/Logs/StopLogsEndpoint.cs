using TeensyRom.Api.Services;

namespace TeensyRom.Api.Endpoints.Serial.Logs
{
    public class StopLogsResponse
    {
        public string Message { get; set; } = "Success!";
    }

    public class StopLogsEndpoint(IQueuedChannelLogger logService) : RadEndpointWithoutRequest<StopLogsResponse>
    {
        public override void Configure()
        {
            Delete("/logs")
                .WithName("StopLogs")
                .WithSummary("Stop Logging Channel")
                .WithTags("Devices")
                .WithDescription("Stops the logging service and returns a success message.")
                .Produces<StopLogsResponse>();
        }
        public override Task Handle(CancellationToken cancellationToken)
        {
            logService.StopLogStream();
            Send();
            return Task.CompletedTask;
        }
    }
}
