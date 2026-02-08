namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// Tracks when full indexing operations were completed for device storage.
  /// Null timestamps indicate storage has never been fully indexed.
  /// </summary>
  public record IndexingStatus
  {
    /// <summary>
    /// UTC timestamp when SD storage was last fully indexed.
    /// Null indicates SD storage has never been fully indexed.
    /// </summary>
    public DateTime? SdLastIndexed { get; init; }
    
    /// <summary>
    /// UTC timestamp when USB storage was last fully indexed.
    /// Null indicates USB storage has never been fully indexed.
    /// </summary>
    public DateTime? UsbLastIndexed { get; init; }
  }

  public record DeviceSettings
  {
    public string DeviceId { get; set; } = string.Empty;
    public VideoSettings VideoSettings { get; set; } = new();
    
    /// <summary>
    /// Tracks full indexing completion timestamps per storage type.
    /// Used to determine if storage requires indexing.
    /// </summary>
    public IndexingStatus IndexingStatus { get; init; } = new();
  }
}
