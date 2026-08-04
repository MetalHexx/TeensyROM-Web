using Microsoft.AspNetCore.SignalR;
using TeensyRom.Api.Models;
using TeensyRom.Api.Transfers;

namespace TeensyRom.Api.Endpoints.Transfers.Hub;

/// <summary>
/// SignalR hub for transfer job progress. Clients subscribe to a job id to join its broadcast group;
/// <see cref="ITransferProgressNotifier"/> pushes throttled snapshots to that group.
/// </summary>
public sealed class TransferHub(
    ITransferJobRegistry registry,
    ITransferSubscriptionTracker tracker) : Microsoft.AspNetCore.SignalR.Hub
{
    /// <summary>
    /// Joins the caller's connection to the job's group and returns the current snapshot immediately —
    /// a late joiner is correct without waiting for the next throttle tick.
    /// </summary>
    public async Task<TransferJobDto> Subscribe(string jobId)
    {
        var job = registry.Get(jobId) ?? throw new HubException($"Transfer job '{jobId}' not found.");

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(jobId));
        tracker.Add(Context.ConnectionId, jobId);
        job.Touch();

        return TransferJobDto.From(job.ToSnapshot());
    }

    /// <summary>
    /// Removes the caller's connection from the job's group and the subscription tracker.
    /// </summary>
    public async Task Unsubscribe(string jobId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(jobId));
        tracker.Remove(Context.ConnectionId, jobId);
    }

    /// <summary>
    /// Drops the disconnected connection from every group it had joined — without this, an abandoned
    /// job's last subscriber never clears and the abandonment sweep never sees it go idle.
    /// </summary>
    public override Task OnDisconnectedAsync(Exception? exception)
    {
        tracker.RemoveConnection(Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    private static string GroupName(string jobId) => $"job-{jobId}";
}
