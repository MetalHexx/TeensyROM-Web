using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.GetTuneMemory
{
    public class GetTuneMemoryEndpoint(IDjLibraryService library) : RadEndpoint<GetTuneMemoryRequest, GetTuneMemoryResponse, GetTuneMemoryMapper>
    {
        public override void Configure()
        {
            Get("/api/dj/tunes/{sidHash}/memory")
                .Produces<GetTuneMemoryResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("GetTuneMemory")
                .WithSummary("Get Tune Memory")
                .WithTags("DjLibrary")
                .WithDescription(
                    "Reads the memory kept for one tune: last subtune, loop markers and settings per subtune.\n\n" +
                    "The memory is null when none exists for the tune or its file is corrupt; a corrupt file is left on disk.\n\n" +
                    "**Validation:**\n" +
                    "- The SID hash is 32 lowercase hexadecimal characters"
                );
        }

        public override Task Handle(GetTuneMemoryRequest r, CancellationToken ct)
        {
            var memory = library.GetTuneMemory(r.SidHash);
            Response = memory is null ? new GetTuneMemoryResponse() : Map.FromEntity(memory);
            Send();
            return Task.CompletedTask;
        }
    }
}
