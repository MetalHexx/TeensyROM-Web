using MediatR;
using System.Reactive.Linq;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;

namespace TeensyRom.Core.Commands.File.LaunchFile
{
  public class LaunchFileHandler(ILoggingService log, IAlertService alert, IDeviceConnectionManager deviceManager) : IRequestHandler<LaunchFileCommand, LaunchFileResult>
  {
    private const int _reconnectDelayMs = 4000;

    public async Task<LaunchFileResult> Handle(LaunchFileCommand request, CancellationToken cancellationToken)
    {
      var isMinimal = ExecuteMinimalCheck(request.CommunicationPort);
      
      if (isMinimal)
      {
        log.Internal("LaunchFileHandler: Detected minimal check command support. Resetting TR.");
        ExecuteReset((TcpObservablePort)request.CommunicationPort);
        await Task.Delay(200);
        log.Internal("LaunchFileHandler: Reconnecting to TeensyROM.  This will take a few seconds.");
        request.CommunicationPort.ClosePort();
        request.CommunicationPort.OpenPort();
      }

      var result = TryLaunchCommand(request);

      if (request.LaunchItem.Size >= 575000)
      {
        log.Internal($"LaunchFileHandler: Reconnecting to TR after large file launch.");
        request.CommunicationPort.ClosePort();

        //Note to future self:
        //If there are any bug reports of flaky minimal boot issues, try increasing this delay.
        await Task.Delay(500);
        request.CommunicationPort.OpenPort();
        
        isMinimal = ExecuteMinimalCheck(request.CommunicationPort);
        if (isMinimal)
        {
          log.Internal($"LaunchFileHandler: Successfully reconnected to minimal mode.");
        }
      }

      if (result.Value == TeensyToken.Fail)
      {
        return new()
        {
          IsSuccess = false,
          Error = "Failed to launch file - Received FAIL token",
          LaunchResult = LaunchFileResultType.Error
        };
      }
      return GetFinalResult(PollResponse(request));
    }

    public bool ExecuteMinimalCheck(ICommunicationPort communicationPort)
    {
      log.Internal("Minimal Check Command");
      communicationPort.SendIntBytes(TeensyToken.MinimalCheck, 2);
      communicationPort.WaitForSerialData(numBytes: 2, timeoutMs: 20000);
      byte[] recBuf = new byte[2];
      communicationPort.Read(recBuf, 0, 2);
      ushort result = BitConverter.ToUInt16(recBuf, 0);
      string firmware = result == 0 ? "TeensyROM" : "MinimalBoot";
      log.External($"Response: {result} ({firmware})");
      return result == 0 ? false : true;
    }

    private void ExecuteReset(ICommunicationPort communicationPort)
    {
      log.Internal("LaunchFileHandler: Resetting TeensyROM");
      communicationPort.SendIntBytes(TeensyToken.Reset, 2);
      var response = communicationPort.ReadAndLogSerialAsString();
      log.External($"TR Response: '{response?.Trim()}'");
    }



    private TeensyToken TryLaunchCommand(LaunchFileCommand command)
    {
      log.Internal($"LaunchFileHandler: Clearing serial buffers");
      command.CommunicationPort.ClearBuffers();

      log.Internal($"LaunchFileHandler: Sending {TeensyToken.LaunchFile} token.");
      command.CommunicationPort.SendIntBytes(TeensyToken.LaunchFile, 2);

      _ = command.CommunicationPort.HandleAck();

      log.Internal($"LaunchFileHandler: Sending storage token to TeensyROM");
      command.CommunicationPort.SendIntBytes(command.StorageType.GetStorageToken(), 1);

      log.Internal($"LaunchFileHandler: Sending {command.LaunchItem.Path} to TeensyROM");

      command.CommunicationPort.Write($"{command.LaunchItem.Path}\0");
      var result = command.CommunicationPort.HandleAck();

      return result;
    }

    private LaunchFileResultType PollResponse(LaunchFileCommand command)
    {
      try
      {
        var resultType = LaunchFileResultType.NoResponse;
        List<byte> bytesRead = [];

        for (int i = 0; i < 40; i++)
        {
          var responseBytes = command.CommunicationPort.ReadSerialBytes(25);
          bytesRead.AddRange(responseBytes);
          resultType = ParseResponse([.. bytesRead]);

          if (resultType != LaunchFileResultType.NoResponse)
          {
            return resultType;
          }
        }
        return LaunchFileResultType.Success;
      }
      catch (Exception ex)
      {
        if (ex.Message.Contains("port is closed", StringComparison.OrdinalIgnoreCase))
        {
          return LaunchFileResultType.Disconnected;
        }
        throw;
      }
    }

    private LaunchFileResultType ParseResponse(byte[] responseBytes)
    {
      var resultString = responseBytes.ToUtf8();
      var resultToCheck = resultString.Replace("Loading IO handler: TeensyROM", string.Empty);
      var foundTokens = responseBytes.FindTRTokens();

      if (foundTokens.Any(t => t == TeensyToken.GoodSIDToken))
      {
        var resultHex = $"GoodSIDToken: 0x{responseBytes.ToHexString()}";
        log.External(resultHex);
        return LaunchFileResultType.Success;
      }
      if (foundTokens.Any(t => t == TeensyToken.BadSIDToken))
      {
        var resultHex = $"BadSIDToken: 0x{responseBytes.ToHexString()}";
        log.External(resultHex);
        log.ExternalError($"LaunchFileHandler: Failed to launch sid: \r\n{resultString}");
        return LaunchFileResultType.SidError;
      }
      if (resultString.Contains("Loading IO handler:", StringComparison.OrdinalIgnoreCase))
      {
        log.External(resultString);
        return LaunchFileResultType.Success;
      }
      var programError = new[] { "Not enough room", "Unsupported HW Type" };

      if (programError.Any(error => resultString.Contains(error, StringComparison.OrdinalIgnoreCase)))
      {
        log.ExternalError($"LaunchFileHandler: Failed to launch program: \r\n{resultString}");
        return LaunchFileResultType.ProgramError;
      }
      return LaunchFileResultType.NoResponse;
    }
    private LaunchFileResult GetFinalResult(LaunchFileResultType resultType)
    {
      return resultType switch
      {
        LaunchFileResultType.Success => new() { LaunchResult = LaunchFileResultType.Success },
        LaunchFileResultType.SidError => new() { IsSuccess = false, LaunchResult = LaunchFileResultType.SidError },
        LaunchFileResultType.ProgramError => new() { IsSuccess = false, LaunchResult = LaunchFileResultType.ProgramError },
        LaunchFileResultType.NoResponse => new() { IsSuccess = false, LaunchResult = LaunchFileResultType.NoResponse },
        _ => new() { LaunchResult = LaunchFileResultType.Success },
      };
    }
  }
}
