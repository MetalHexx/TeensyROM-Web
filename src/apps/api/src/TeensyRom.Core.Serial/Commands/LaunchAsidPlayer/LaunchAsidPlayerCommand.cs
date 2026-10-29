using TeensyRom.Core.Abstractions;

namespace TeensyRom.Core.Serial.Commands.LaunchAsidPlayer
{
    /// <summary>
    /// Deliberately not a <c>LaunchFileCommand</c>: the gate resets a device it believes busy (a cart running) before
    /// the handler runs, as it does for any non-launch command.
    /// </summary>
    public class LaunchAsidPlayerCommand : ITeensyCommand<LaunchAsidPlayerResult>
    {
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
    }
}
