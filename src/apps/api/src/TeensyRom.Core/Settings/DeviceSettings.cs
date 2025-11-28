namespace TeensyRom.Core.Settings
{
  public record DeviceSettings
  {
    public string DeviceId { get; set; } = string.Empty;
    public VideoSettings VideoSettings { get; set; } = new();
    public ConnectionSettings ConnectionSettings { get; set; } = new();
  }
}
