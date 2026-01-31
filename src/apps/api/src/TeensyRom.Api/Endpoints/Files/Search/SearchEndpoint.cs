using System.Text.RegularExpressions;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Endpoints.Files.Search
{
    public class SearchEndpoint(IDeviceConnectionManager deviceManager) : RadEndpoint<SearchRequest, SearchResponse>
    {
        public override void Configure()
        {
            Get("/api/devices/{deviceId}/search")
                .Produces<SearchResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .WithName("Search")
                .WithSummary("Search Files")
                .WithTags("Files")
                .WithDescription(
                    "Searches for files across all available storage devices (SD and USB) based on search text and filter criteria.\n\n" +
                    "- Searches through file names, titles, creators, and descriptions.\n" +
                    "- Returns metadata for all matching files from all available storages.\n" +
                    "- Supports file type filtering (All, Games, Music, Images, Hex).\n" +
                    "- Supports pagination with Skip and Take parameters.\n" +
                    "- Excludes favorites and playlist directories from search results.\n" +
                    "- Uses weighted search algorithm to rank results by relevance.\n" +
                    "- Default page size is 50, maximum is 200."
                );
        }

        public override Task Handle(SearchRequest r, CancellationToken ct)
        {
            var device = deviceManager.GetAvailableDevice(r.DeviceId!);
            if (device is null)
            {
                SendNotFound($"The device {r.DeviceId} was not found.");
                return Task.CompletedTask;
            }

            var filterType = r.FilterType ?? TeensyFilterType.All;
            
            // Collect results from all available storages
            var allResults = new List<LaunchableItem>();
            
            if (device.SdStorage is not null)
            {
                allResults.AddRange(device.SdStorage.Search(r.SearchText, filterType));
            }
            
            if (device.UsbStorage is not null)
            {
                allResults.AddRange(device.UsbStorage.Search(r.SearchText, filterType));
            }
            
            // Score, sort, and paginate combined results
            var searchTerms = ParseSearchTerms(r.SearchText);
            var weights = new SearchWeights();
            
            var scoredResults = allResults
                .Select(file => new { File = file, Score = CalculateScore(file, searchTerms, weights) })
                .OrderByDescending(x => x.Score)
                .ThenBy(x => x.File.Title)
                .ToList();
            
            var totalCount = scoredResults.Count;
            var paginatedResults = scoredResults.Skip(r.Skip).Take(r.Take);
            var fileItems = paginatedResults.Select(x => FileItemDto.FromLaunchable(x.File)).ToList();
            var hasMore = (r.Skip + r.Take) < totalCount;

            Response = new()
            {
                Files = fileItems,
                SearchText = r.SearchText,
                TotalCount = totalCount,
                Count = fileItems.Count,
                Skip = r.Skip,
                Take = r.Take,
                HasMore = hasMore,
                Message = totalCount > 0 
                    ? $"Found {totalCount} file(s) matching '{r.SearchText}' (showing {fileItems.Count} results)" 
                    : $"No files found matching '{r.SearchText}'"
            };
            Send();
            return Task.CompletedTask;
        }

        private static List<string> ParseSearchTerms(string searchText)
        {
            var quotedMatches = Regex
                .Matches(searchText, @"(\+?""([^""]+)"")|(\+?\S+)")
                .Cast<Match>()
                .Select(m => m.Groups[2].Success ? (m.Groups[1].Value.StartsWith("+") ? "+" : "") + m.Groups[2].Value : m.Groups[0].Value)
                .Where(m => !string.IsNullOrEmpty(m))
                .ToList();

            searchText = searchText.Replace("\"", "");
            searchText = searchText.Replace("+", "");

            foreach (var quotedMatch in quotedMatches)
            {
                var noPlusQuotedMatch = string.IsNullOrWhiteSpace(quotedMatch)
                    ? string.Empty
                    : quotedMatch.Replace("+", "");

                searchText = string.IsNullOrWhiteSpace(searchText)
                    ? string.Empty
                    : searchText.Replace($"{noPlusQuotedMatch}", "");
            }

            var searchTerms = searchText.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries).ToList();
            var stopSearchWords = new List<string> 
            { 
                "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", 
                "if", "in", "is", "it", "no", "not", "of", "on", "or", "that", 
                "the", "to", "was", "with" 
            };
            searchTerms.RemoveAll(term => stopSearchWords.Contains(term.ToLower()));

            searchTerms.AddRange(quotedMatches);

            searchTerms = searchTerms.Select(term => term.TrimStart('+')).ToList();

            return searchTerms;
        }

        private static double CalculateScore(LaunchableItem file, List<string> searchTerms, SearchWeights weights)
        {
            return searchTerms.Sum(term =>
                (file.Title.Contains(term, StringComparison.OrdinalIgnoreCase) ? weights.Title : 0) +
                (file.Name.Contains(term, StringComparison.OrdinalIgnoreCase) ? weights.FileName : 0) +
                (file.Creator.Contains(term, StringComparison.OrdinalIgnoreCase) ? weights.Creator : 0) +
                (file.Path.Value.Contains(term, StringComparison.OrdinalIgnoreCase) ? weights.FilePath : 0) +
                (file.Description.Contains(term, StringComparison.OrdinalIgnoreCase) ? weights.Description : 0));
        }
    }
}
