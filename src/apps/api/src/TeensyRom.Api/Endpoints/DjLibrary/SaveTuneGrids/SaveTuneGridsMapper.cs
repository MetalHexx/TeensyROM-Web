using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.SaveTuneGrids
{
    public class SaveTuneGridsMapper : IRadMapper<SaveTuneGridsRequest, SaveTuneGridsResponse, DjTuneGrids>
    {
        public SaveTuneGridsResponse FromEntity(DjTuneGrids entity) => new() { Message = "Tune grids saved successfully." };

        public DjTuneGrids ToEntity(SaveTuneGridsRequest request) => DjLibraryMapping.ToDocument(request.Body);
    }
}
