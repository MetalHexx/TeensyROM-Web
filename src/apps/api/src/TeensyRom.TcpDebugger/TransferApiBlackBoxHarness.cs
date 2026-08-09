using System.Diagnostics;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TeensyRom.TcpDebugger;

/// <summary>
/// Black-box HTTP harness for the FILE-TRANSFER-4 ack-timeout bug: drives a real, already-running
/// TeensyRom.Api process the same way the Angular client does - CreateJob, N concurrent
/// UploadFile POSTs (same pool size/retry/backoff as the frontend's UploadPool), Seal, then polls
/// GetJob for the terminal state. Nothing on the server is bypassed or instantiated in-process here
/// - every queue, staging, capacity-gate, and TransferPump code path a real browser drop exercises
/// is exercised the same way, over the same HTTP surface. Only the browser/XHR layer is swapped
/// for HttpClient.
/// </summary>
internal static class TransferApiBlackBoxHarness
{
    private const int UploadConcurrency = 6;
    private const int UploadMaxAttempts = 3;
    private const int UploadBaseBackoffMs = 300;
    private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(500);
    private static readonly TimeSpan PollTimeout = TimeSpan.FromMinutes(5);

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private static readonly TransferJobState[] TerminalStates =
    [
        TransferJobState.Completed, TransferJobState.Cancelled, TransferJobState.Abandoned, TransferJobState.Aborted
    ];

    public static async Task RunAsync(
        string baseUrl,
        string? deviceId = null,
        string storageType = "SD",
        string destinationDirectory = "/ft-smoke-test",
        int fileCount = 5)
    {
        using var http = new HttpClient { BaseAddress = new Uri(baseUrl), Timeout = TimeSpan.FromMinutes(10) };

        Program.LogHeader($"=== Transfer API black-box harness: {fileCount} file(s) against {baseUrl} ===");
        Console.WriteLine();

        deviceId ??= await ResolveDeviceIdAsync(http);

        if (deviceId is null)
        {
            Program.LogError("No connected device found via GET /api/devices/ - pass a device id explicitly.");
            return;
        }

        Program.LogDetail($"Using device: {deviceId}");

        var jobId = await CreateJobAsync(http, deviceId, storageType, destinationDirectory);

        if (jobId is null)
        {
            return;
        }

        var manifest = BuildManifest(fileCount);
        var jobStopwatch = Stopwatch.StartNew();

        await UploadAllAsync(http, jobId, manifest);
        await SealJobAsync(http, jobId);
        await PollUntilTerminalAsync(http, jobId, jobStopwatch);
    }

    private static async Task<string?> ResolveDeviceIdAsync(HttpClient http)
    {
        Program.LogHeader("GET /api/devices/");

        var response = await http.GetAsync("/api/devices/");

        if (!response.IsSuccessStatusCode)
        {
            Program.LogError($"Device lookup failed: {(int)response.StatusCode} {response.StatusCode}");
            return null;
        }

        var body = await response.Content.ReadFromJsonAsync<FindDevicesResponse>(JsonOptions);
        var first = body?.Devices?.FirstOrDefault();

        return first?.DeviceId;
    }

    private static async Task<string?> CreateJobAsync(HttpClient http, string deviceId, string storageType, string destinationDirectory)
    {
        Program.LogHeader($"POST /api/devices/{deviceId}/storage/{storageType}/transfers -> {destinationDirectory}");

        var sw = Stopwatch.StartNew();
        var response = await http.PostAsJsonAsync(
            $"/api/devices/{deviceId}/storage/{storageType}/transfers",
            new { destinationDirectory },
            JsonOptions);
        sw.Stop();

        if (!response.IsSuccessStatusCode)
        {
            var problem = await response.Content.ReadAsStringAsync();
            Program.LogError($"CreateJob FAILED in {sw.ElapsedMilliseconds}ms: {(int)response.StatusCode} {response.StatusCode} - {problem}");
            return null;
        }

        var body = await response.Content.ReadFromJsonAsync<CreateJobResponse>(JsonOptions);
        Program.LogSuccess($"Job created in {sw.ElapsedMilliseconds}ms: {body?.JobId}");
        Console.WriteLine();

        return body?.JobId;
    }

