using TeensyRom.Api.Services;

namespace TeensyRom.Api.Endpoints.Serial.Logs
{
    public class StartLogsResponse
    {
        public string Message { get; set; } = "Success!";
    }
    public class StartLogsEndpoint(IQueuedChannelLogger logService) : RadEndpointWithoutRequest<StartLogsResponse>
    {
        public override void Configure()
        {
            Post("/api/logs")
                .WithName("StartLogs")
                .WithSummary("Start Logging Hub")
                .WithTags("Devices")
                .WithDescription("Starts the logging service and returns a success message.")
                .Produces<StartLogsResponse>();
        }
        public override Task Handle(CancellationToken cancellationToken)
        {
            logService.StartLogStream();
            Response = new StartLogsResponse();
            Send();
            return Task.CompletedTask;
        }
    }
}
