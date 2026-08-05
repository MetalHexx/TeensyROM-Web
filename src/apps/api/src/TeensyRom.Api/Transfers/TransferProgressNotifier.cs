using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Hosting;
using TeensyRom.Api.Endpoints.Transfers.Hub;
using TeensyRom.Api.Models;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Throttles job-snapshot broadcasts to a bounded rate regardless of job size: a background loop
    /// wakes every <see cref="TransferOptions.SnapshotThrottle"/>, drains whichever jobs were marked
    /// dirty since the last tick, and sends one snapshot per dirty job. A terminal-state change flushes
    /// immediately instead of waiting for the next tick.
    /// </summary>
    public sealed class TransferProgressNotifier(
        IHubContext<TransferHub> hubContext,
        ITransferJobRegistry registry,
        TransferOptions options,
        ILoggingService log) : ITransferProgressNotifier, IHostedService
    {
        private readonly ConcurrentDictionary<string, byte> _dirty = new();
        private CancellationTokenSource? _cts;
        private Task? _loop;

        public void JobChanged(TransferJob job)
        {
            _dirty[job.JobId] = 0;

            if (TransferJob.IsTerminal(job.State))
            {
                _ = FlushAsync(CancellationToken.None);
            }
        }

        public Task FileCompletedAsync(TransferFileCompleted completed) =>
            hubContext.Clients.Group(GroupName(completed.JobId)).SendAsync("FileCompleted", completed);

        public Task StartAsync(CancellationToken cancellationToken)
        {
            _cts = new CancellationTokenSource();
            _loop = RunLoopAsync(_cts.Token);
            return Task.CompletedTask;
        }

        public async Task StopAsync(CancellationToken cancellationToken)
        {
            _cts?.Cancel();

            if (_loop is null) return;

            try
            {
                await _loop;
            }
            catch (OperationCanceledException)
            {
            }
        }

        private async Task RunLoopAsync(CancellationToken ct)
        {
            using var timer = new PeriodicTimer(options.SnapshotThrottle);

            try
            {
                while (await timer.WaitForNextTickAsync(ct))
                {
                    await FlushAsync(ct);
                }
            }
            catch (OperationCanceledException)
            {
            }
        }

        private async Task FlushAsync(CancellationToken ct)
        {
            foreach (var jobId in _dirty.Keys)
            {
                if (!_dirty.TryRemove(jobId, out _)) continue;

                var job = registry.Get(jobId);
                if (job is null) continue;

                try
                {
                    await hubContext.Clients.Group(GroupName(jobId))
                        .SendAsync("JobSnapshot", TransferJobDto.From(job.ToSnapshot()), ct);
                }
                catch (Exception ex)
                {
                    log.InternalWarning($"TransferProgressNotifier: failed to broadcast snapshot for job '{jobId}': {ex.Message}");
                }
            }
        }

        private static string GroupName(string jobId) => $"job-{jobId}";
    }
}
