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
        IFileTransferSettingsProvider,
        ISearchSettingsProvider,
        IAppSettingsProvider
    {
        IObservable<TeensySettings> Settings { get; }
        bool SaveSettings(TeensySettings settings);
        TeensySettings GetSettings();
    }
}
