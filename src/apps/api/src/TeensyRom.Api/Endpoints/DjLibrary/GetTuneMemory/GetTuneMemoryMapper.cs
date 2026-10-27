using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.GetTuneMemory
{
    public class GetTuneMemoryMapper : IRadMapper<GetTuneMemoryRequest, GetTuneMemoryResponse, DjTuneMemory>
    {
        public GetTuneMemoryResponse FromEntity(DjTuneMemory entity) => new() { Memory = DjLibraryMapping.ToDto(entity) };

        public DjTuneMemory ToEntity(GetTuneMemoryRequest request) => throw new NotImplementedException();
    }
}
