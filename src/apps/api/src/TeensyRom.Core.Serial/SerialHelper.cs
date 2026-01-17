using System.IO.Ports;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;

namespace TeensyRom.Core.Serial
{
    public static class SerialHelper
    {
        public static TeensyToken HandleAck(this ICommunicationPort serialState)
        {
            serialState.WaitForSerialData(numBytes: 2, timeoutMs: 20000);

            byte[] recBuf = new byte[2];
            serialState.Read(recBuf, 0, 2);
            ushort recU16 = BitConverter.ToUInt16(recBuf, 0);

            var response = recU16 switch
            {
              var _ when recU16 == TeensyToken.Ack.Value => TeensyToken.Ack,
              var _ when recU16 == TeensyToken.Fail.Value => TeensyToken.Fail,
              var _ when recU16 == TeensyToken.RetryLaunch.Value => TeensyToken.RetryLaunch,
              _ => TeensyToken.Unnknown,
            };


            if (response == TeensyToken.Ack) return TeensyToken.Ack;
            if (response == TeensyToken.RetryLaunch) return TeensyToken.RetryLaunch;

            var rawResponse = serialState.ReadAndLogSerialAsString();

            if (rawResponse.Contains("Busy!"))
            {
                throw new TeensyBusyException($"TeensyROM is currently busy.  If you have a program runnning, stop it first. Try caching your files.");
            }
            var responseString = response switch
            {
                var token when token == TeensyToken.Fail => "Fail Token",
                _ => "Unknown",
            };
            if (rawResponse.Length == 0) rawResponse = "No Data";

            throw new TeensyException($"Received unexpected response from TR ({responseString}) with data: {rawResponse}");
        }

        public static List<string> GetComPorts() => SerialPort.GetPortNames().Distinct().ToList();
    }
}
