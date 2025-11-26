using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Abstractions
{
  /// <summary>
  /// Provides access to video-related settings
  /// </summary>
  public interface IVideoSettingsProvider
  {
    IObservable<VideoSettings> VideoSettings { get; }
    VideoSettings GetVideoSettings();
  }
}
