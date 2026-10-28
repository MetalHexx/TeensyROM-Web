using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.GetDjSet
{
    public class GetDjSetMapper : IRadMapper<GetDjSetRequest, GetDjSetResponse, DjSet>
    {
        public GetDjSetResponse FromEntity(DjSet entity) => new() { Set = DjLibraryMapping.ToDto(entity) };

        public DjSet ToEntity(GetDjSetRequest request) => throw new NotImplementedException();
    }
}
