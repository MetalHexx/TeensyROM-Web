using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.SaveDjSet
{
    public class SaveDjSetMapper : IRadMapper<SaveDjSetRequest, SaveDjSetResponse, DjSet>
    {
        public SaveDjSetResponse FromEntity(DjSet entity) => new() { Message = "DJ set saved successfully." };

        public DjSet ToEntity(SaveDjSetRequest request) => DjLibraryMapping.ToDocument(request.Body);
    }
}
