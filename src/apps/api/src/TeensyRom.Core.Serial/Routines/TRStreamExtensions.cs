using System.Diagnostics;
using System.IO.Ports;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands.MuteSidVoices;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Music;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Serial.Routines
{
	public static class TRStreamExtensions
	{
		private const string _logClass = $"{nameof(TRStreamExtensions)}:";

		public static byte[] GetFile(this ICommunicationPort communicationPort, string filePath, TeensyStorageType storageType)
		{
			communicationPort.ClearBuffers();
			communicationPort.SendIntBytes(TeensyToken.GetFile, 2);
			communicationPort.HandleAck();
			communicationPort.SendIntBytes(storageType.GetStorageToken(), 1);
			communicationPort.Write($"{filePath}\0");

			try
			{
				communicationPort.HandleAck();
			}
			catch
			{
				return Array.Empty<byte>();
			}

			var fileLength = communicationPort.ReadIntBytes(4);
			var checksum = communicationPort.ReadIntBytes(4);
			var buffer = communicationPort.GetFileBytes(fileLength);
			communicationPort.HandleAck();

			var receivedChecksum = buffer.CalculateChecksum();

			if (receivedChecksum != checksum)
			{
				throw new TeensyException("Checksum Mismatch");
			}
			return buffer;
		}

		private static byte[] GetFileBytes(this ICommunicationPort communicationPort, uint fileLength)
		{
			if (!fileLength.TryParseInt(out int fileLengthInt))
			{
				throw new TeensyException("The file size attempting to be fetched is too large.");
			}

			var buffer = new byte[fileLength];
			int bytesRead = 0;

			while (bytesRead < fileLength)
			{
				bytesRead += communicationPort.Read(buffer, bytesRead, fileLengthInt - bytesRead);
			}

			return buffer;
		}

		public static async Task ToggleSidVoices(this ICommunicationPort communicationPort, VoiceState voice1Enabled, VoiceState voice2Enabled, VoiceState voice3Enabled)
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
					communicationPort.SendIntBytes(TeensyToken.SIDVoiceMuting, 2);
					communicationPort.SendSignedChar((sbyte)voiceMuteInfo);
					var ack = communicationPort.HandleAck();
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

		public static void PlaySubtune(this ICommunicationPort communicationPort, uint subtuneIndex)
		{
			subtuneIndex = subtuneIndex > 0
				? subtuneIndex - 1
				: 0;

			communicationPort.ClearBuffers();
			communicationPort.SendIntBytes(TeensyToken.PlaySubtune, 2);
			communicationPort.SendIntBytes(subtuneIndex, 1);
			communicationPort.HandleAck();
		}

		public static void ResetDevice(this ICommunicationPort communicationPort, ILoggingService log)
		{
			log.Internal($"{_logClass} Resetting TeensyROM");
			communicationPort.SendIntBytes(TeensyToken.Reset, 2);
			var response = communicationPort.ReadAndLogSerialAsString(200);
			Thread.Sleep(1000);
			log.External($"{_logClass} TR Response: '{response?.Trim()}'");
		}

		//public static bool ResetDevice(this ICommunicationPort communicationPort)
		//{
		//	communicationPort.SendIntBytes(TeensyToken.Reset, 2);

		//	var response = string.Empty;
		//	try
		//	{
		//		for (int i = 0; i < 10; i++)
		//		{
		//			response += $"{communicationPort.ReadAndLogSerialAsString(1000)}";

		//			if (response.Contains("Resetting C64"))
		//			{
		//				return true;
		//			}
		//			Thread.Sleep(100);
		//		}
		//	}
		//	catch (Exception ex)
		//	{
		//		if (ex.Message.Contains("port is closed") || communicationPort.GetConnectionType() is ConnectionType.Tcp)
		//		{
		//			Thread.Sleep(1000);
		//			communicationPort.ClosePort();
		//			communicationPort.OpenPort();
		//			Thread.Sleep(1000);
		//			communicationPort.ClearBuffers();
		//			return true;
		//		}
		//		throw;
		//	}
		//	return false;
		//}

		public static void ToggleSid(this ICommunicationPort communicationPort)
		{
			communicationPort.SendIntBytes(TeensyToken.PauseMusic, 2);
			communicationPort.HandleAck();
		}

		public static async Task SetSidSpeed(this ICommunicationPort communicationPort, double requestSpeed, MusicSpeedCurveTypes speedCurve)
		{
			var attemptNumber = 1;

			while (attemptNumber <= 5)
			{
				try
				{
					short computedSpeed = requestSpeed.ToScaledShort();

					if (speedCurve == MusicSpeedCurveTypes.Linear)
					{
						if (requestSpeed < MusicConstants.Linear_Speed_Min || requestSpeed > MusicConstants.Linear_Speed_Max)
							throw new ArgumentOutOfRangeException(nameof(requestSpeed), $"Speed must be between {MusicConstants.Linear_Speed_Min} and {MusicConstants.Linear_Speed_Max}.");

						communicationPort.SendIntBytes(TeensyToken.SetMusicSpeedLinear, 2);
					}
					else
					{
						if (requestSpeed < MusicConstants.Log_Speed_Min || requestSpeed > MusicConstants.Log_Speed_Max)
							throw new ArgumentOutOfRangeException(nameof(requestSpeed), $"Speed must be between {MusicConstants.Log_Speed_Min} and {MusicConstants.Log_Speed_Max}.");

						communicationPort.SendIntBytes(TeensyToken.SetMusicSpeedLog, 2);
					}
					communicationPort.SendSignedShort(computedSpeed);
					communicationPort.HandleAck();
					break;
				}
				catch (Exception)
				{
					Debug.WriteLine($"Caught Exception in SetMusicSpeedHandler.  Attempt: {attemptNumber} Delay: {100}");
					await Task.Delay(100);

					if (attemptNumber >= 5)
					{
						throw new TeensyDjException();
					}
					attemptNumber++;
					communicationPort.ClearBuffers();
					continue;
				}
			}
		}

		public static (List<FileTransferItem> SuccessfulFiles, List<FileTransferItem> FailedFiles) SaveFiles(this ICommunicationPort communicationPort, List<FileTransferItem> files, ILoggingService log)
		{
			List<FileTransferItem> successfulFiles = [];
			List<FileTransferItem> failedFiles = [];

			log.Internal($"{_logClass} Saving {files.Count} file(s) to the TR");

			foreach (var file in files)
			{
				var success = CopyFile(communicationPort, log, file, files);

				if (success)
				{
					log.Internal($"{_logClass} Copying: {file.TargetPath.FileName} to {file.TargetPath.Directory}");
					successfulFiles.Add(file);
				}
				else
				{
					log.InternalError($"{_logClass}Failed to copy {file.TargetPath.FileName} after 3 attempts");
					failedFiles.Add(file);
				}
			}
			return (successfulFiles, failedFiles);
		}

		public static bool CopyFile(this ICommunicationPort communicationPort, ILoggingService log, FileTransferItem file, List<FileTransferItem> files)
		{
			var retry = 0;

			while (retry < 3)
			{
				communicationPort.ClearBuffers();
				try
				{
					communicationPort.SendIntBytes(TeensyToken.SendFile, 2);
					communicationPort.HandleAck();
					communicationPort.SendIntBytes(file.StreamLength, 4);
					communicationPort.SendIntBytes(file.Checksum, 2);
					communicationPort.SendIntBytes(file.TargetStorage.GetStorageToken(), 1);
					communicationPort.Write($"{file.TargetPath.Value}\0");
					communicationPort.HandleAck();
					communicationPort.ClearBuffers();

					var bytesSent = 0;

					while (file.StreamLength > bytesSent)
					{
						var bytesToSend = 16 * 1024;
						if (file.StreamLength - bytesSent < bytesToSend) bytesToSend = (int)file.StreamLength - bytesSent;
						communicationPort.Write(file.Buffer, bytesSent, bytesToSend);

						bytesSent += bytesToSend;
					}
					communicationPort.HandleAck();
					return true;
				}
				catch (Exception ex)
				{
					retry++;
					var response = communicationPort.ReadSerialAsString(500);
					var fileExistsMessage = "File already exists";

					var isDuplicateFile = response.Contains(fileExistsMessage, StringComparison.OrdinalIgnoreCase)
						|| ex.Message.Contains(fileExistsMessage, StringComparison.OrdinalIgnoreCase);

					if (isDuplicateFile)
					{
						log.InternalError($"{_logClass}Attempting to overwrite: {file.TargetPath.Value}");
						DeleteFile(communicationPort, log, file);
						continue;
					}
					log.InternalError($"{_logClass} Waiting {retry} seconds to retry.");
					Thread.Sleep(1000 * retry);
					log.InternalError($"Retry {retry} of 3");
				}
			}
			return false;
		}

		public static void DeleteFile(this ICommunicationPort communicationPort, ILoggingService log, FileTransferItem file)
		{
			try
			{
				communicationPort.ClearBuffers();
				communicationPort.SendIntBytes(TeensyToken.DeleteFile, 2);
				communicationPort.HandleAck();
				communicationPort.SendIntBytes(file.TargetStorage.GetStorageToken(), 1);
				communicationPort.Write($"{file.TargetPath.Value}\0");
				communicationPort.HandleAck();
				log.InternalSuccess($"{_logClass} Deleted file {file.TargetPath} successfully");
			}
			catch (Exception ex)
			{
				log.InternalError($"{_logClass} Error deleting file {file} \r\n => {ex.Message}");
			}
		}

		public static TeensyToken SendFwCheckCommand(this ICommunicationPort communicationPort, ILoggingService log)
		{
			communicationPort.ClearBuffers();
			log.Internal($"{_logClass} TRStreamExtensions: Checking for Minimal FW");
			communicationPort.SendIntBytes(TeensyToken.FwCheckToken, 2);
			communicationPort.WaitForSerialData(numBytes: 2, timeoutMs: 20000);  // Reduced from 20000 for faster discovery
			byte[] recBuf = new byte[2];
			communicationPort.Read(recBuf, 0, 2);
			ushort result = BitConverter.ToUInt16(recBuf, 0);
			var token = TeensyToken.FromValue(result);
			string fwType = token.Name switch
			{
				nameof(TeensyToken.FWMinimalToken) => "Minimal FW",
				nameof(TeensyToken.FWFullToken) => "Full FW",
				_ => $"Unknown ({result})"
			};
			log.Internal($"{_logClass} FW Response: {fwType}");
			return token;
		}

		public static bool ExecuteMinimalCheck(this ICommunicationPort communicationPort, ILoggingService log)
		{
			var result = SendFwCheckCommand(communicationPort, log);

			if (result == TeensyToken.FWMinimalToken) return true;

			if (result == TeensyToken.FWFullToken) return false;

			throw new TeensyException("Unexpected response from Minimal Check command.");
		}

		public static string PingDevice(this ICommunicationPort communicationPort, int waitMs = 30)
		{
			communicationPort.SendIntBytes(TeensyToken.Ping, 2);
			return communicationPort.ReadAndLogSerialAsString(waitMs);
		}

		public static bool ResetAndReconnectToFullFwTcp(this ICommunicationPort communicationPort, ILoggingService log)
		{
			communicationPort.ResetDevice(log);
			communicationPort.ClosePort();
			communicationPort.OpenPort();

			var isMinimal = communicationPort.ExecuteMinimalCheck(log);

			if (!isMinimal)
			{
				return true;
			}
			return false;
		}

		public static bool ForceResetAndReconnectToFullFw(this ICommunicationPort communicationPort, ILoggingService log)
		{
			if (communicationPort.GetConnectionType() is ConnectionType.Serial)
			{
				communicationPort.ResetDevice(log);
			}
			return communicationPort.ReconnectToFullFw(log);
		}

		public static bool ReconnectToFullFw(this ICommunicationPort communicationPort, ILoggingService log)
		{
			if (communicationPort.GetConnectionType() is ConnectionType.Serial)
			{
				return communicationPort.ReconnectToFullFwSerial(log);
			}
			else
			{
				return communicationPort.ReconnectToFullFwTcp(log);
			}			
		}

		private static bool ReconnectToFullFwTcp(this ICommunicationPort communicationPort, ILoggingService log)
		{
			communicationPort.ResetDevice(log);
			communicationPort.ClosePort();
			communicationPort.OpenPort();
			return !communicationPort.ExecuteMinimalCheck(log);
		}

		public static bool ReconnectToFullFwSerial(this ICommunicationPort communicationPort, ILoggingService log)
		{
			log.Internal("Reconnecting Serial to Default FW.");
			var stopwatch = Stopwatch.StartNew();

			while (stopwatch.ElapsedMilliseconds < 30000)
			{
				var ports = SerialPort.GetPortNames().Distinct();

				foreach (var port in ports)
				{
					try
					{
						log.Internal($"{_logClass} Closing Port.");
						communicationPort.ClosePort();
						communicationPort.SetPort(port);
						log.Internal($"{_logClass} Opening Port: {port}");
						communicationPort.OpenPort(useRetryLoop: false);
						communicationPort.ReadAndLogSerialAsString(500);

						var minimalResult = communicationPort.SendFwCheckCommand(log);

						if (minimalResult == TeensyToken.FWMinimalToken)
						{
							communicationPort.ResetDevice(log);
							Thread.Sleep(4000);
							continue;
						}
						if (minimalResult == TeensyToken.FWFullToken)
						{
							log.InternalSuccess($"{_logClass} Successfully reconnected to Default TeensyROM FW");
							communicationPort.ReadAndLogSerialAsString(500);
							return true;
						}					
					}
					catch
					{
						continue;
					}
				}								
			}
			log.InternalError($"{_logClass} There was an error reconnecting to TeensyROM after minimal mode reset.");
			return false;
		}

		public static bool ConnectToMinimalFw(this ICommunicationPort communicationPort, ILoggingService log)
		{
			if (communicationPort.GetConnectionType() is ConnectionType.Serial)
			{
				return communicationPort.ConnectToMinimalFWSerial(log);
			}
			else
			{
				return communicationPort.ConnectToMinimalFwTcp(log);
			}
		}

		public static bool ConnectToMinimalFwTcp(this ICommunicationPort communicationPort, ILoggingService log)
		{
			communicationPort.ClosePort();

			//Note to future self:
			//If there are any bug reports of flaky minimal boot issues, try increasing this delay.
			Thread.Sleep(500);
			communicationPort.OpenPort();

			var isMinimal = ExecuteMinimalCheck(communicationPort, log);

			if (isMinimal)
			{
				log.Internal($"{_logClass} LaunchFileHandler: Successfully reconnected to minimal mode.");
			}

			return isMinimal;
		}

		public static bool ConnectToMinimalFWSerial(this ICommunicationPort communicationPort,ILoggingService log)
		{
			Thread.Sleep(3000);

			var stopwatch = Stopwatch.StartNew();

			while (stopwatch.ElapsedMilliseconds < 30000)
			{
				var ports = SerialPort.GetPortNames().Distinct();

				foreach (var port in ports)
				{
					Thread.Sleep(200);

					try
					{
						communicationPort.ClosePort();
						communicationPort.SetPort(port);
						communicationPort.OpenPort(useRetryLoop: false);
						communicationPort.ClearBuffers();
						Thread.Sleep(200);

						var minimalResult = communicationPort.SendFwCheckCommand(log);

				if (minimalResult == TeensyToken.FWMinimalToken)
						{
							log.InternalSuccess($"{_logClass} Successfully reconnected to Minimal TeensyROM FW");
							return true;
						}
					}
					catch
					{
						continue;
					}
				}
				log.InternalError($"{_logClass} There was an error reconnecting to TeensyROM after minimal mode reset.");
			}
			return false;
		}
	}
}
