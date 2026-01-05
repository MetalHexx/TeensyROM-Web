using TeensyRom.Core.Abstractions;

namespace TeensyRom.Core.Serial.Commands.ToggleMusic
{
    public class ToggleMusicCommand : ITeensyCommand<ToggleMusicResult>
    {
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
    }
}
