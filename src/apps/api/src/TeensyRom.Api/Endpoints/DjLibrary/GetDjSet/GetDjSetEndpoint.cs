using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.GetDjSet
{
    public class GetDjSetEndpoint(IDjLibraryService library) : RadEndpoint<GetDjSetRequest, GetDjSetResponse, GetDjSetMapper>
    {
        public override void Configure()
        {
            Get("/api/dj/sets/{setId}")
                .Produces<GetDjSetResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("GetDjSet")
                .WithSummary("Get DJ Set")
                .WithTags("DjLibrary")
                .WithDescription(
                    "Reads one DJ set with its rows and their memory.\n\n" +
                    "The set is null when none exists with that id or its file is corrupt; a corrupt file is left on disk.\n\n" +
                    "**Validation:**\n" +
                    "- The set id is a lowercase GUID in the hyphenated format"
                );
        }

        public override Task Handle(GetDjSetRequest r, CancellationToken ct)
        {
            var set = library.GetSet(r.SetId);
            Response = set is null ? new GetDjSetResponse() : Map.FromEntity(set);
            Send();
            return Task.CompletedTask;
        }
    }
}
