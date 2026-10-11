using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Core.Abstractions
{
    public record DeviceStateChange(string DeviceId);

    /// <summary>
    /// Owns the discovery occasions - API start, full discovery, records-only listing, and the explicit
    /// Reconnect/Forget pair - the devices they confirm, and each known unit's saved name. A unit the manager has ever known this
    /// session, reachable or not, stays in its knowledge: an unreachable or file-only unit's record is
    /// the manager's private state, kept internally so a later occasion can find or restore it, and is
    /// never surfaced through <see cref="GetAvailableDevices"/> or <see cref="GetAvailableDevice"/> -
    /// only <see cref="GetOfflineDevices"/> lists it.
    /// </summary>
    public interface IDeviceConnectionManager
    {
        /// <summary>
        /// API start: every saved row is tried at its saved addresses, preferred transport first; a miss
        /// is never a throw. An online-last-time row that misses runs one search for the units still
        /// missing; an offline-last-time miss does not. No cache, or an empty one, runs a full discovery.
        /// Every row still missing afterwards is kept, flagged offline; the cache is saved whole either way.
        /// </summary>
        Task<List<TeensyRomDevice>> ConnectAtStartAsync(CancellationToken ct);

        /// <summary>
        /// fullScan = true -&gt; full discovery with resets (Discover Devices): merges against every known
        /// unit and saves even when it finds nothing. fullScan = false -&gt; the listed records, no device
        /// contact (page load / refresh).
        /// </summary>
        Task<List<TeensyRomDevice>> FindDevices(bool autoConnect, CancellationToken ct, bool fullScan = false);

        /// <summary>Listed = record reachable (FullIdle | FullBusy | Minimal). Unchanged semantics.</summary>
        List<TeensyRomDevice> GetAvailableDevices();

        /// <summary>A listed device, else null - unchanged semantics; an unreachable record is not returned.</summary>
        TeensyRomDevice? GetAvailableDevice(string deviceId);

        /// <summary>
        /// Every known unit that is not available: unreachable in memory, or known only from the saved
        /// file. Excludes stand-in chip ids, which can never be reconnected.
        /// </summary>
        IReadOnlyList<OfflineDevice> GetOfflineDevices();

        /// <summary>
        /// Already available -&gt; <see cref="ReconnectResult.AlreadyAvailable"/>, checked after any running
        /// occasion ends, with no device contact. Unknown chip -&gt; <see cref="ReconnectResult.UnknownDevice"/>.
        /// Otherwise tries the unit's saved endpoints, preferred transport first, through the same miss
        /// handling as start; a hit is <see cref="ReconnectResult.Reconnected"/>. A miss runs one search
        /// for missing units and reports <see cref="ReconnectResult.Reconnected"/> or
        /// <see cref="ReconnectResult.NotFound"/> depending on whether that search found it. Never joins
        /// another Reconnect or a Discover Devices; always runs its own attempt.
        /// </summary>
        Task<ReconnectOutcome> ReconnectAsync(string deviceId, CancellationToken ct);

        /// <summary>
        /// Removes a known, unreachable unit from memory and the saved file - <see cref="ForgetResult.Forgotten"/>.
        /// An available unit is left untouched (<see cref="ForgetResult.StillAvailable"/>); an unknown
        /// chip is <see cref="ForgetResult.UnknownDevice"/>. Runs exclusively of every other occasion, so
        /// nothing can save between the availability check and the removal.
        /// </summary>
        Task<ForgetResult> ForgetAsync(string deviceId, CancellationToken ct);

        /// <summary>
        /// Sets a known unit's name, reachable or not; no device contact. A name failing
        /// <see cref="TeensyRom.Core.Common.DeviceNameRules"/> is <see cref="RenameResult.InvalidName"/>;
        /// an unknown chip or a stand-in is <see cref="RenameResult.UnknownDevice"/>. Does not wait behind
        /// a running discovery occasion.
        /// </summary>
        Task<RenameOutcome> RenameAsync(string deviceId, string name, CancellationToken ct);
    }
}
