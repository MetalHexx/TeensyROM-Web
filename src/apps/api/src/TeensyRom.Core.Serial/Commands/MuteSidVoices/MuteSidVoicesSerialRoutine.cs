using TeensyRom.Core.Serial;
using TeensyRom.Core.Common;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Core.Commands.MuteSidVoices
{
    public interface IMuteSidVoicesSerialRoutine
    {
        Task Execute(ISerialStateContext serial, VoiceState voice1Enabled, VoiceState voice2Enabled, VoiceState voice3Enabled);
    }

    public class MuteSidVoicesSerialRoutine : IMuteSidVoicesSerialRoutine
    {
        public async Task Execute(ISerialStateContext serial, VoiceState voice1Enabled, VoiceState voice2Enabled, VoiceState voice3Enabled)
        {
            var voiceMuteInfo = (byte)
            (
                (voice1Enabled is VoiceState.Enabled ? 0 : 1) << 0 |
                (voice2Enabled is VoiceState.Enabled ? 0 : 1) << 1 |
                (voice3Enabled is VoiceState.Enabled ? 0 : 1) << 2
            );

            var attemptNumber = 1;

            while (attemptNumber <= 3)
            {
                try
                {
                    serial.SendIntBytes(TeensyToken.SIDVoiceMuting, 2);
                    serial.SendSignedChar((sbyte)voiceMuteInfo);
                    var ack = serial.HandleAck();
                    break;
                }
                catch (TeensyException)
                {
                    await Task.Delay(attemptNumber * 100);

                    if (attemptNumber == 3)
                    {
                        throw new TeensyDjException();
                    }
                    attemptNumber++;
                    continue;
                }
            }
        }
    }
}
