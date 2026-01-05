using TeensyRom.Core.Abstractions;

namespace TeensyRom.Core.Serial.Commands.Composite.FastForward
{
    public class FastForwardCommand : ITeensyCommand<FastForwardResult>
    {
        public required bool ShouldTogglePlay { get; init; }
        public required bool ShouldMuteVoices { get; init; }
        public required double Speed { get; init; }
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
    }
}
