using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.SaveTuneGrids
{
    public class SaveTuneGridsEndpoint(IDjLibraryService library) : RadEndpoint<SaveTuneGridsRequest, SaveTuneGridsResponse, SaveTuneGridsMapper>
    {
        public override void Configure()
        {
            Put("/api/dj/tunes/{sidHash}/grids")
                .Produces<SaveTuneGridsResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("SaveTuneGrids")
                .WithSummary("Save Tune Grids")
                .WithTags("DjLibrary")
                .WithDescription(
                    "Saves the beat grids kept for one tune, replacing any stored grids for the same SID hash.\n\n" +
                    "**Validation:**\n" +
                    "- The route SID hash and the body SID hash are the same 32 lowercase hexadecimal characters\n" +
                    "- At most 256 subtune grids, unique and within 1-256\n" +
                    "- Beat frames is 1-4096; beat one frame is 0 or more\n" +
                    "- Updated is an ISO-8601 timestamp\n\n" +
                    "Anything outside these rules is rejected with a 400 and nothing is written."
                );
        }

        public override Task Handle(SaveTuneGridsRequest r, CancellationToken ct)
        {
            var document = Map.ToEntity(r);

            if (!library.SaveTuneGrids(document))
            {
                SendInternalError("Failed to save the tune grids to disk. Please check file permissions and try again.");
                return Task.CompletedTask;
            }

            Response = Map.FromEntity(document);
            Send();
            return Task.CompletedTask;
        }
    }
}
