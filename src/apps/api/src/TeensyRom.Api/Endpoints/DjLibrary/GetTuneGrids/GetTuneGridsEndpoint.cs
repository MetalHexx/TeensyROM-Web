using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.GetTuneGrids
{
    public class GetTuneGridsEndpoint(IDjLibraryService library) : RadEndpoint<GetTuneGridsRequest, GetTuneGridsResponse, GetTuneGridsMapper>
    {
        public override void Configure()
        {
            Get("/api/dj/tunes/{sidHash}/grids")
                .Produces<GetTuneGridsResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("GetTuneGrids")
                .WithSummary("Get Tune Grids")
                .WithTags("DjLibrary")
                .WithDescription(
                    "Reads the beat grids a DJ tapped for one tune: a beat length and first-beat frame per subtune.\n\n" +
                    "The grids are null when none exist for the tune or their file is corrupt; a corrupt file is left on disk.\n\n" +
                    "**Validation:**\n" +
                    "- The SID hash is 32 lowercase hexadecimal characters"
                );
        }

        public override Task Handle(GetTuneGridsRequest r, CancellationToken ct)
        {
            var grids = library.GetTuneGrids(r.SidHash);
            Response = grids is null ? new GetTuneGridsResponse() : Map.FromEntity(grids);
            Send();
            return Task.CompletedTask;
        }
    }
}
