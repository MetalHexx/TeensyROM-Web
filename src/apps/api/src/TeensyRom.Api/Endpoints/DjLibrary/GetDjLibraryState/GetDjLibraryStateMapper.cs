using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.GetDjLibraryState
{
    public class GetDjLibraryStateMapper : IRadMapper<object, GetDjLibraryStateResponse, DjLibraryState>
    {
        public GetDjLibraryStateResponse FromEntity(DjLibraryState entity) => new() { CurrentSetId = entity.CurrentSetId };

        public DjLibraryState ToEntity(object request) => throw new NotImplementedException();
    }
}
