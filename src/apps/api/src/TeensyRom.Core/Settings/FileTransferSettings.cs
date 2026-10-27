namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// File transfer and synchronization preferences
  /// </summary>
  public record FileTransferSettings
  {
    public bool AutoLaunchOnCopyEnabled { get; set; } = true;
    public bool NavToDirOnLaunch { get; set; } = true;
    public bool SyncFilesEnabled { get; set; } = false;
  }
}
