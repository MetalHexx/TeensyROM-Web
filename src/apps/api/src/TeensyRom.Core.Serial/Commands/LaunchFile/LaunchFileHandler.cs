using MediatR;
using System.Reactive.Linq;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial.Commands.LaunchFile
{
	public class LaunchFileHandler(ILoggingService log) : IRequestHandler<LaunchFileCommand, LaunchFileResult>
	{
		public async Task<LaunchFileResult> Handle(LaunchFileCommand r, CancellationToken cancellationToken)
		{
			var result = TryLaunchCommand(r);

			if (r.LaunchItem.Size >= 575000)
			{
				var isMinimalFwReady = r.CommunicationPort.ConnectToMinimalFw(log);
				if (!isMinimalFwReady)
				{
					return new()
					{
						IsSuccess = false,
						Error = "Failed to connect to minimal FW.",
						LaunchResult = LaunchFileResultType.Error
					};
				}
				log.Internal($"LaunchFileHandler: Reconnecting to TR after large file launch.");
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
			return GetFinalResult(PollResponse(r));
		}

		public bool ExecuteMinimalCheck(ICommunicationPort communicationPort)
		{
			log.Internal("FW Check Command");
			communicationPort.SendIntBytes(TeensyToken.FwCheckToken, 2);
			communicationPort.WaitForSerialData(numBytes: 2, timeoutMs: 20000);
			byte[] recBuf = new byte[2];
			communicationPort.Read(recBuf, 0, 2);
			ushort result = BitConverter.ToUInt16(recBuf, 0);
			string firmware = result switch
			{
				var _ when result == TeensyToken.FWFullToken.Value => "Full FW",
				var _ when result == TeensyToken.FWMinimalToken.Value => "Minimal FW",
				_ => "Unknown FW"
			};
			log.External($"Response: {result} ({firmware})");
			return result == TeensyToken.FWMinimalToken.Value;
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
		private static LaunchFileResult GetFinalResult(LaunchFileResultType resultType)
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
