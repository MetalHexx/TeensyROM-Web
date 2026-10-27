using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using System.Text.Json;
using System.Text.Json.Serialization;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Logging;

namespace TeensyRom.Cli.Services;

/// <summary>Prints a line when any transfer the engine runs starts or ends.</summary>
internal interface ITransferLineStream : IAsyncDisposable
{
    /// <summary>Starts following every transfer; already-running ones are seeded without a start line. A call while an
    /// attempt is running joins that attempt; a call after a failed attempt tries again; after dispose it does nothing.</summary>
    Task StartAsync(CancellationToken ct);
}

/// <summary>
/// Follows the engine's all-transfers push over its SignalR hub and turns each job's progress into at most one start
/// line and one end line, by the rules of the web app's transfer alerts.
/// </summary>
/// <remarks>
/// Holds one hub connection however often <see cref="StartAsync"/> is called: two would print every line twice.
/// </remarks>
internal sealed class TransferLineStream(IAlertService alert, IDeviceService devices, ILoggingService log, Uri apiAddress) : ITransferLineStream
{
    private const string HubPath = "/api/transferHub";
    private const string SnapshotEvent = "JobSnapshot";
    private const string SubscribeMethod = "SubscribeAll";
    private const string UnsubscribeMethod = "UnsubscribeAll";

    private static readonly TimeSpan UnsubscribeLimit = TimeSpan.FromSeconds(2);

    private enum Due { Nothing, Start, End }

    private sealed class Tracked
    {
        public bool Started;
        public bool Ended;
    }

    private readonly object _gate = new();
    private readonly CancellationTokenSource _stop = new();
    private readonly Dictionary<string, Tracked> _jobs = [];
    private readonly Dictionary<string, string> _deviceNames = [];

    private Task? _attempt;
    private HubConnection? _hub;
    private bool _following;
    private bool _disposed;

    public Task StartAsync(CancellationToken ct)
    {
        Task attempt;

        lock (_gate)
        {
            if (_disposed) return Task.CompletedTask;
            if (_attempt is null || (_attempt.IsCompleted && !_following)) _attempt = Task.Run(ConnectAsync);
            attempt = _attempt;
        }
        return attempt.WaitAsync(ct);
    }

    public async ValueTask DisposeAsync()
    {
        Task? attempt;
        HubConnection? hub;

        lock (_gate)
        {
            if (_disposed) return;
            _disposed = true;
            attempt = _attempt;
        }

        await _stop.CancelAsync();
        if (attempt is not null) await attempt;

        lock (_gate)
        {
            hub = _hub;
            _hub = null;
        }
        if (hub is not null) await CloseAsync(hub);

        _stop.Dispose();
    }

    private async Task ConnectAsync()
    {
        var ct = _stop.Token;
        var hub = new HubConnectionBuilder()
            .WithUrl(new Uri(apiAddress, HubPath))
            .AddJsonProtocol(options =>
            {
                options.PayloadSerializerOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
                options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            })
            .WithAutomaticReconnect()
            .Build();

        hub.On<TransferJobDto>(SnapshotEvent, job => GuardedAsync(() => HandleAsync(job, ct)));
        hub.Reconnected += _ => GuardedAsync(async () =>
            await ResyncAsync(await hub.InvokeAsync<List<TransferJobDto>>(SubscribeMethod, ct), announceNew: true, ct));

        try
        {
            await hub.StartAsync(ct);
            var jobs = await hub.InvokeAsync<List<TransferJobDto>>(SubscribeMethod, ct);

            lock (_gate)
            {
                if (_disposed) throw new OperationCanceledException(ct);
                _hub = hub;
                _following = true;
            }
            await ResyncAsync(jobs, announceNew: false, ct);
        }
        catch (Exception ex)
        {
            await hub.DisposeAsync();
            if (!ct.IsCancellationRequested) log.InternalError($"Couldn't follow transfers: {ex.Message}");
        }
    }

    private async Task GuardedAsync(Func<Task> work)
    {
        try
        {
            await work();
        }
        catch (Exception ex)
        {
            if (!_stop.IsCancellationRequested) log.InternalError($"Couldn't follow transfers: {ex.Message}");
        }
    }

    /// <summary>
    /// Runs every listed job, oldest first, through the rules. At first connect, jobs not yet seen are only marked, so
    /// what is already running or over gets no start line; after a reconnect, the ones that began during the gap do,
    /// and the ones that ended unseen are marked without a line.
    /// </summary>
    private async Task ResyncAsync(List<TransferJobDto> jobs, bool announceNew, CancellationToken ct)
    {
        var due = new List<(TransferJobDto Job, Due What)>();

        lock (_gate)
        {
            foreach (var job in Enumerable.Reverse(jobs))
            {
                var unseen = !_jobs.ContainsKey(job.JobId);

                if (unseen && (!announceNew || IsTerminal(job.State)))
                {
                    _jobs[job.JobId] = new Tracked { Started = true, Ended = IsTerminal(job.State) };
                    continue;
                }
                due.Add((job, Decide(job)));
            }
        }

        foreach (var (job, what) in due.Where(entry => entry.What != Due.Nothing))
        {
            await PublishAsync(job, what, ct);
        }
    }

    private async Task HandleAsync(TransferJobDto job, CancellationToken ct)
    {
        Due what;
        lock (_gate) what = Decide(job);

        if (what != Due.Nothing) await PublishAsync(job, what, ct);
    }

    /// <summary>Decides which line the job's latest state owes, and records that it is given. Call under the lock.</summary>
    private Due Decide(TransferJobDto job)
    {
        if (!_jobs.TryGetValue(job.JobId, out var tracked)) _jobs[job.JobId] = tracked = new Tracked();

        if (!IsTerminal(job.State))
        {
            if (tracked.Started) return Due.Nothing;
            tracked.Started = true;
            return Due.Start;
        }

        if (tracked.Ended || job.LaunchState == TransferLaunchState.Pending) return Due.Nothing;
        tracked.Ended = true;
        return Due.End;
    }

    private async Task PublishAsync(TransferJobDto job, Due what, CancellationToken ct)
    {
        var name = await DeviceNameAsync(job.DeviceId, ct);

        if (what == Due.Start)
        {
            alert.Publish(TransferLines.Start(job, name).Text);
            return;
        }

        var (isError, text) = TransferLines.End(job, name);
        if (isError) alert.PublishError(text);
        else alert.PublishSuccess(text);
    }

    private async Task<string> DeviceNameAsync(string deviceId, CancellationToken ct)
    {
        lock (_gate)
        {
            if (_deviceNames.TryGetValue(deviceId, out var cached)) return cached;
        }

        try
        {
            var all = await devices.GetDevicesAsync(ct);

            lock (_gate)
            {
                foreach (var device in all) _deviceNames[device.Id] = device.Name;
                if (_deviceNames.TryGetValue(deviceId, out var name)) return name;
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log.InternalError($"Couldn't read the device names: {ex.Message}");
        }
        return deviceId;
    }

    private static bool IsTerminal(TransferJobState state) =>
        state is TransferJobState.Completed or TransferJobState.Cancelled or TransferJobState.Abandoned or TransferJobState.Aborted;

    private async Task CloseAsync(HubConnection hub)
    {
        try
        {
            using var limit = new CancellationTokenSource(UnsubscribeLimit);
            await hub.InvokeAsync(UnsubscribeMethod, limit.Token);
            await hub.StopAsync(limit.Token);
        }
        catch (Exception ex)
        {
            log.InternalError($"Couldn't stop following transfers: {ex.Message}");
        }
        finally
        {
            await hub.DisposeAsync();
        }
    }
}
