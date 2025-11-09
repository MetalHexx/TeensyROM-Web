using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Abstractions
{
  /// <summary>
  /// Provides access to player-related settings
  /// </summary>
  public interface IPlayerSettingsProvider
  {
    IObservable<PlayerSettings> PlayerSettings { get; }
    PlayerSettings GetPlayerSettings();
  }
}