    private static List<ManifestEntry> BuildManifest(int fileCount)
    {
        var runSuffix = Guid.NewGuid().ToString("N")[..5];
        var manifest = new List<ManifestEntry>(fileCount);

        for (var i = 1; i <= fileCount; i++)
        {
            var relativePath = $"tcpdebug-blackbox-{runSuffix}-{i}.txt";
            var content = Encoding.UTF8.GetBytes(
                $"TeensyROM black-box isolation test #{i} - {DateTime.Now:O}{Environment.NewLine}");

            manifest.Add(new ManifestEntry(relativePath, content));
        }

        return manifest;
    }

    private static async Task UploadAllAsync(HttpClient http, string jobId, List<ManifestEntry> manifest)
    {
        Program.LogHeader($"Uploading {manifest.Count} file(s) with {UploadConcurrency} concurrent worker(s)");

        var index = -1;
        var succeeded = 0;
        var failed = 0;

        var workers = Enumerable.Range(0, Math.Min(UploadConcurrency, manifest.Count)).Select(async _ =>
        {
            while (true)
            {
                var next = Interlocked.Increment(ref index);
                if (next >= manifest.Count) return;

                var ok = await UploadWithRetryAsync(http, jobId, manifest[next]);
                if (ok) Interlocked.Increment(ref succeeded); else Interlocked.Increment(ref failed);
            }
        });

        await Task.WhenAll(workers);

        Console.WriteLine();
        Program.LogDetail($"Upload phase done: {succeeded} succeeded, {failed} failed (job-side outcome confirmed via poll below)");
        Console.WriteLine();
    }

    private static async Task<bool> UploadWithRetryAsync(HttpClient http, string jobId, ManifestEntry entry)
    {
        for (var attempt = 1; attempt <= UploadMaxAttempts; attempt++)
        {
            var sw = Stopwatch.StartNew();

            try
            {
                using var content = new ByteArrayContent(entry.Content);
                content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");

                var url = $"/api/transfers/{jobId}/files?Path={Uri.EscapeDataString(entry.RelativePath)}";
                var response = await http.PostAsync(url, content);
                sw.Stop();

                if (response.IsSuccessStatusCode)
                {
                    Program.LogSuccess($"Uploaded {entry.RelativePath} in {sw.ElapsedMilliseconds}ms (attempt {attempt})");
                    return true;
                }

                var problem = await response.Content.ReadAsStringAsync();
                var retryable = (int)response.StatusCode >= 500;

                Program.LogError(
                    $"Upload FAILED for {entry.RelativePath} in {sw.ElapsedMilliseconds}ms " +
                    $"(attempt {attempt}, {(int)response.StatusCode} {response.StatusCode}, retryable={retryable}): {problem}");

                if (!retryable || attempt == UploadMaxAttempts) return false;
            }
            catch (Exception ex)
            {
                sw.Stop();
                Program.LogError($"Upload transport error for {entry.RelativePath} in {sw.ElapsedMilliseconds}ms (attempt {attempt}): {ex.Message}");
                if (attempt == UploadMaxAttempts) return false;
            }

            await Task.Delay(UploadBaseBackoffMs * (int)Math.Pow(2, attempt - 1));
        }

        return false;
    }

    private static async Task SealJobAsync(HttpClient http, string jobId)
    {
        Program.LogHeader($"POST /api/transfers/{jobId}/seal");

        var sw = Stopwatch.StartNew();
        var response = await http.PostAsync($"/api/transfers/{jobId}/seal", null);
        sw.Stop();

        if (!response.IsSuccessStatusCode)
        {
            var problem = await response.Content.ReadAsStringAsync();
            Program.LogError($"Seal FAILED in {sw.ElapsedMilliseconds}ms: {(int)response.StatusCode} {response.StatusCode} - {problem}");
            return;
        }

        Program.LogSuccess($"Job sealed in {sw.ElapsedMilliseconds}ms");
        Console.WriteLine();
    }

