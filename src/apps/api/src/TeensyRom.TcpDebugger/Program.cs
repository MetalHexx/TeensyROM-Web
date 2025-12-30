using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.State;
using TeensyRom.Core.Common;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.TcpDebugger;

class Program
{
    static async Task Main(string[] args)
    {
        Console.WriteLine("=== TeensyROM TCP Debugger ===");
        Console.WriteLine();

        string endpoint = args.Length > 0 ? args[0] : "192.168.1.37:80";
        Console.WriteLine($"Connecting to: {endpoint}");
        Console.WriteLine();

        TcpObservablePort? tcpPort = null;
        SerialStateContext? transport = null;

        try
        {
            tcpPort = new TcpObservablePort(new SimpleLoggingService());
            transport = new SerialStateContext(tcpPort, new SimpleLoggingService());
            tcpPort.SetPort(endpoint);
            Console.WriteLine();

            LogHeader("Opening TCP connection...");
            tcpPort.OpenPort();
            LogSuccess($"Connection opened to {endpoint}");
            Console.WriteLine();

            transport.TransitionTo(typeof(SerialBusyState));

            // Version Check (works)
            LogHeader("Ping #1 (Version Check)");
            LogDetail("SendIntBytes(TeensyToken.Ping, 2)");
            transport.SendIntBytes(TeensyToken.Ping, 2);
            var versionResponse = transport.ReadAndLogSerialAsString(200);
            LogSuccess($"Response: '{versionResponse?.Trim()}'");
            Console.WriteLine();

            // Ping Command #2 (with reconnect)
            LogHeader("Ping #2 with reconnect");
            ReconnectForNextCommand(transport);
            LogDetail("SendIntBytes(TeensyToken.Ping, 2)");
            transport.SendIntBytes(TeensyToken.Ping, 2);
            var pingResponse = transport.ReadAndLogSerialAsString(500);
            LogSuccess($"Response: '{pingResponse?.Trim()}'");
            Console.WriteLine();

            // Ping Command #3 (with reconnect)
            LogHeader("Ping #3 (CartTagger) with reconnect");
            ReconnectForNextCommand(transport);
            LogDetail("SendIntBytes(TeensyToken.Ping, 2)");
            transport.SendIntBytes(TeensyToken.Ping, 2);
            var ping3Response = transport.ReadAndLogSerialAsString(500);
            LogSuccess($"Response: '{ping3Response?.Trim()}'");
            Console.WriteLine();

            // Get File Command
            LogHeader("GetFile Command (/cart-tag.txt) with reconnect");
            ReconnectForNextCommand(transport);

            LogDetail("ClearBuffers()");
            transport.ClearBuffers();

            LogDetail("SendIntBytes(TeensyToken.GetFile, 2)");
            transport.SendIntBytes(TeensyToken.GetFile, 2);

            LogDetail("HandleAck (after GetFile token)...");
            HandleAck(transport);

            LogDetail("SendIntBytes(SD storage token, 1)");
            transport.SendIntBytes(TeensyStorageType.SD.GetStorageToken(), 1);

            LogDetail("Write(path + null terminator)");
            var path = "/cart-tag.txt";
            transport.Write(path + "\0");

            LogDetail("HandleAck (after path)...");
            try
            {
                HandleAck(transport);
            }
            catch (TeensyException ex)
            {
                LogError($"File not found: {ex.Message}");
                LogSuccess("=== Test complete (file not found) ===");
                return;
            }

            LogDetail("ReadIntBytes(4) for file length");
            var fileLength = transport.ReadIntBytes(4);
            LogSuccess($"File length: {fileLength} bytes");

            LogDetail("ReadIntBytes(4) for checksum");
            var checksum = transport.ReadIntBytes(4);
            LogSuccess($"Checksum: {checksum}");

            LogDetail("Reading file bytes...");
            var buffer = new byte[fileLength];
            int bytesRead = 0;
            while (bytesRead < fileLength)
            {
                bytesRead += transport.Read(buffer, bytesRead, (int)fileLength - bytesRead);
            }
            LogSuccess($"Read {bytesRead} bytes");

            LogDetail("HandleAck (final)...");
            HandleAck(transport);

            LogDetail("Verifying checksum...");
            var receivedChecksum = buffer.CalculateChecksum();
            LogSuccess($"Received checksum: {receivedChecksum}");

            if (receivedChecksum != checksum)
            {
                LogError("Checksum Mismatch!");
            }
            else
            {
                LogSuccess("Checksum verified!");
            }

            var fileContent = System.Text.Encoding.UTF8.GetString(buffer);
            Console.WriteLine();
            LogSuccess("=== File Content (JSON) ===");
            Console.WriteLine(fileContent);
            Console.WriteLine("=== End File Content ===");
            Console.WriteLine();

            LogSuccess("=== All steps completed successfully ===");
        }
        catch (Exception ex)
        {
            Console.WriteLine();
            LogError($"ERROR: {ex.GetType().Name} - {ex.Message}");
            Console.WriteLine();
            Console.WriteLine("Stack Trace:");
            Console.WriteLine(ex.StackTrace);
            if (ex.InnerException != null)
            {
                Console.WriteLine();
                Console.WriteLine("Inner Exception:");
                Console.WriteLine($"{ex.InnerException.GetType().Name}: {ex.InnerException.Message}");
                Console.WriteLine(ex.InnerException.StackTrace);
            }
        }
        finally
        {
            Console.WriteLine();
            Log("Cleaning up...");
            transport?.Dispose();
            tcpPort?.Dispose();
            Console.WriteLine();
            Console.WriteLine("Press any key to exit...");
            Console.ReadKey();
        }
    }

