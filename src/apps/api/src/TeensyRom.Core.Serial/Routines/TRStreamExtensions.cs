using System.Diagnostics;
using System.Text;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands.MuteSidVoices;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Music;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Serial.Routines
{
	public static class TRStreamExtensions
	{
		private const string _logClass = $"{nameof(TRStreamExtensions)}:";

		/// <summary>Bench: the menu's SID token lands about 650 ms after the reset text; this is headroom over that, not a wait anyone expects to spend.</summary>
		private const int _menuBootTimeoutMs = 3000;

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

		/// <summary>
		/// Sends the raw reset token and reads the reply through to the C64 menu coming back up - see
		/// <see cref="WaitForMenuBootToken"/> for why the menu's token has to be consumed here. This is the
		/// only writer of the reset token, so every caller (the gate, <c>CartFinder</c>, the reset command)
		/// gets that guarantee without a guard of its own. Never throws on a transport drop: a reset sent to
		/// a device in minimal reboots the Teensy mid-reply, so the port going away while reading is the
		/// normal path there, not an error - the caller decides whether recovery follows.
		/// </summary>
		/// <returns>
		/// True when the menu announced itself and its token was consumed; false when it never did inside
		/// the bound, or the transport dropped first - in which case the next command may still meet the
		/// token and the caller has to bring the device back itself.
		/// </returns>
		public static bool ResetDevice(this ICommunicationPort communicationPort, ILoggingService log, int menuBootTimeoutMs = _menuBootTimeoutMs)
		{
			log.Internal($"{_logClass} Resetting TeensyROM");
			try
			{
				communicationPort.SendIntBytes(TeensyToken.Reset, 2);
				return communicationPort.WaitForMenuBootToken(log, menuBootTimeoutMs);
			}
			catch (Exception ex) when (TransportDrop.IsDrop(ex, communicationPort))
			{
				log.Internal($"{_logClass} reset sent; transport dropped during the reply (expected when the device was in minimal)");
				return false;
			}
		}

		/// <summary>
		/// Reads the device's post-reset output until the C64 menu's boot-time SID load answers with
		/// <see cref="TeensyToken.GoodSIDToken"/> or <see cref="TeensyToken.BadSIDToken"/>, bounded by
		/// <paramref name="timeoutMs"/>. Every reset boots the menu, and the menu asks the firmware for its
		/// default SID unconditionally; the firmware answers on the same channel commands use, roughly
		/// 650 ms after the reset text. Left there, that token is read as the next command's Ack, so this
		/// waits for the firmware's own signal - no fixed sleep - and clears the buffers behind it.
		/// </summary>
		/// <returns>
		/// True when the token arrived. False is a timeout, not a quiet success: the menu never came up
		/// within the bound, and it is logged as such.
		/// </returns>
		public static bool WaitForMenuBootToken(this ICommunicationPort communicationPort, ILoggingService log, int timeoutMs = _menuBootTimeoutMs)
		{
			var received = new List<byte>();
			var stopwatch = Stopwatch.StartNew();

			while (true)
			{
				var remainingMs = timeoutMs - (int)stopwatch.ElapsedMilliseconds;

				if (remainingMs <= 0)
				{
					break;
				}

				try
				{
					communicationPort.WaitForSerialData(numBytes: 1, timeoutMs: remainingMs);
				}
				catch (TimeoutException)
				{
					break;
				}

				var toRead = communicationPort.BytesToRead;

				if (toRead <= 0)
				{
					break;
				}

				var buffer = new byte[toRead];
				var bytesRead = communicationPort.Read(buffer, 0, toRead);

				if (bytesRead <= 0)
				{
					break;
				}

				received.AddRange(bytesRead == buffer.Length ? buffer : buffer.Take(bytesRead));

				if (ContainsMenuBootToken(received))
				{
					log.External($"{_logClass} TR Response: '{AsText(received)}'");
					communicationPort.ClearBuffers();
					return true;
				}
			}

			log.InternalWarning($"{_logClass} the C64 menu did not come up within {timeoutMs} ms - no SID token after the reset. TR Response: '{AsText(received)}'");
			return false;
		}

		/// <summary>Scans every byte offset, not just even ones: the token can follow an odd-length run of menu text.</summary>
		private static bool ContainsMenuBootToken(List<byte> received)
		{
			for (var i = 0; i + 1 < received.Count; i++)
			{
				var value = (ushort)(received[i] | (received[i + 1] << 8));

				if (value == TeensyToken.GoodSIDToken.Value || value == TeensyToken.BadSIDToken.Value)
				{
					return true;
				}
			}

			return false;
		}

		private static string AsText(List<byte> received) =>
			Encoding.Latin1.GetString([.. received]).Replace("\0", string.Empty).Trim();

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

		public static string PingDevice(this ICommunicationPort communicationPort, int waitMs = 30)
		{
			communicationPort.SendIntBytes(TeensyToken.Ping, 2);
			return communicationPort.ReadAndLogSerialAsString(waitMs);
		}

		/// <summary>
		/// A reset in full firmware keeps the transport, and a device in minimal never reaches this
		/// handler (the gate resets it back to full first) - so there is nothing left to reconnect or
		/// hunt for. Kept as a facade over <see cref="ResetDevice"/> for its existing callers. A menu that
		/// never announced itself is reported by <see cref="ResetDevice"/>'s own log rather than failing
		/// the reset: the device was still reset, which is all this command promises.
		/// </summary>
		public static bool ForceResetAndReconnectToFullFw(this ICommunicationPort communicationPort, ILoggingService log)
		{
			communicationPort.ResetDevice(log);
			return true;
		}
	}
}
