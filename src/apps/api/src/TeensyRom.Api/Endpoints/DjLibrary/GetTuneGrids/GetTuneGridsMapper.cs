using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.GetTuneGrids
{
    public class GetTuneGridsMapper : IRadMapper<GetTuneGridsRequest, GetTuneGridsResponse, DjTuneGrids>
    {
        public GetTuneGridsResponse FromEntity(DjTuneGrids entity) => new() { Grids = DjLibraryMapping.ToDto(entity) };

        public DjTuneGrids ToEntity(GetTuneGridsRequest request) => throw new NotImplementedException();
    }
}
