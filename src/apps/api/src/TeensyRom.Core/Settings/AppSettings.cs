namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// Application lifecycle and initial setup state
  /// </summary>
  public record AppSettings
  {
    public bool FirstTimeSetup { get; set; } = true;
  }
}
