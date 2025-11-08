using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Serial;

namespace TeensyRom.Core.Commands.PlaySubtune
{
    public interface IPlaySubtuneSerialRoutine
    {
        void Execute(ISerialStateContext serial, uint subtuneIndex);
    }

    public class PlaySubtuneSerialRoutine : IPlaySubtuneSerialRoutine
    {
        public void Execute(ISerialStateContext serial, uint subtuneIndex)
        {
            subtuneIndex = subtuneIndex > 0
                ? subtuneIndex - 1
                : 0;

            serial.ClearBuffers();
            serial.SendIntBytes(TeensyToken.PlaySubtune, 2);
            serial.SendIntBytes(subtuneIndex, 1);
            serial.HandleAck();
        }
    }
}
