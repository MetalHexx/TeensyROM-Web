using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Abstractions
{
  /// <summary>
  /// Provides access to connection-related settings
  /// </summary>
  public interface IConnectionSettingsProvider
  {
    IObservable<ConnectionSettings> ConnectionSettings { get; }
    ConnectionSettings GetConnectionSettings();
  }
}
