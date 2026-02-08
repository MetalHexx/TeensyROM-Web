namespace TeensyRom.Core.Entities.Serial
{
  /// <summary>
  /// Defines the type of physical connection to the TeensyROM device.
  /// This is a low-level transport enumeration, not related to user settings.
  /// </summary>
  public enum ConnectionType
  {
    /// <summary>
    /// Serial/USB connection using COM ports
    /// </summary>
    Serial = 0,
    
    /// <summary>
    /// TCP/Ethernet network connection
    /// </summary>
    Tcp = 1
  }
}
