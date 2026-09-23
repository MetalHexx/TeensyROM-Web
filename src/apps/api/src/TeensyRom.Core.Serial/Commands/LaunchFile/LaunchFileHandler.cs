using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial.Recovery;

namespace TeensyRom.Core.Serial.Commands.LaunchFile
{
	public class LaunchFileHandler(
		ILoggingService log,
		IDeviceRecovery recovery,
		IDeviceConnectionManager devices,
		IDeviceInterrogator interrogator,
		ConnectionOptions options) : IRequestHandler<LaunchFileCommand, LaunchFileResult>
	{
		public async Task<LaunchFileResult> Handle(LaunchFileCommand r, CancellationToken cancellationToken)
		{
			var device = r.DeviceId is null ? null : devices.GetAvailableDevice(r.DeviceId);

			log.Internal($"LaunchFileHandler: {r.LaunchItem.Path} ({r.LaunchItem.Size} bytes)");

			var ack = TryLaunchCommand(r);

			if (ack == TeensyToken.RetryLaunch)
			{
				return new()
				{
					IsSuccess = false,
					Error = "TeensyROM declined the launch.",
					LaunchResult = LaunchFileResultType.Declined
				};
			}

			var (final, dropped) = Watch(r.CommunicationPort);

			if (final is not null)
			{
				return GetFinalResult(final.Value);
			}

			if (!dropped)
			{
				var reply = interrogator.ReadVersion(r.CommunicationPort);

				if (reply.IsTeensyRom && !reply.IsMinimalFirmware)
				{
					MarkLaunched(device, r.LaunchItem);
					return new() { LaunchResult = LaunchFileResultType.Success };
				}
			}

			if (device is null)
			{
				return new()
				{
					IsSuccess = false,
					Error = "Disconnected from TeensyROM during launch.",
					LaunchResult = LaunchFileResultType.Disconnected
				};
			}

			var outcome = await recovery.RecoverAsync(device, RecoveryReason.LargeLaunch, cancellationToken);

			return BuildRecoveryResult(outcome);
		}

		/// <summary>
		/// Records what the launched item left the full firmware doing. Anything that swaps the firmware's
		/// IO handler - a cart, a PRG, an image - answers <c>Busy!</c> to every non-always-available command
		/// until something resets it, so its record is marked busy and the gate resets before the next
		/// non-launch command. A SID plays under the TeensyROM handler, which keeps answering, so it stays
		/// idle. The item's type decides this rather than what the port echoed: the firmware's
		/// "Loading IO handler:" text is USB-serial-only and never arrives over TCP.
		/// </summary>
		private static void MarkLaunched(TeensyRomDevice? device, LaunchableItem item)
		{
			if (device is null)
			{
				return;
			}

			if (item.FileType == TeensyFileType.Sid)
			{
				device.MarkIdle();
				return;
			}

			device.MarkBusy();
		}

		private static LaunchFileResult BuildRecoveryResult(RecoveryOutcome outcome)
		{
			if (!outcome.Reachable)
			{
				return new()
				{
					IsSuccess = false,
					Error = "Disconnected from TeensyROM during launch.",
					LaunchResult = LaunchFileResultType.Disconnected
				};
			}

			if (outcome.Mode == DeviceMode.Minimal)
			{
				return new() { LaunchResult = LaunchFileResultType.Success };
			}

			return new()
			{
				IsSuccess = false,
				Error = "The launch did not take: the device came back in full firmware.",
				LaunchResult = LaunchFileResultType.Error
			};
		}

		/// <summary>
		/// Watches the port until a final reply arrives or <see cref="ConnectionOptions.LaunchSettleMs"/>
		/// elapses. Returns the final result type when one is seen. Otherwise returns
		/// <c>Dropped = true</c> when a read threw an exception <see cref="TransportDrop"/> classifies as
		/// the transport being gone - skipping the version confirm, since serial already gave a definitive
		/// answer - or <c>Dropped = false</c> for silence/"Loading" the whole window, which is ambiguous
		/// (a TCP drop never throws) and needs the version command to resolve it.
		/// </summary>
		private (LaunchFileResultType? Final, bool Dropped) Watch(ICommunicationPort port)
		{
			var bytesRead = new List<byte>();
			var iterations = options.LaunchSettleMs / 25;

			for (var i = 0; i < iterations; i++)
			{
				byte[] responseBytes;

				try
				{
					responseBytes = port.ReadSerialBytes(25);
				}
				catch (Exception ex) when (TransportDrop.IsDrop(ex, port))
				{
					return (null, true);
				}

				bytesRead.AddRange(responseBytes);
				var resultType = ParseResponse([.. bytesRead]);

				if (resultType is not (LaunchFileResultType.NoResponse or LaunchFileResultType.Loading))
				{
					return (resultType, false);
				}
			}

			return (null, false);
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
				return LaunchFileResultType.Loading;
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
				LaunchFileResultType.Loading => new() { LaunchResult = LaunchFileResultType.Success },
				LaunchFileResultType.SidError => new() { IsSuccess = false, LaunchResult = LaunchFileResultType.SidError },
				LaunchFileResultType.ProgramError => new() { IsSuccess = false, LaunchResult = LaunchFileResultType.ProgramError },
				LaunchFileResultType.NoResponse => new() { IsSuccess = false, LaunchResult = LaunchFileResultType.NoResponse },
				_ => new() { LaunchResult = LaunchFileResultType.Success },
			};
		}
	}
}