    private static async Task PollUntilTerminalAsync(HttpClient http, string jobId, Stopwatch jobStopwatch)
    {
        Program.LogHeader($"Polling GET /api/transfers/{jobId} until terminal (timeout {PollTimeout.TotalMinutes}m)");

        string? lastState = null;
        int lastSent = -1, lastFailed = -1;

        while (jobStopwatch.Elapsed < PollTimeout)
        {
            var response = await http.GetAsync($"/api/transfers/{jobId}");

            if (!response.IsSuccessStatusCode)
            {
                Program.LogError($"Poll FAILED: {(int)response.StatusCode} {response.StatusCode}");
                return;
            }

            var body = await response.Content.ReadFromJsonAsync<GetJobResponse>(JsonOptions);
            var job = body?.Job;

            if (job is null)
            {
                Program.LogError("Poll returned no job body.");
                return;
            }

            if (job.State != lastState || job.FilesSent != lastSent || job.FilesFailed != lastFailed)
            {
                Program.LogDetail(
                    $"[{jobStopwatch.ElapsedMilliseconds}ms] State={job.State} Sent={job.FilesSent} " +
                    $"Failed={job.FilesFailed} Received={job.FilesReceived} Current={job.CurrentFile ?? "-"}");
                lastState = job.State;
                lastSent = job.FilesSent;
                lastFailed = job.FilesFailed;
            }

            if (TerminalStates.Any(s => s.ToString() == job.State))
            {
                Console.WriteLine();
                Program.LogHeader(
                    $"=== Job {job.State} in {jobStopwatch.ElapsedMilliseconds}ms: " +
                    $"{job.FilesSent} sent, {job.FilesFailed} failed, {job.FilesReceived} received ===");

                if (job.Error is not null)
                {
                    Program.LogError($"Job error: {job.Error}");
                }

                foreach (var failure in job.Failures)
                {
                    Program.LogError($"  FAILED: {failure.RelativePath} -> {failure.Error}");
                }

                Console.WriteLine();
                return;
            }

            await Task.Delay(PollInterval);
        }

        Program.LogError($"Poll timed out after {PollTimeout.TotalMinutes}m without reaching a terminal state.");
    }

    private sealed record ManifestEntry(string RelativePath, byte[] Content);

    private sealed class FindDevicesResponse
    {
        public List<DeviceEntry> Devices { get; set; } = [];
    }

    private sealed class DeviceEntry
    {
        public string DeviceId { get; set; } = string.Empty;
    }

    private sealed class CreateJobResponse
    {
        public string JobId { get; set; } = string.Empty;
    }

    private sealed class GetJobResponse
    {
        public JobDto Job { get; set; } = null!;
    }

    private sealed class JobDto
    {
        public string JobId { get; set; } = string.Empty;
        public string DeviceId { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public int FilesReceived { get; set; }
        public int FilesSent { get; set; }
        public int FilesFailed { get; set; }
        public long BytesSent { get; set; }
        public int? TotalFiles { get; set; }
        public string? CurrentFile { get; set; }
        public string? Error { get; set; }
        public List<FailureDto> Failures { get; set; } = [];
    }

    private sealed class FailureDto
    {
        public string RelativePath { get; set; } = string.Empty;
        public string TargetPath { get; set; } = string.Empty;
        public bool Success { get; set; }
        public string? Error { get; set; }
        public long SizeBytes { get; set; }
    }

    /// <summary>
    /// Local mirror of TeensyRom.Core.Entities.Transfers.TransferJobState - this project deliberately
    /// stays off the TeensyRom.Api project reference so this harness only ever talks to the server over
    /// the wire, the same way a browser would.
    /// </summary>
    private enum TransferJobState
    {
        Created, Receiving, Sealed, Completed, Cancelling, Cancelled, Abandoned, Aborted
    }
}
