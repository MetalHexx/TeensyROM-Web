namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// File transfer preferences
  /// </summary>
  public record FileTransferSettings
  {
    public bool AutoLaunchOnCopyEnabled { get; set; } = true;
  }
}
