using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.SaveDjLibraryState
{
    public class SaveDjLibraryStateEndpoint(IDjLibraryService library)
        : RadEndpoint<SaveDjLibraryStateRequest, SaveDjLibraryStateResponse, SaveDjLibraryStateMapper>
    {
        public override void Configure()
        {
            Put("/api/dj/library")
                .Produces<SaveDjLibraryStateResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("SaveDjLibraryState")
                .WithSummary("Save DJ Library State")
                .WithTags("DjLibrary")
                .WithDescription(
                    "Saves which set is current.\n\n" +
                    "**Validation:**\n" +
                    "- The current set id is null or a lowercase GUID in the hyphenated format\n\n" +
                    "Anything outside these rules is rejected with a 400 and nothing is written."
                );
        }

        public override Task Handle(SaveDjLibraryStateRequest r, CancellationToken ct)
        {
            var document = Map.ToEntity(r);

            if (!library.SaveLibraryState(document))
            {
                SendInternalError("Failed to save the DJ library state to disk. Please check file permissions and try again.");
                return Task.CompletedTask;
            }

            Response = Map.FromEntity(document);
            Send();
            return Task.CompletedTask;
        }
    }
}
