namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// Video capture and display preferences
  /// </summary>
  public record VideoSettings
  {
    /// <summary>
    /// Enable video capture component visibility in player view
    /// </summary>
    public bool EnableVideo { get; set; } = false;

    /// <summary>
    /// Gets or sets the identifier of the video device.
    /// </summary>
    public string VideoDeviceId { get; set; } = string.Empty;
  }
}
