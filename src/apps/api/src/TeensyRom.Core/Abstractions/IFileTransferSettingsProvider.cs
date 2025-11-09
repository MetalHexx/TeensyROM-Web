using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Abstractions
{
  /// <summary>
  /// Provides access to file transfer-related settings
  /// </summary>
  public interface IFileTransferSettingsProvider
  {
    IObservable<FileTransferSettings> FileTransferSettings { get; }
    FileTransferSettings GetFileTransferSettings();
  }
}
