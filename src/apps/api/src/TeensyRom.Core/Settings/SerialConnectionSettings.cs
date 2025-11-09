namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// Serial port specific connection settings
  /// </summary>
  public record SerialConnectionSettings
  {
    public string Port { get; set; } = string.Empty;
    public int BaudRate { get; set; } = 115200;
  }
}
