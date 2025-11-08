using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Serial.Commands;

namespace TeensyRom.Core.Serial.Commands.ToggleMusic
{
    public class ToggleMusicCommand : ITeensyCommand<ToggleMusicResult>
    {
        public string? DeviceId { get; set; }
        public required ISerialStateContext Serial { get; init; }
    }
}
