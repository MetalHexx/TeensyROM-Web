using MediatR;
using System.Reactive.Linq;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Logging;
using System.Collections.Concurrent;

namespace TeensyRom.Core.Serial.Commands.Behaviors
{
  /// <summary>
  /// Disables the serial read auto-poll behavior for the duration of the command and reneables it after.
  /// Also manages per-device locking to ensure only one command accesses a port at a time.
  /// </summary>
  public class SerialBehavior<TRequest, TResponse>(ILoggingService log) : IPipelineBehavior<TRequest, TResponse>
      where TRequest : ITeensyCommand<TResponse>
      where TResponse : TeensyCommandResult, new()
  {
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
      CleanupStaleLocks();

      var lockKey = request.DeviceId ?? "default";
      var semaphore = GetOrCreateLock(lockKey);

      await semaphore.WaitAsync(cancellationToken);

      try
      {
        TResponse response = default!;

        if (!request.CommunicationPort.IsOpen)
        {
          request.CommunicationPort.ClosePort();
          request.CommunicationPort.OpenPort();
        }
        try
        {
          response = await next();
        }
        catch
        {
          request.CommunicationPort?.ClosePort();
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

    private static readonly ConcurrentDictionary<string, (SemaphoreSlim Lock, DateTime LastUsed)> _locks = new();
    private const int _staleLockMinutes = 5;

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
