using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// File transfer, synchronization, and directory watching preferences
  /// </summary>
  public record FileTransferSettings
  {
    public string WatchDirectoryLocation { get; set; } = string.Empty;
    public DirectoryPath AutoTransferPath { get; set; } = new DirectoryPath("auto-transfer");
    public bool AutoFileCopyEnabled { get; set; } = false;
    public bool AutoLaunchOnCopyEnabled { get; set; } = true;
    public bool NavToDirOnLaunch { get; set; } = true;
    public bool SyncFilesEnabled { get; set; } = false;

    public FileTransferSettings()
    {
      GetDefaultBrowserDownloadPath();
    }

    private void GetDefaultBrowserDownloadPath()
    {
      string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
      WatchDirectoryLocation = Path.Combine(userProfile, "Downloads");
    }
  }
}
