using TeensyRom.Core.Settings;
using TeensyRom.Core.Storage;

namespace TeensyRom.Api.Endpoints.Files.LiftBan
{
    public class LiftBanEndpoint(ISettingsService settingsService) : RadEndpoint<LiftBanRequest, LiftBanResponse>
    {
        public override void Configure()
        {
            Post("/api/bans/lift")
                .Produces<LiftBanResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status502BadGateway)
                .WithName("LiftBan")
                .WithSummary("Lift Ban")
                .WithDescription("Removes one entry from the banned files or banned folders list. Bans are engine-wide, so no device is needed. Lifting an entry that is not banned changes nothing.")
                .WithTags("Files");
        }

        public override Task Handle(LiftBanRequest r, CancellationToken ct)
        {
            var isFile = r.Kind is BanKind.File;
            var entry = isFile ? LastSegment(r.Entry) : r.Entry.Trim();

            if (entry.Length == 0)
            {
                SendValidationError("Entry is required.");
                return Task.CompletedTask;
            }

            var lifted = false;
            var saved = settingsService.UpdateSettings(latest =>
            {
                var search = latest.SearchSettings;

                if (isFile)
                {
                    var kept = search.BannedFiles.Where(e => !BanMatcher.IsBannedFile(entry, [e])).ToList();
                    if (kept.Count == search.BannedFiles.Count) return latest;

                    lifted = true;
                    return latest with { SearchSettings = search with { BannedFiles = [.. kept] } };
                }

                var target = entry.TrimEnd('/');
                if (target.Length == 0) return latest;

                var keptDirectories = search.BannedDirectories
                    .Where(e => !string.Equals(e.TrimEnd('/'), target, StringComparison.OrdinalIgnoreCase))
                    .ToList();
                if (keptDirectories.Count == search.BannedDirectories.Count) return latest;

                lifted = true;
                return latest with { SearchSettings = search with { BannedDirectories = [.. keptDirectories] } };
            });

            if (!saved)
            {
                SendExternalError("Failed to save settings to disk. Please check file permissions and try again.");
                return Task.CompletedTask;
            }

            Response = new()
            {
                Message = lifted ? $"{entry} was unbanned." : $"{entry} is not banned.",
                Entry = entry,
                Kind = r.Kind,
                Lifted = lifted
            };
            Send();
            return Task.CompletedTask;
        }

        private static string LastSegment(string path) =>
            path.Split('/', StringSplitOptions.RemoveEmptyEntries).LastOrDefault()?.Trim() ?? string.Empty;
    }
}