    static void ReconnectForNextCommand(SerialStateContext transport)
    {
        LogDetail("→ Reconnecting for next command...");
        transport.TransitionTo(typeof(SerialConnectedState));
        transport.ClosePort();

        transport.OpenPort();
        transport.TransitionTo(typeof(SerialBusyState));
        LogSuccess("→ Ready");
    }

    static void HandleAck(SerialStateContext transport)
    {
        transport.WaitForSerialData(numBytes: 2, timeoutMs: 5000);
        byte[] recBuf = new byte[2];
        transport.Read(recBuf, 0, 2);
        ushort recU16 = BitConverter.ToUInt16(recBuf, 0);

        LogDetail($"← Raw bytes: [{recBuf[0]} (0x{recBuf[0]:X2}), {recBuf[1]} (0x{recBuf[1]:X2})]");
        LogDetail($"← Parsed UInt16: {recU16} (0x{recU16:X4})");
        LogDetail($"← Expected ACK: {TeensyToken.Ack.Value} (0x{TeensyToken.Ack.Value:X4})");

        var ackToken = recU16 switch
        {
            var _ when recU16 == TeensyToken.Ack.Value => TeensyToken.Ack,
            var _ when recU16 == TeensyToken.Fail.Value => TeensyToken.Fail,
            var _ when recU16 == TeensyToken.RetryLaunch.Value => TeensyToken.RetryLaunch,
            _ => TeensyToken.Unnknown,
        };

        if (ackToken == TeensyToken.Ack)
        {
            LogDetail($"← ACK (bytes: [{recBuf[0]}, {recBuf[1]}])");
            return;
        }

        if (ackToken == TeensyToken.Fail)
        {
            var rawResponse = transport.ReadAndLogSerialAsString(100);
            throw new TeensyException($"Received FAIL token with data: {rawResponse}");
        }

        if (ackToken == TeensyToken.RetryLaunch)
        {
            LogDetail("← Retry Launch ACK");
            return;
        }

        var response = transport.ReadAndLogSerialAsString(100);
        throw new TeensyException($"Received unexpected ACK: {recU16} with data: {response}");
    }

    static void LogHeader(string message)
    {
        var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine($"[{timestamp}] {message}");
        Console.ResetColor();
    }

    static void LogDetail(string message)
    {
        var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine($"[{timestamp}]   {message}");
        Console.ResetColor();
    }

    static void Log(string message)
    {
        var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
        Console.WriteLine($"[{timestamp}] {message}");
    }

    static void LogSuccess(string message)
    {
        var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine($"[{timestamp}] {message}");
        Console.ResetColor();
    }

    static void LogError(string message)
    {
        var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine($"[{timestamp}] {message}");
        Console.ResetColor();
    }

    static void LogWarning(string message)
    {
        var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine($"[{timestamp}] {message}");
        Console.ResetColor();
    }

    class SimpleLoggingService : TeensyRom.Core.Logging.ILoggingService
    {
        public void External(string message, string? deviceId = null) => Log(message);
        public void ExternalError(string message, string? deviceId = null) => LogError(message);
        public void ExternalSuccess(string message, string? deviceId = null) => LogSuccess(message);
        public void ExternalWarning(string message, string? deviceId = null) => LogWarning(message);
        public void Internal(string message, string? deviceId = null) => Log(message);
        public void InternalError(string message, string? deviceId = null) => LogError(message);
        public void InternalSuccess(string message, string? deviceId = null) => LogSuccess(message);
        public void InternalWarning(string message, string? deviceId = null) => LogWarning(message);

        System.IObservable<string> TeensyRom.Core.Logging.ILoggingService.Logs => throw new System.NotImplementedException();
    }
}
