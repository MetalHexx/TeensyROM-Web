namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// TCP/Ethernet connection settings
  /// </summary>
  public record TcpConnectionSettings
  {
    public string HostAddress { get; set; } = string.Empty;
    public int Port { get; set; } = 5001;
    public int ConnectionTimeoutMs { get; set; } = 5000;
    public int ReadTimeoutMs { get; set; } = 1000;
    public int WriteTimeoutMs { get; set; } = 1000;
  }
}
