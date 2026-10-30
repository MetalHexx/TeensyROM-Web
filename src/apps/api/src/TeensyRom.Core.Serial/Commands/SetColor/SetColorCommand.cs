using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Themes;

namespace TeensyRom.Core.Serial.Commands.SetColor
{
    public class SetColorCommand : ITeensyCommand<SetColorResult>
    {
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
        public required ColorSlot Slot { get; init; }
        public required int Color { get; init; }
    }
}
