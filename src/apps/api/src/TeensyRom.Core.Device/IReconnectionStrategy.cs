using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Core.Device;

public interface IReconnectionStrategy
{
    Task<bool> TryReconnect(TeensyRomDevice device, CancellationToken ct);
}
