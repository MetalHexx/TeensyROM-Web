using MediatR;
using System.Diagnostics;
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

			if (IsDoneAtAck(r.LaunchItem))
			{
				AwaitResetLines(r.CommunicationPort, ResetLinesOwed(device, r.LaunchItem));
				MarkLaunched(device, r.LaunchItem);
				return new() { LaunchResult = LaunchFileResultType.Success };
			}

			bool dropped;

			if (r.LaunchItem.FileType == TeensyFileType.Crt)
			{
				var load = AwaitCartLoad(r.CommunicationPort, device);

				if (load == CartLoad.Loaded)
				{
					MarkLaunched(device, r.LaunchItem);
					return new() { LaunchResult = LaunchFileResultType.Success };
				}

				dropped = load == CartLoad.Dropped;
			}
			else
			{
				(var final, dropped) = Watch(r.CommunicationPort);

				if (final is not null)
				{
					// A good or a bad SID both leave the C64 in the menu, so a cart that ran before is gone.
					MarkLaunched(device, r.LaunchItem);
					return GetFinalResult(final.Value);
				}
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
		/// Images, text and programs: once the firmware has accepted the path it says nothing more about
		/// them on either transport - the C64 menu shows the image or text, or pulls the program in, by
		/// itself - and none of them can drop the transport, since only an oversized CRT reboots into
		/// minimal. Watching for a reply and confirming the version afterwards only ran out
		/// <see cref="ConnectionOptions.LaunchSettleMs"/> (bench, TCP: the path acknowledged within 1 ms,
		/// then silence; the launch answered after 2.77 s).
		/// A HEX starts a firmware update: the firmware reads nothing from either transport until it has
		/// flashed and rebooted (<c>DoFlashUpdate</c> runs inside its main loop), so a version confirm goes
		/// unanswered and the recovery that followed reported a disconnect in the middle of the update. It
		/// is left busy instead. A CRT no larger than <see cref="CertainFitCrtBytes"/> always loads in place,
		/// so it needs no watch or confirm either (bench, TCP: Ace 2088, 82 KB, answered after 2.73 s). A SID
		/// still reports through the watch, and a larger CRT may drop, so it waits for its after-load line
		/// (<see cref="AwaitCartLoad"/>). Before returning, the handler reads the "Resetting C64" lines the
		/// launch still owes (<see cref="AwaitResetLines"/>).
		/// </summary>
		private static bool IsDoneAtAck(LaunchableItem item) => item.FileType is
			TeensyFileType.Kla or TeensyFileType.Koa or TeensyFileType.Art or TeensyFileType.Aas or TeensyFileType.Hpi or
			TeensyFileType.Txt or TeensyFileType.Seq or
			TeensyFileType.Prg or TeensyFileType.P00 or
			TeensyFileType.Hex
			|| IsCertainFitCrt(item);

		/// <summary>
		/// The largest CRT file that can never reboot the full firmware into minimal: the firmware's fixed
		/// 128 KB RAM1 cart buffer (<c>MaxRAM_ImageSize</c>, <c>TeensyROM.h</c>) plus the file's 64-byte
		/// header. Chips go into that buffer first and spill into free RAM2 - where running out reboots
		/// into minimal - only once it is full (<c>FileParsers.ino</c> <c>ParseChipHeader</c>), so a file
		/// this size or smaller holds at most 128 KB of chips and always loads in place. Above it, whether
		/// the cart fits depends on the RAM2 left free at load time.
		/// </summary>
		private const long CertainFitCrtBytes = 128 * 1024 + 64;

		private static bool IsCertainFitCrt(LaunchableItem item) =>
			item.FileType == TeensyFileType.Crt && item.Size <= CertainFitCrtBytes;

		private const string ResetLine = "Resetting C64\r\n";

		/// <summary>
		/// How many <see cref="ResetLine"/>s the firmware still sends for a done-at-ack launch after its ack.
		/// A launch while a cart or program runs first sends the C64 back to the menu (<c>RemoteLaunch</c>
		/// falls back to <c>SetUpMainMenuROM</c>), and the main loop prints the line as it resets
		/// (<c>Teensy.ino:266</c>; bench, TCP: ~10 ms after the ack). A cart prints it again once it has
		/// loaded and resets the C64 into it (+186 ms from the menu, +735 ms while a cart ran). A program,
		/// an image or text starts without a reset. A HEX goes on to flash and is left alone. Whether
		/// something runs is the record's word, as it is for the gate.
		/// </summary>
		private static int ResetLinesOwed(TeensyRomDevice? device, LaunchableItem item)
		{
			if (item.FileType == TeensyFileType.Hex)
			{
				return 0;
			}

			var backToMenu = device?.Connection.Mode == DeviceMode.FullBusy ? 1 : 0;

			return item.FileType == TeensyFileType.Crt ? backToMenu + 1 : backToMenu;
		}

		/// <summary>
		/// Reads the lines <see cref="ResetLinesOwed"/> counted, so none is left for the next command. A
		/// launch that followed within a cart's load read the leftover line as its own ack and failed
		/// (bench, TCP: three 502s at 0.65-0.76 s; the firmware holds the next launch until the load is done
		/// and sends the old line first). Counts whole lines, since the line ending can trail its text by
		/// ~50 ms, and gives up after <see cref="ConnectionOptions.LaunchSettleMs"/>: a count the record got
		/// wrong - the C64 reset by hand, so nothing ran - costs that wait, never the launch, because none
		/// of these types can drop the transport. Reads as the data lands, like
		/// <c>WaitForMenuBootToken</c>: a timed <c>ReadSerialBytes</c> takes one byte per call on TCP while
		/// the rest is still in the socket, which made a 15-byte line cost ~450 ms.
		/// </summary>
		private void AwaitResetLines(ICommunicationPort port, int owed)
		{
			if (owed == 0)
			{
				return;
			}

			var received = ReadResetLines(port, string.Empty, owed, options.LaunchSettleMs, Stopwatch.StartNew());
			var seen = CountResetLines(received);

			if (seen < owed)
			{
				log.Internal($"LaunchFileHandler: expected {owed} reset line(s) after the launch, saw {seen}");
			}
		}

		private enum CartLoad { Loaded, Silent, Dropped }

		/// <summary>
		/// How long after the ack a <see cref="ResetLine"/> can only be the back-to-menu one. It starts
		/// ~10 ms after the ack (bench, TCP: +9 to +14 ms), while no cart larger than
		/// <see cref="CertainFitCrtBytes"/> has loaded that soon (the smallest one tried: +277 ms from the
		/// menu). Only applied to those larger carts: a small cart can load within it.
		/// </summary>
		private const int BackToMenuWindowMs = 100;

		/// <summary>
		/// Waits for a CRT larger than <see cref="CertainFitCrtBytes"/> to report that it loaded in place:
		/// the firmware resets the C64 into the cart and prints <see cref="ResetLine"/> (bench, TCP:
		/// +277 ms for 131 KB from the menu, +1,057 ms for 492 KB while a cart ran). A cart too big for the
		/// full firmware reboots into minimal while its chips load, before that line, and the port goes
		/// silent, so silence still falls back to the version confirm, and a serial port that drops goes
		/// straight to recovery, as with <see cref="Watch"/>. Launched while a cart runs, the firmware
		/// first prints the line going back to the menu, so two are owed. The record says whether a cart
		/// ran, but a game started from the C64's own menu leaves it saying the menu: a line starting
		/// within <see cref="BackToMenuWindowMs"/> is the back-to-menu one, so one more is owed then too. Taken for the after-load line, it would have skipped the recovery of a
		/// cart that went on to drop; a misjudged window only ever costs the version confirm.
		/// </summary>
		private CartLoad AwaitCartLoad(ICommunicationPort port, TeensyRomDevice? device)
		{
			var stopwatch = Stopwatch.StartNew();

			try
			{
				var received = ReadResetLines(port, string.Empty, int.MaxValue, Math.Min(BackToMenuWindowMs, options.LaunchSettleMs), stopwatch);
				var wentBackToMenu = device?.Connection.Mode == DeviceMode.FullBusy || received.Contains(ResetLine.TrimEnd(), StringComparison.Ordinal);
				var owed = wentBackToMenu ? 2 : 1;

				received = ReadResetLines(port, received, owed, options.LaunchSettleMs, stopwatch);
				var seen = CountResetLines(received);

				if (seen >= owed)
				{
					return CartLoad.Loaded;
				}

				log.Internal($"LaunchFileHandler: expected {owed} reset line(s) after the cart launch, saw {seen}; confirming with the version");
				return CartLoad.Silent;
			}
			catch (Exception ex) when (TransportDrop.IsDrop(ex, port))
			{
				return CartLoad.Dropped;
			}
		}

		/// <summary>
		/// Appends what the port sends to <paramref name="received"/> until it holds
		/// <paramref name="owed"/> whole <see cref="ResetLine"/>s or <paramref name="untilMs"/> have passed
		/// on <paramref name="stopwatch"/>. Reads as the data lands, like <c>WaitForMenuBootToken</c>.
		/// </summary>
		private static string ReadResetLines(ICommunicationPort port, string received, int owed, int untilMs, Stopwatch stopwatch)
		{
			while (CountResetLines(received) < owed)
			{
				var remainingMs = untilMs - (int)stopwatch.ElapsedMilliseconds;

				if (remainingMs <= 0)
				{
					break;
				}

				try
				{
					port.WaitForSerialData(numBytes: 1, timeoutMs: remainingMs);
				}
				catch (TimeoutException)
				{
					break;
				}

				var buffer = new byte[Math.Max(1, port.BytesToRead)];
				var bytesRead = port.Read(buffer, 0, buffer.Length);

				if (bytesRead <= 0)
				{
					break;
				}

				received += buffer[..bytesRead].ToUtf8();
			}

			return received;
		}

		private static int CountResetLines(string text)
		{
			var count = 0;

			for (var at = text.IndexOf(ResetLine, StringComparison.Ordinal); at >= 0; at = text.IndexOf(ResetLine, at + ResetLine.Length, StringComparison.Ordinal))
			{
				count++;
			}

			return count;
		}

		/// <summary>
		/// Records what the launched item left the full firmware doing. A cart or a program swaps the
		/// firmware's IO handler, and the firmware then answers <c>Busy!</c> to every non-always-available
		/// command until something resets it, so its record is marked busy and the gate resets before the
		/// next non-launch command. A SID, an image or text stays with the C64 menu under the TeensyROM
		/// handler, which keeps answering, so it is idle. The item's type decides this rather than what the
		/// port echoed: the firmware's "Loading IO handler:" text is USB-serial-only and never arrives over TCP.
		/// </summary>
		private static void MarkLaunched(TeensyRomDevice? device, LaunchableItem item)
		{
			if (device is null)
			{
				return;
			}

			if (StaysInMenu(item.FileType))
			{
				device.MarkIdle();
				return;
			}

			device.MarkBusy();
		}

		/// <summary>
		/// The C64 menu plays a SID and shows an image or text itself (<c>DriveDirLoad.ino</c>
		/// <c>HandleExecution</c>), so the firmware keeps the TeensyROM handler. A program switches to the
		/// Special IO handler once it runs (<c>rCtlRunningPRG</c>), and a cart to its own.
		/// </summary>
		private static bool StaysInMenu(TeensyFileType fileType) => fileType is
			TeensyFileType.Sid or
			TeensyFileType.Kla or TeensyFileType.Koa or TeensyFileType.Art or TeensyFileType.Aas or TeensyFileType.Hpi or
			TeensyFileType.Txt or TeensyFileType.Seq;

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
