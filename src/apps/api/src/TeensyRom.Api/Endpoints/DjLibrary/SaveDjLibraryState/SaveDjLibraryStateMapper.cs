using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.SaveDjLibraryState
{
    public class SaveDjLibraryStateMapper : IRadMapper<SaveDjLibraryStateRequest, SaveDjLibraryStateResponse, DjLibraryState>
    {
        public SaveDjLibraryStateResponse FromEntity(DjLibraryState entity) => new() { Message = "DJ library state saved successfully." };

        public DjLibraryState ToEntity(SaveDjLibraryStateRequest request) => DjLibraryMapping.ToDocument(request.Body);
    }
}
