using MediatR;
using System.Collections.Concurrent;
using System.Reactive.Linq;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial.Commands.Behaviors
{
	/// <summary>
	/// Serial/TCP pipeline to manage cross-cutting behaviors for all commands.
	///
	/// <remarks>
	/// Handles general connectivity and manages scenarios where TeensyROM is busy
	/// or needs to revert to the Full TeeensyROM firmware.  It also ensures only
	/// one command at a time (per device) can be executed.
	/// </remarks>
	/// </summary>
	public class SerialBehavior<TRequest, TResponse>(ILoggingService log) : IPipelineBehavior<TRequest, TResponse>
		where TRequest : ITeensyCommand<TResponse>
		where TResponse : TeensyCommandResult, new()
	{
		private static readonly ConcurrentDictionary<string, (SemaphoreSlim Lock, DateTime LastUsed)> _locks = new();
		private const int _staleLockMinutes = 5;

		public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
		{
			CleanupStaleLocks();

			var lockKey = request.DeviceId ?? "default";
			var semaphore = GetOrCreateLock(lockKey);

			await semaphore.WaitAsync(cancellationToken);

			try
			{
				TResponse response = default!;
				var port = request.CommunicationPort;

				if (!port.IsOpen)
				{
					port.ClosePort();
					port.OpenPort();
				}
				else
				{
					port.ClearBuffers();
				}	

				if (port.SendMinimalCommand(log) is not 0)
				{
					if (!port.ReconnectToFullFw(log))
					{
						return new()
						{
							IsSuccess = false,
							Error = "SerialBehavior: Command Failed. Cart was in Minimal and was unable to reset to full FW."
						};
					}
				}
				else if (request is not IBusyTolerant)
				{
					if (port.PingDevice().IsTeensyRomBusy())
					{
						if (!port.ForceResetAndReconnectToFullFw(log))
						{
							return new()
							{
								IsSuccess = false,
								Error = "SerialBehavior: Command Failed. Cart was busy and was unable to reset."
							};
						}
					}
				}
				try
				{
					port.ClearBuffers();
					response = await next();
				}
				catch
				{
					port?.ClosePort();
					log.InternalError("Closing port due to an error during communication port command.");
					throw;
				}
				return response;
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
		///   This is just a stability safety net in case we get orphaned locks.
		/// </remarks>
		/// </summary>
		private void CleanupStaleLocks()
		{
			var cutoff = DateTime.UtcNow.AddMinutes(-_staleLockMinutes);

			_locks
			  .Where(kvp => kvp.Value.LastUsed < cutoff)
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
