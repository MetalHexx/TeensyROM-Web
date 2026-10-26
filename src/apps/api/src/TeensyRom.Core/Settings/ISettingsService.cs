using TeensyRom.Core.Abstractions;

namespace TeensyRom.Core.Settings
{
    /// <summary>
    /// Full settings service for CRUD operations and complete access.
    /// For domain-specific access, use the individual provider interfaces.
    /// </summary>
    public interface ISettingsService :
        IDeviceSettingsProvider,
        IPlayerSettingsProvider,
        ISearchSettingsProvider,
        IAppSettingsProvider
    {
        IObservable<TeensySettings> Settings { get; }
        bool SaveSettings(TeensySettings settings);
        TeensySettings GetSettings();

        /// <summary>
        /// Applies <paramref name="update"/> to the latest settings and saves the result as one step, so writers that
        /// overlap never save over each other's changes.
        /// </summary>
        /// <param name="update">
        /// Receives the latest settings and returns the settings to save. Returning its argument unchanged saves nothing.
        /// It runs under the settings lock, so keep it quick, synchronous and free of calls back into this service.
        /// </param>
        /// <returns>False when saving the result failed; true otherwise, including when there was nothing to save.</returns>
        bool UpdateSettings(Func<TeensySettings, TeensySettings> update);
    }
}
