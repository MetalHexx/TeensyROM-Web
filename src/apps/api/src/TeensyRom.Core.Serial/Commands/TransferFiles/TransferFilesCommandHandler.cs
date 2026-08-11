using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;

namespace TeensyRom.Core.Commands
{
    /// <summary>
    /// Streaming, batched sibling of <see cref="SaveFilesCommandHandler"/> - loops the same wire
    /// protocol once per staged <see cref="StreamedFileTransfer"/> in <see cref="TransferFilesCommand.Files"/>,
    /// reporting each file's outcome through <see cref="TransferFilesCommand.OnFileCompleted"/> before
    /// moving to the next so a caller can update per-file state as the batch progresses.
    /// <see cref="TransferFilesCommand.ShouldSkip"/> is rechecked before every file, so a caller can stop
    /// sending a file whose owning context went away since the batch was composed without waiting for
    /// the whole batch to finish.
    /// </summary>
    public class TransferFilesCommandHandler(ILoggingService logService) : IRequestHandler<TransferFilesCommand, TransferFilesResult>
    {
        private const int _retryLimit = 3;
        private const int _chunkSize = 16 * 1024;

        public async Task<TransferFilesResult> Handle(TransferFilesCommand command, CancellationToken ct)
        {
            var port = command.CommunicationPort;
            var result = new TransferFilesResult();

            for (var i = 0; i < command.Files.Count; i++)
            {
                ct.ThrowIfCancellationRequested();

                var file = command.Files[i];

                if (command.ShouldSkip?.Invoke(file) == true)
                {
                    var skipped = new TransferFileOutcome(file, false, null, false);
                    result.Outcomes.Add(skipped);
                    await command.OnFileCompleted(skipped, ct);
                    continue;
                }

                var (outcome, deviceLost) = await SendFileAsync(port, file, command.DeviceId, ct);

                result.Outcomes.Add(outcome);
                await command.OnFileCompleted(outcome, ct);

                if (!deviceLost) continue;

                for (var remaining = i + 1; remaining < command.Files.Count; remaining++)
                {
                    var skipped = new TransferFileOutcome(command.Files[remaining], false, null, false, DeviceLost: true);
                    result.Outcomes.Add(skipped);
                    await command.OnFileCompleted(skipped, ct);
                }

                result.IsSuccess = false;
                return result;
            }

            return result;
        }

        /// <summary>
        /// Runs the SendFile handshake and chunked body write for a single file, retrying up to
        /// <see cref="_retryLimit"/> times. The second tuple element is true only when the port itself
        /// appears to have gone away (<see cref="ICommunicationPort.IsOpen"/> is false after an
        /// exception) rather than the file simply being bad - the caller stops the batch in that case
        /// instead of moving on to the next file.
        /// </summary>
        private async Task<(TransferFileOutcome Outcome, bool DeviceLost)> SendFileAsync(
            ICommunicationPort port, StreamedFileTransfer file, string? deviceId, CancellationToken ct)
        {
            var buffer = new byte[_chunkSize];
            var retry = 0;

            logService.Internal($"Saving File: {file.TargetPath.Value}", deviceId);

            while (retry < _retryLimit)
            {
                port.ClearBuffers();
                try
                {
                    port.SendIntBytes(TeensyToken.SendFile, 2);
                    port.HandleAck();
                    port.SendIntBytes(file.StreamLength, 4);
                    port.SendIntBytes(file.Checksum, 2);
                    port.SendIntBytes(file.TargetStorage.GetStorageToken(), 1);
                    port.Write($"{file.TargetPath.Value}\0");
                    port.HandleAck();
                    port.ClearBuffers();

                    using (var stream = file.OpenRead())
                    {
                        var bytesSent = 0u;

                        while (file.StreamLength > bytesSent)
                        {
                            var bytesToRead = buffer.Length;
                            if (file.StreamLength - bytesSent < bytesToRead) bytesToRead = (int)(file.StreamLength - bytesSent);

                            var bytesRead = await ReadChunkWithRetry(stream, buffer, bytesToRead, ct);

                            if (bytesRead == 0)
                            {
                                throw new TeensyException(
                                    $"Unexpected end of file while sending {file.TargetPath.Value}: sent {bytesSent} of {file.StreamLength} declared bytes.");
                            }

                            port.Write(buffer, 0, bytesRead);
                            bytesSent += (uint)bytesRead;
                        }
                    }

                    port.HandleAck();

                    logService.InternalSuccess($"Save Success: {file.TargetPath.Value}", deviceId);
                    return (new TransferFileOutcome(file, true, null, true), false);
                }
                catch (Exception ex)
                {
                    retry++;

                    if (!port.IsOpen)
                    {
                        var lostError = $"Device connection lost while sending {file.TargetPath.FileName}: {ex.Message}";
                        logService.InternalError($"Save Failed: {lostError}", deviceId);
                        return (new TransferFileOutcome(file, false, lostError, true), true);
                    }

                    var fileExistsParseMessage = "File already exists";

                    var fileExists = ex.Message.Contains(fileExistsParseMessage, StringComparison.OrdinalIgnoreCase);

                    if (fileExists)
                    {
                        logService.InternalError($"Save Error: {file.TargetPath.Value} already exists on TR.", deviceId);
                        logService.Internal($"Delete Attempt: {file.TargetPath.Value}", deviceId);
                        TryDelete(port, file, deviceId);
                        continue;
                    }
                    logService.InternalError($"Save Retry: {retry} seconds to retry.", deviceId);

                    if (retry < _retryLimit)
                    {
                        await Task.Delay(1000 * retry, ct);
                    }
                    logService.InternalError($"Save Retry: {retry} of {_retryLimit}", deviceId);
                }
            }

            var error = $"Failed to copy {file.TargetPath.FileName} after {_retryLimit} attempts";
            logService.InternalError($"Save Failed: {error}", deviceId);

            return (new TransferFileOutcome(file, false, error, true), false);
        }

        private void TryDelete(ICommunicationPort port, StreamedFileTransfer file, string? deviceId)
        {
            try
            {
                port.ClearBuffers();
                port.SendIntBytes(TeensyToken.DeleteFile, 2);
                port.HandleAck();
                port.SendIntBytes(file.TargetStorage.GetStorageToken(), 1);
                port.Write($"{file.TargetPath.Value}\0");
                port.HandleAck();
                logService.InternalSuccess($"Delete Success: {file.TargetPath}", deviceId);
            }
            catch (Exception ex)
            {
                logService.InternalError($"Delete Error: {file.TargetPath} \r\n => {ex.Message}", deviceId);
            }
        }

        private static async Task<int> ReadChunkWithRetry(Stream stream, byte[] buffer, int count, CancellationToken ct)
        {
            const int maxRetries = 5;
            const int delayMs = 200;

            for (var attempt = 0; attempt < maxRetries; attempt++)
            {
                try
                {
                    return stream.Read(buffer, 0, count);
                }
                catch (IOException)
                {
                    if (attempt == maxRetries - 1) throw;
                    await Task.Delay(delayMs, ct);
                }
            }

            throw new IOException("Failed to read file after multiple attempts.");
        }
    }
}
