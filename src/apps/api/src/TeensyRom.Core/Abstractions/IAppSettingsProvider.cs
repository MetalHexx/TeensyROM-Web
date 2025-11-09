using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Abstractions
{
  /// <summary>
  /// Provides access to app-level settings
  /// </summary>
  public interface IAppSettingsProvider
  {
    IObservable<AppSettings> AppSettings { get; }
    AppSettings GetAppSettings();
  }
}
