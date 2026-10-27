using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary.ListDjSets
{
    public class ListDjSetsMapper : IRadMapper<object, ListDjSetsResponse, IReadOnlyList<DjSetSummary>>
    {
        public ListDjSetsResponse FromEntity(IReadOnlyList<DjSetSummary> entity) => new()
        {
            Sets = entity.Select(DjLibraryMapping.ToDto).ToList()
        };

        public IReadOnlyList<DjSetSummary> ToEntity(object request) => throw new NotImplementedException();
    }
}
