using MediatR;
using System.Text;
using System.Text.Json;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.Commands.Common;
using System.Diagnostics;
using System.Buffers;
using TeensyRom.Core.ValueObjects;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Commands
{
    public class GetDirectoryRecursiveHandler(ILoggingService log) : IRequestHandler<GetDirectoryRecursiveCommand, GetDirectoryRecursiveResult>
	{
        private ICommunicationPort _communicationPort = null!;
        private string? _deviceId = null;
        private bool _recursive;

		public async Task<GetDirectoryRecursiveResult> Handle(GetDirectoryRecursiveCommand r, CancellationToken ct = default)
        {
            _deviceId = r.DeviceId;
            _communicationPort = r.CommunicationPort;
            _recursive = r.Recursive;

			r.CommunicationPort.ResetDevice(log);						

			await Task.Delay(1000);

			return await Task.Run(() =>
            {
                var result = new GetDirectoryRecursiveResult();
                StringBuilder sb = new();

                try
                {
                    if (ct.IsCancellationRequested)
                    {
                        return new GetDirectoryRecursiveResult
                        {
                            IsSuccess = false,
                            Error = "The directory listing operation was cancelled.",
                            ErrorCode = GetDirectoryErrorCode.UnknownError
                        };
                    }

                    try
                    {   
                        GetDirectoryContent(r.Path, r.StorageType, result, sb, ct);
                    }
                    catch (OperationCanceledException)
                    {
                        return new GetDirectoryRecursiveResult
                        {
                            IsSuccess = false,
                            Error = "The directory listing operation was cancelled.",
                            ErrorCode = GetDirectoryErrorCode.UnknownError
                        };
                    }
                    catch (Exception ex)
                    {
                        GetDirectoryErrorCode errorCode = ex.Message.GetDirectoryErrorCode();

                        return new GetDirectoryRecursiveResult
                        {
                            IsSuccess = false,
                            Error = ex.Message,
                            ErrorCode = errorCode
                        };
                    }
                }
                catch (TimeoutException)
                {
                    result.IsSuccess = false;
                    result.Error = "There was a timeout when trying to fetch file data. This can be caused when the storage device is not installed on the TeensyROM device.";
                    return result;
                }
                catch (OperationCanceledException)
                {
                    return new GetDirectoryRecursiveResult
                    {
                        IsSuccess = false,
                        Error = "The directory listing operation was cancelled.",
                        ErrorCode = GetDirectoryErrorCode.UnknownError
                    };
                }

                var count = 0;

                foreach (var directory in result.DirectoryContent)
                {
                    count += directory?.Files.Count ?? 0;
                    count += directory?.Directories.Count ?? 0;
                }

                if (count == 0)
                {
                    result.IsSuccess = false;
                    result.Error = "No data was returned from the TR.";
                }
                return result;
            }, ct);
        }

        private void GetDirectoryContent(DirectoryPath path, TeensyStorageType storageType, GetDirectoryRecursiveResult result, StringBuilder directoryLogs, CancellationToken ct)
        {
            ct.ThrowIfCancellationRequested();

            log.Internal($"=> Indexing: {path}", _deviceId);

            DirectoryContent? directoryContent;

            _communicationPort.SendIntBytes(TeensyToken.ListDirectory, 2);

            var ack = _communicationPort.HandleAck();
            _communicationPort.SendIntBytes(storageType.GetStorageToken(), 1);
            _communicationPort.SendIntBytes(0, 2); //skip
            _communicationPort.SendIntBytes(9999, 2); //take
            _communicationPort.Write($"{path}\0");
            _communicationPort.HandleAck();

            if (WaitForDirectoryStartToken() != TeensyToken.StartDirectoryList)
            {
                _communicationPort.ReadAndLogSerialAsString(msToWait: 100);
                throw new TeensyException("Error waiting for Directory Start Token");
            }
            ct.ThrowIfCancellationRequested();

            directoryContent = ReceiveDirectoryContent(path, ct);

            if (directoryContent is null)
            {
                _communicationPort.ReadAndLogSerialAsString(msToWait: 100);
                throw new TeensyException("Error waiting for Directory Start Token");
            }
            directoryContent.Path = path;

            result.DirectoryContent.Add(directoryContent);

            if (_recursive)
            {
                foreach (var directory in directoryContent.Directories)
                {
                    ct.ThrowIfCancellationRequested();

                    GetDirectoryContent(directory.Path, storageType, result, directoryLogs, ct);
                }
            }
        }

        public DirectoryContent? ReceiveDirectoryContent(DirectoryPath path, CancellationToken ct = default)
        {
            var receivedBytes = GetRawDirectoryData(ct);
            return MapDirectoryContent(receivedBytes, path);
        }

        private DirectoryContent MapDirectoryContent(List<byte> receivedBytes, DirectoryPath basePath)
        {
            var directoryContent = new DirectoryContent();

            var data = receivedBytes.ToArray().ToUtf8(trimEndBytes: 2);

            var lines = data.Split(["\r\n", "\r", "\n"], StringSplitOptions.RemoveEmptyEntries);

            foreach (var line in lines)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;

                try
                {
                    using var doc = JsonDocument.Parse(line);
                    var root = doc.RootElement;

                    if (!root.TryGetProperty("type", out var typeProperty))
                        continue;

                    var itemType = typeProperty.GetString();

                    if (!root.TryGetProperty("name", out var nameProperty))
                        continue;

                    var name = nameProperty.GetString();
                    if (string.IsNullOrEmpty(name))
                        continue;

                    switch (itemType)
                    {
                        case "dir":
                            var directoryItem = new DirectoryItem
                            {
                                Path = basePath.Combine(new DirectoryPath(name))
                            };
                            directoryContent.Directories.Add(directoryItem);
                            break;

                        case "file":
                            var size = root.TryGetProperty("size", out var sizeProperty) 
                                ? sizeProperty.GetInt64() 
                                : 0L;

                            var fileItem = new FileItem
                            {
                                Name = name,
                                Size = size,
                                Path = basePath.Combine(new FilePath(name))
                            };
                            directoryContent.Files.Add(fileItem);
                            break;
                    }
                }
                catch (JsonException)
                {
                    log.InternalError($"There was an error parsing a item in {basePath}");
                    log.InternalError("Continuing to next item.");
                    continue;
                }
            }

            return directoryContent;
        }

        public List<byte> GetRawDirectoryData(CancellationToken ct = default)
        {
            var receivedBytes = new List<byte>(1024);
            var stopwatch = Stopwatch.StartNew();
            var timeout = TimeSpan.FromSeconds(300);

            byte[] buffer = ArrayPool<byte>.Shared.Rent(1024);

            try
            {
                while (true)
                {
                    ct.ThrowIfCancellationRequested();

                    if (stopwatch.Elapsed > timeout)
                    {
                        throw new TeensyException($"Timeout waiting for expected reply from TeensyROM -- Received Bytes:\r\n{GetLogString(receivedBytes)}");
                    }

                    if (_communicationPort.BytesToRead > 0)
                    {
                        int bytesToRead = Math.Min(_communicationPort.BytesToRead, buffer.Length);
                        int bytesRead = _communicationPort.Read(buffer, 0, bytesToRead);

                        for (int i = 0; i < bytesRead; i++)
                        {
                            receivedBytes.Add(buffer[i]);
                        }

                        ushort lastToken = CheckForLastToken(receivedBytes);
                        if (lastToken == TeensyToken.Fail.Value || lastToken == TeensyToken.EndDirectoryList.Value)
                        {
                            break;
                        }
                    }
                    else
                    {
                        Task.Delay(5, ct).Wait(ct);
                    }
                }

                return receivedBytes;
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buffer);
            }
        }

        private ushort CheckForLastToken(List<byte> receivedBytes)
        {
            if (receivedBytes.Count >= 2)
            {
                return (ushort)(receivedBytes[^2] << 8 | receivedBytes[^1]);
            }
            return 0;
        }

        private string GetLogString(List<byte> receivedBytes)
        {
            var byteString = string.Empty;
            receivedBytes.ForEach(b => byteString += b.ToString());
            var logString = receivedBytes.ToArray().ToUtf8(trimEndBytes: 2);
            return logString;
        }

        public TeensyToken WaitForDirectoryStartToken()
        {
            _communicationPort.WaitForSerialData(numBytes: 2, timeoutMs: 200);

            byte[] recBuf = new byte[2];
            _communicationPort.Read(recBuf, 0, 2);
            ushort recU16 = recBuf.ToInt16();

            return recU16 switch
            {
                var _ when recU16 == TeensyToken.StartDirectoryList.Value => TeensyToken.StartDirectoryList,
                var _ when recU16 == TeensyToken.Fail.Value => TeensyToken.Fail,
                _ => TeensyToken.Unnknown,
            };
        }
    }
}
