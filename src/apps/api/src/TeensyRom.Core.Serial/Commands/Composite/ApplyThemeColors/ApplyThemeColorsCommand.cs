using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Themes;

namespace TeensyRom.Core.Serial.Commands.Composite.ApplyThemeColors
{
    public class ApplyThemeColorsCommand : ITeensyCommand<ApplyThemeColorsResult>
    {
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
        public required DeviceThemePart Colors { get; init; }
    }
}
