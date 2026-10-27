using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.SaveDjSet
{
    public class SaveDjSetEndpoint(IDjLibraryService library) : RadEndpoint<SaveDjSetRequest, SaveDjSetResponse, SaveDjSetMapper>
    {
        public override void Configure()
        {
            Put("/api/dj/sets/{setId}")
                .Produces<SaveDjSetResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("SaveDjSet")
                .WithSummary("Save DJ Set")
                .WithTags("DjLibrary")
                .WithDescription(
                    "Saves a DJ set, replacing any stored set with the same id.\n\n" +
                    "**Validation:**\n" +
                    "- The set id and the body id are the same lowercase GUID\n" +
                    "- Name and placeholder are 1-64 characters after trimming, with no control characters\n" +
                    "- Created and updated are ISO-8601 timestamps\n" +
                    "- At most 1000 sets in the library and 1000 rows per set; row ids are unique GUIDs and each SID appears once\n" +
                    "- Tune: SID hash is 32 lowercase hex characters; title, author and released are at most 64 characters; 1-256 subtunes; 1-1048576 bytes\n" +
                    "- Copied-from SID hash equals the SID hash of the row tune\n" +
                    "- Last subtune and each memory subtune are within 1 to the subtune count; memory subtunes are unique\n" +
                    "- At most 128 markers per subtune with unique ids of 1-64 letters, digits, hyphens or underscores\n" +
                    "- Marker name is null or 1-48 characters after trimming; frame is 0 or more; offset is within 1000000 either way; 1-3 distinct voices in 0-2\n" +
                    "- Host and settings values are null or at most 8192 characters of JSON\n\n" +
                    "Anything outside these rules is rejected with a 400 and nothing is written."
                );
        }

        public override Task Handle(SaveDjSetRequest r, CancellationToken ct)
        {
            var document = Map.ToEntity(r);

            switch (library.SaveSet(document))
            {
                case DjSaveResult.Saved:
                    Response = Map.FromEntity(document);
                    Send();
                    break;
                case DjSaveResult.LimitReached:
                    SendValidationError($"The library already holds the maximum of {DjLibraryLimits.MaxSets} sets. Delete a set before adding another.");
                    break;
                default:
                    SendInternalError("Failed to save the DJ set to disk. Please check file permissions and try again.");
                    break;
            }

            return Task.CompletedTask;
        }
    }
}
