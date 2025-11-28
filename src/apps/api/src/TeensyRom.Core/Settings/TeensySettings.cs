namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// Root settings container that groups related user preferences by domain.
  /// Used to persist and retrieve user preferences from disk. See: Settings.json in the bin folder
  /// </summary>
  public record TeensySettings
  {
    public PlayerSettings PlayerSettings { get; set; } = new();
    public FileTransferSettings FileTransferSettings { get; set; } = new();
    public SearchSettings SearchSettings { get; set; } = new();
    public AppSettings AppSettings { get; set; } = new();
    public List<DeviceSettings> KnownDevices { get; set; } = [];
  }
}
