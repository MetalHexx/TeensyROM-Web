namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// Playback behavior and player-related preferences
  /// </summary>
  public record PlayerSettings
  {
    public bool RepeatModeOnStartup { get; set; } = false;
    public bool PlayTimerEnabled { get; set; } = false;
    public bool MuteFastForward { get; set; } = false;
    public bool MuteRandomSeek { get; set; } = false;
    public TeensyFilterType StartupFilter { get; set; } = TeensyFilterType.All;
    public bool StartupLaunchEnabled { get; set; } = true;
    public bool StartupLaunchRandom { get; set; } = false;
  }
}
