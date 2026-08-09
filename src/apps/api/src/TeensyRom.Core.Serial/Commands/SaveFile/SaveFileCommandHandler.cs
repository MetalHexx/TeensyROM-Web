using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;

namespace TeensyRom.Core.Commands
{
    /// <summary>
    /// Streaming, single-file sibling of <see cref="SaveFilesCommandHandler"/> - carries the same wire
    /// protocol across against a <see cref="StreamedFileTransfer"/> instead of an in-memory
    /// <see cref="FileTransferItem"/>, so the handler's own allocation stays fixed at one chunk buffer
    /// regardless of file size.
    /// </summary>
    public class SaveFileCommandHandler(ILoggingService logService) : IRequestHandler<SaveFileCommand, SaveFileResult>
    {
        private const int _retryLimit = 3;
        private const int _chunkSize = 16 * 1024;

        public async Task<SaveFileResult> Handle(SaveFileCommand command, CancellationToken ct)
        {
            var port = command.CommunicationPort;
            var file = command.File;
            var buffer = new byte[_chunkSize];
            var retry = 0;

            logService.Internal($"Saving File: {file.TargetPath.Value}", command.DeviceId);

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

                    logService.InternalSuccess($"Save Success: {file.TargetPath.Value}", command.DeviceId);
                    return new SaveFileResult { Saved = true };
                }
                catch (Exception ex)
                {
                    retry++;
                    var fileExistsParseMessage = "File already exists";

                    var fileExists = ex.Message.Contains(fileExistsParseMessage, StringComparison.OrdinalIgnoreCase);

                    if (fileExists)
                    {
                        logService.InternalError($"Save Error: {file.TargetPath.Value} already exists on TR.", command.DeviceId);
                        logService.Internal($"Delete Attempt: {file.TargetPath.Value}", command.DeviceId);
                        TryDelete(port, file, command.DeviceId);
                        continue;
                    }
                    logService.InternalError($"Save Retry: {retry} seconds to retry.", command.DeviceId);

                    if (retry < _retryLimit)
                    {
                        await Task.Delay(1000 * retry, ct);
                    }
                    logService.InternalError($"Save Retry: {retry} of {_retryLimit}", command.DeviceId);
                }
            }

            var error = $"Failed to copy {file.TargetPath.FileName} after {_retryLimit} attempts";
            logService.InternalError($"Save Failed: {error}", command.DeviceId);

            return new SaveFileResult { IsSuccess = false, Error = error };
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
