using TeensyRom.Core.Abstractions;

namespace TeensyRom.Core.Serial.Commands.Composite.StartSeek
{
    public class StartSeekCommand : ITeensyCommand<StartSeekResult>
    {
        public required int SubtuneIndex { get; init; }
        public required bool ShouldTogglePlay { get; init; }
        public required bool ShouldMuteVoices { get; init; }
        public required double SeekSpeed { get; init; }
        public required SeekDirection Direction { get; init; }
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
    }
}
