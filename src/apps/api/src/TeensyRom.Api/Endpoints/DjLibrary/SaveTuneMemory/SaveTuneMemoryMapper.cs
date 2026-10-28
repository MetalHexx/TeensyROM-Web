using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.SaveTuneMemory
{
    public class SaveTuneMemoryMapper : IRadMapper<SaveTuneMemoryRequest, SaveTuneMemoryResponse, DjTuneMemory>
    {
        public SaveTuneMemoryResponse FromEntity(DjTuneMemory entity) => new() { Message = "Tune memory saved successfully." };

        public DjTuneMemory ToEntity(SaveTuneMemoryRequest request) => DjLibraryMapping.ToDocument(request.Body);
    }
}
