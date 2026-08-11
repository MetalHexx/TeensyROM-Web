using System.Diagnostics;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.TcpDebugger;

/// <summary>
/// Isolation harness for the FILE-TRANSFER-4 ack-timeout bug, one level up from
/// Program.ExecuteTransferFilesCommand: mirrors TransferPump's actual per-job sequence - one
/// unconditional device reset via ResetCommandHandler, then N sequential
/// TransferFilesCommandHandler calls (one file per batch) against the same connection - with
/// none of TransferPump's queue/staging/registry/DI machinery around it. TransferPump always
/// resets before the first file of a job regardless of current firmware state, unlike Program's
/// single-file harness which only resets when the FW check reports minimal - this class exists to
/// cover that gap, and to exercise several sequential SendFile calls back-to-back the way a real
/// batch drop does.
/// </summary>
internal static class TransferPumpHarness
{
    public static async Task RunAsync(TcpCommunicationPort tcpPort, int fileCount = 5)
    {
        Program.LogHeader($"=== TransferPump isolation harness: reset + {fileCount} sequential file(s) ===");
        Console.WriteLine();

        var log = new Program.SimpleLoggingService();
        var jobStopwatch = Stopwatch.StartNew();

        await ResetOnceAsync(tcpPort, log);

        var succeeded = 0;
        var failed = 0;

        for (var i = 1; i <= fileCount; i++)
        {
            var ok = await SendOneFileAsync(tcpPort, log, i);
            if (ok) succeeded++; else failed++;
        }

        jobStopwatch.Stop();

        Console.WriteLine();
        Program.LogHeader($"=== Job complete in {jobStopwatch.ElapsedMilliseconds}ms: {succeeded} succeeded, {failed} failed ===");
        Console.WriteLine();
    }

    private static async Task ResetOnceAsync(TcpCommunicationPort tcpPort, Program.SimpleLoggingService log)
    {
        Program.LogHeader("Reset (unconditional, once per job - mirrors TransferPump.ResetDeviceAsync)");

        var handler = new ResetCommandHandler(log);
        var sw = Stopwatch.StartNew();

        var result = await handler.Handle(new ResetCommand
        {
            DeviceId = "TCP-DEBUG",
            CommunicationPort = tcpPort
        }, CancellationToken.None);

        sw.Stop();

        if (result.IsSuccess)
        {
            Program.LogSuccess($"Reset succeeded in {sw.ElapsedMilliseconds}ms");
        }
        else
        {
            Program.LogError($"Reset FAILED in {sw.ElapsedMilliseconds}ms: {result.Error}");
        }
        Console.WriteLine();
    }

    private static async Task<bool> SendOneFileAsync(TcpCommunicationPort tcpPort, Program.SimpleLoggingService log, int index)
    {
        var runSuffix = Guid.NewGuid().ToString("N")[..5];
        var targetPath = $"/ft-smoke-test/tcpdebug-pump-{index}-{runSuffix}.txt";

        Program.LogHeader($"SaveFile {index} (isolated pump loop) -> {targetPath}");

        var sourcePath = Path.Combine(Path.GetTempPath(), $"tcpdebug-pump-{index}.txt");
        File.WriteAllText(sourcePath, $"TeensyROM pump isolation test #{index} - {DateTime.Now:O}{Environment.NewLine}");

        var transfer = StreamedFileTransfer.FromFile(sourcePath, new FilePath(targetPath), TeensyStorageType.SD);
        Program.LogDetail($"Source: {sourcePath}");
        Program.LogDetail($"StreamLength: {transfer.StreamLength}, Checksum: {transfer.Checksum}");

        var handler = new TransferFilesCommandHandler(log);
        var sw = Stopwatch.StartNew();

        var result = await handler.Handle(new TransferFilesCommand
        {
            Files = [transfer],
            DeviceId = "TCP-DEBUG",
            CommunicationPort = tcpPort,
            OnFileCompleted = (_, _) => Task.CompletedTask
        }, CancellationToken.None);

        sw.Stop();

        var saved = result.Outcomes.Count == 1 && result.Outcomes[0].Saved;

        if (result.IsSuccess)
        {
            Program.LogSuccess($"SaveFile {index} succeeded in {sw.ElapsedMilliseconds}ms (Saved={saved})");
        }
        else
        {
            Program.LogError($"SaveFile {index} FAILED in {sw.ElapsedMilliseconds}ms: {result.Error}");
        }
        Console.WriteLine();

        return result.IsSuccess && saved;
    }
}
