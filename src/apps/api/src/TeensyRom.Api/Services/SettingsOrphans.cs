using TeensyRom.Core.Common;

namespace TeensyRom.Api.Services
{
    /// <summary>
    /// Finds Settings.json device entries that no connection record backs.
    /// </summary>
    public static class SettingsOrphans
    {
        /// <summary>
        /// The chip IDs a start knows about, excluding the per-run "Unknown"/"Unknown-N" stand-ins,
        /// which never identify a real unit.
        /// </summary>
        public static IReadOnlySet<string> KnownIds(IEnumerable<string> connectionIds) =>
            connectionIds.Where(id => !StandInDeviceId.IsStandIn(id)).ToHashSet();

        /// <summary>
        /// The settings IDs missing from <paramref name="knownIds"/>. An empty known set yields none:
        /// without connection records there is nothing to compare against, and settings must never be wiped.
        /// </summary>
        public static IReadOnlyList<string> Find(IEnumerable<string> settingsIds, IReadOnlySet<string> knownIds) =>
            knownIds.Count == 0
                ? []
                : settingsIds.Where(id => !knownIds.Contains(id)).ToList();
    }
}
