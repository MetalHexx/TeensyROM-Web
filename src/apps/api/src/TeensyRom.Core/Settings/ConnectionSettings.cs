namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// Device connectivity preferences - supports both Serial and TCP/Ethernet connections
  /// </summary>
  public record ConnectionSettings
  {
    public ConnectionType ConnectionType { get; set; } = ConnectionType.Serial;    
    public bool AutoConnectEnabled { get; set; } = true;
    public SerialConnectionSettings Serial { get; set; } = new();
    public TcpConnectionSettings Tcp { get; set; } = new();
  }

  /// <summary>
  /// Connection type preference for device communication
  /// </summary>
  public enum ConnectionType
  {
    Serial = 0,
    Tcp = 1
  }
}
