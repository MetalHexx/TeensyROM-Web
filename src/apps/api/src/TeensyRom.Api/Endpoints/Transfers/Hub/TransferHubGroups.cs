namespace TeensyRom.Api.Endpoints.Transfers.Hub;

/// <summary>SignalR group names shared by <see cref="TransferHub"/> and the progress notifier.</summary>
public static class TransferHubGroups
{
    /// <summary>Every job's snapshots.</summary>
    public const string All = "transfers-all";

    /// <summary>One job's snapshots.</summary>
    public static string Job(string jobId) => $"job-{jobId}";
}
