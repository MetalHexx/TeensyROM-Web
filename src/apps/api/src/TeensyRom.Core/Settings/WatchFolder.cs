using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// A folder on the engine's machine whose new files are sent to one or more device destinations.
  /// Treated as immutable: every change builds a new instance and new lists.
  /// </summary>
  public sealed record WatchFolder
  {
    /// <summary>Engine-assigned Guid in "N" format.</summary>
    public string Id { get; init; } = string.Empty;

    /// <summary>Normalized absolute path on the engine's machine.</summary>
    public string Path { get; init; } = string.Empty;
    public bool Enabled { get; init; } = true;
    public List<WatchFolderDestination> Destinations { get; init; } = [];
  }

  /// <summary>
  /// Where a watch folder's files go: one storage of one device, under a directory.
  /// </summary>
  public sealed record WatchFolderDestination
  {
    /// <summary>Engine-assigned Guid in "N" format.</summary>
    public string Id { get; init; } = string.Empty;

    /// <summary>The device's chip id.</summary>
    public string DeviceId { get; init; } = string.Empty;
    public TeensyStorageType StorageType { get; init; }

    /// <summary>Unix-style directory on the device storage, as <c>DirectoryPath.Value</c>.</summary>
    public string Path { get; init; } = "/auto-transfer/";
    public bool Launch { get; init; }
  }
}
