using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Serial.Commands;

namespace TeensyRom.Core.Commands.MuteSidVoices
{
    public class MuteSidVoicesCommand : ITeensyCommand<MuteSidVoicesResult>
    {
        public required VoiceState Voice1Enabled { get; init; }
        public required VoiceState Voice2Enabled { get; init; }
        public required VoiceState Voice3Enabled { get; init; }
        public string? DeviceId { get; set; }
        public ISerialStateContext Serial { get; set; } = null!;
    }
}
