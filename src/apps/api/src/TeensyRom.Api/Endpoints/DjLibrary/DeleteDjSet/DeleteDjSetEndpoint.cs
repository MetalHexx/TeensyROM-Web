using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.DeleteDjSet
{
    public class DeleteDjSetEndpoint(IDjLibraryService library) : RadEndpoint<DeleteDjSetRequest, DeleteDjSetResponse>
    {
        public override void Configure()
        {
            Delete("/api/dj/sets/{setId}")
                .Produces<DeleteDjSetResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("DeleteDjSet")
                .WithSummary("Delete DJ Set")
                .WithTags("DjLibrary")
                .WithDescription(
                    "Deletes a DJ set file. Deleting a set that does not exist succeeds.\n\n" +
                    "Tune memory is kept.\n\n" +
                    "**Validation:**\n" +
                    "- The set id is a lowercase GUID in the hyphenated format"
                );
        }

        public override Task Handle(DeleteDjSetRequest r, CancellationToken ct)
        {
            if (!library.DeleteSet(r.SetId))
            {
                SendInternalError("Failed to delete the DJ set from disk. Please check file permissions and try again.");
                return Task.CompletedTask;
            }

            Response = new();
            Send();
            return Task.CompletedTask;
        }
    }
}
