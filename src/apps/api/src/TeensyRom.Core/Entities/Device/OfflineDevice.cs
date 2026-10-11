using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Core.Entities.Device;

/// <summary>
/// A known unit that is not currently available: unreachable in memory, or known only from the saved
/// connection file. Never a stand-in chip id - those can never be reconnected.
/// </summary>
public sealed record OfflineDevice(
    string ChipId,
    string? SerialPortName,
    string? TcpEndpoint,
    ConnectionType LastTransport,
    string FwVersion,
    HardwareVariant HardwareVariant,
    bool IsCompatible);

/// <summary>The outcome of a <see cref="TeensyRom.Core.Abstractions.IDeviceConnectionManager.ReconnectAsync"/> attempt.</summary>
public enum ReconnectResult
{
    Reconnected,
    AlreadyAvailable,
    NotFound,
    UnknownDevice
}

/// <summary><see cref="Device"/> is set only when <see cref="Result"/> is <see cref="ReconnectResult.Reconnected"/> or <see cref="ReconnectResult.AlreadyAvailable"/>.</summary>
public sealed record ReconnectOutcome(ReconnectResult Result, TeensyRomDevice? Device);

/// <summary>The outcome of a <see cref="TeensyRom.Core.Abstractions.IDeviceConnectionManager.ForgetAsync"/> attempt.</summary>
public enum ForgetResult
{
    Forgotten,
    StillAvailable,
    UnknownDevice
}
