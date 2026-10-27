using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.ListDjSets
{
    public class ListDjSetsEndpoint(IDjLibraryService library) : RadEndpointWithoutRequest<ListDjSetsResponse, ListDjSetsMapper>
    {
        public override void Configure()
        {
            Get("/api/dj/sets")
                .Produces<ListDjSetsResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("ListDjSets")
                .WithSummary("List DJ Sets")
                .WithTags("DjLibrary")
                .WithDescription(
                    "Lists a summary of every stored DJ set: id, name, row count and last update.\n\n" +
                    "Sets live as files under the engine home. A set whose file is corrupt is skipped and left on disk."
                );
        }

        public override Task Handle(CancellationToken ct)
        {
            Response = Map.FromEntity(library.ListSets());
            Send();
            return Task.CompletedTask;
        }
    }
}
