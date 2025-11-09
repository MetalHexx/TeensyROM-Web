using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Abstractions
{
  /// <summary>
  /// Provides access to search-related settings
  /// </summary>
  public interface ISearchSettingsProvider
  {
    IObservable<SearchSettings> SearchSettings { get; }
    SearchSettings GetSearchSettings();
  }
}
