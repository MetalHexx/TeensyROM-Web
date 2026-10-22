namespace TeensyRom.Core.Serial.Commands
{
    /// <summary>A command that only reads from the unit, so sending it twice changes nothing on the
    /// device: the gate may re-send it once after recovering a lost link.</summary>
    public interface IReadCommand { }
}
