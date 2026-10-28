using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.SaveTuneMemory
{
    public class SaveTuneMemoryEndpoint(IDjLibraryService library) : RadEndpoint<SaveTuneMemoryRequest, SaveTuneMemoryResponse, SaveTuneMemoryMapper>
    {
        public override void Configure()
        {
            Put("/api/dj/tunes/{sidHash}/memory")
                .Produces<SaveTuneMemoryResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("SaveTuneMemory")
                .WithSummary("Save Tune Memory")
                .WithTags("DjLibrary")
                .WithDescription(
                    "Saves the memory kept for one tune, replacing any stored memory for the same SID hash.\n\n" +
                    "**Validation:**\n" +
                    "- The route SID hash and the body SID hash are the same 32 lowercase hexadecimal characters\n" +
                    "- Last subtune is 1-256; memory subtunes are unique and within 1-256\n" +
                    "- Updated is an ISO-8601 timestamp\n" +
                    "- At most 128 markers per subtune with unique ids of 1-64 letters, digits, hyphens or underscores\n" +
                    "- Marker name is null or 1-48 characters after trimming; frame is 0 or more; offset is within 1000000 either way; 1-3 distinct voices in 0-2\n" +
                    "- Settings values are null or at most 8192 characters of JSON\n\n" +
                    "Anything outside these rules is rejected with a 400 and nothing is written."
                );
        }

        public override Task Handle(SaveTuneMemoryRequest r, CancellationToken ct)
        {
            var document = Map.ToEntity(r);

            if (!library.SaveTuneMemory(document))
            {
                SendInternalError("Failed to save the tune memory to disk. Please check file permissions and try again.");
                return Task.CompletedTask;
            }

            Response = Map.FromEntity(document);
            Send();
            return Task.CompletedTask;
        }
    }
}
