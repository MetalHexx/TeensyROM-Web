using MediatR;
using System.Collections.Concurrent;
using System.Reactive.Linq;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial.Commands.LaunchFile;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial.Commands.Behaviors
{
	/// <summary>
	/// Serial/TCP pipeline to manage cross-cutting behaviors for all commands.
	///
	/// <remarks>
	/// Ensures only one command at a time (per device) can be executed, keeps the port open for the
	/// command's own exchange, and reacts to what the exchange actually reports instead of probing the
	/// firmware first: a device believed to be in minimal is reset back to full before any command runs,
	/// launches included - minimal is a separate firmware image that cannot run files at all, and there is
	/// nothing to be gained by sending a launch to it. A device believed busy is reset the same way before
	/// any non-launch command (a handler-swapping launch leaves the firmware answering <c>Busy!</c> to
	/// every non-always-available command until something resets it), but a launch is exempt from that
	/// reset: the firmware dispatches <c>LaunchFileToken</c> above the busy gate (<c>SerUSBIO.ino:549</c>,
	/// alongside reset, version, and firmware-check - "only these commands are available when busy"), so a
	/// cart-running device accepts a launch by design and resetting first would cost a reboot and drop the
	/// user to the menu for nothing. Either reset's own outcome is read, not assumed: a menu that never
	/// comes back up (no recovery routine runs here - the port/socket stay open) fails the command with a
	/// legible reason instead of sending it into a still-booting device. A <see cref="TeensyBusyException"/>
	/// from the command's own reply earns one reset and one re-send, and a transport drop hands the device
	/// to <see cref="IDeviceRecovery"/>. A
	/// <c>ResetCommand</c> sent to a device believed to be in minimal is reset twice this way - once here
	/// to bring it back to full, once by the handler itself - landing on the same correct end state either
	/// way; the simplicity is worth the redundant reset.
	/// </remarks>
	/// </summary>
	public class CommunicationPortBehavior<TRequest, TResponse>(ILoggingService log, IDeviceConnectionManager devices, IDeviceRecovery recovery) : IPipelineBehavior<TRequest, TResponse>
		where TRequest : ITeensyCommand<TResponse>
		where TResponse : TeensyCommandResult, new()
	{
		private static readonly ConcurrentDictionary<string, (SemaphoreSlim Lock, DateTime LastUsed)> _locks = new();
		private static TimeSpan _staleLockMinutes = TimeSpan.FromMinutes(5);

		public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
		{
			CleanupStaleLocks();

			var lockKey = request.DeviceId ?? "default";
			var semaphore = GetOrCreateLock(lockKey);

			await semaphore.WaitAsync(cancellationToken);
			RefreshLock(lockKey);

			try
			{
				var port = request.CommunicationPort;
				var device = request.DeviceId is null ? null : devices.GetAvailableDevice(request.DeviceId);

				try
				{
					if (!port.IsOpen)
					{
						port.OpenPort();
					}
					else
					{
						port.ClearBuffers();
					}
				}
				catch (Exception ex) when (device is not null && TransportDrop.IsDrop(ex, port))
				{
					await recovery.RecoverAsync(device, RecoveryReason.Drop, cancellationToken);
					throw;
				}

				if (device is not null)
				{
					if (device.Connection.Mode == DeviceMode.Minimal)
					{
						port.ResetFromMinimal(log);
						var outcome = await recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, cancellationToken);

						if (outcome.Mode is not (DeviceMode.FullIdle or DeviceMode.FullBusy))
						{
							return new()
							{
								IsSuccess = false,
								Error = "Command Failed. Cart was in Minimal and could not be brought back to full firmware."
							};
						}
					}
					else if (device.Connection.Mode == DeviceMode.FullBusy && request is not LaunchFileCommand)
					{
						var resetOk = port.ResetDevice(log);
						port.ClearBuffers();

						if (!resetOk)
						{
							return new()
							{
								IsSuccess = false,
								Error = "Command Failed. The menu did not come back up after the reset."
							};
						}

						device.MarkIdle();
					}
				}

				var busyRetries = 0;

				async Task<TResponse> SendAsync()
				{
					var response = await next();

					// A launch owns its own end state - a handler-swapping launch deliberately leaves the
					// record busy - so only a non-launch command's success proves the device is idle again.
					if (device?.Connection.Mode == DeviceMode.FullBusy && request is not LaunchFileCommand)
					{
						device.MarkIdle();
					}
					return response;
				}

				try
				{
					try
					{
						return await SendAsync();
					}
					catch (TeensyBusyException) when (busyRetries++ == 0)
					{
						device?.MarkBusy();
						var resetOk = port.ResetDevice(log);
						port.ClearBuffers();

						if (!resetOk)
						{
							return new()
							{
								IsSuccess = false,
								Error = "Command Failed. The menu did not come back up after the reset."
							};
						}

						return await SendAsync();
					}
				}
				catch (Exception ex) when (device is not null && TransportDrop.IsDrop(ex, port))
				{
					await recovery.RecoverAsync(device, RecoveryReason.Drop, cancellationToken);
					throw;
				}
			}
			finally
			{
				RefreshLock(lockKey);
				semaphore.Release();
			}
		}

		/// <summary>
		/// Gets an existing lock or creates a new one for the specified device.
		/// </summary>
		private static SemaphoreSlim GetOrCreateLock(string lockKey)
		{
			return _locks.AddOrUpdate(lockKey,
				_ => (new SemaphoreSlim(1, 1), DateTime.UtcNow),
				(_, existing) => existing).Lock;
		}

		/// <summary>
		/// Refreshes the LastUsed timestamp for a device lock to prevent stale cleanup.
		/// </summary>
		private static void RefreshLock(string lockKey)
		{
			_locks.AddOrUpdate(lockKey,
				_ => throw new InvalidOperationException("Lock should exist"),
				(_, existing) => (existing.Lock, DateTime.UtcNow));
		}

		/// <summary>
		/// Clears out all stale locks.
		///
		/// <remarks>
		///   This is just a stability safety net in case we get orphaned locks. An entry whose semaphore
		///   is currently held (<c>CurrentCount == 0</c>) is never eligible, no matter how stale its
		///   last-used timestamp - a command legitimately running longer than the cutoff must not have
		///   its own lock disposed out from under it.
		/// </remarks>
		/// </summary>
		private void CleanupStaleLocks()
		{
			var cutoff = DateTime.UtcNow - _staleLockMinutes;

			_locks
			  .Where(kvp => kvp.Value.Lock.CurrentCount != 0 && kvp.Value.LastUsed < cutoff)
			  .ToList()
			  .ForEach(kvp =>
			  {
				  if (_locks.TryRemove(kvp.Key, out var entry))
				  {
					  entry.Lock.Dispose();
				  }
			  });
		}
	}
}
