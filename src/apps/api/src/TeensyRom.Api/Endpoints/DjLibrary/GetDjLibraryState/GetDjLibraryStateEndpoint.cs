using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.GetDjLibraryState
{
    public class GetDjLibraryStateEndpoint(IDjLibraryService library) : RadEndpointWithoutRequest<GetDjLibraryStateResponse, GetDjLibraryStateMapper>
    {
        public override void Configure()
        {
            Get("/api/dj/library")
                .Produces<GetDjLibraryStateResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("GetDjLibraryState")
                .WithSummary("Get DJ Library State")
                .WithTags("DjLibrary")
                .WithDescription(
                    "Reads which set is current. The current set id is null when none was saved or the file is corrupt."
                );
        }

        public override Task Handle(CancellationToken ct)
        {
            Response = Map.FromEntity(library.GetLibraryState());
            Send();
            return Task.CompletedTask;
        }
    }
}
