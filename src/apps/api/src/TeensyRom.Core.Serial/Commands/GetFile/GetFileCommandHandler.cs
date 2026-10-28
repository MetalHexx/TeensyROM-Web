using MediatR;
using TeensyRom.Core.Common;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Serial.Recovery;

namespace TeensyRom.Core.Commands.GetFile
{
    public enum GetFileErrorCode
    {
        StorageParamError = 1,
        PathParamError = 2,
        StorageUnavailable = 3,
        FileNotFound = 4,
        FileOpenError = 5,
        UnknownError = 6
    }

    public class GetFileCommandHandler() : IRequestHandler<GetFileCommand, GetFileResult>
    {
        /// <summary>How long the file length may take to follow the Ack. The firmware sends it as soon as the file is open.</summary>
        public const int LengthWaitMs = 5_000;

        /// <summary>
        /// The firmware reads the whole file to sum it before it sends the checksum, so the checksum's wait
        /// starts from this base and grows by <see cref="ChecksumWaitMsPerMegabyte"/> with the file's size.
        /// </summary>
        public const int ChecksumBaseWaitMs = 5_000;
        public const int ChecksumWaitMsPerMegabyte = 1_000;

        /// <summary>How long the file body may go without a byte arriving before the device counts as stalled.</summary>
        public const int BodyStallMs = 5_000;

        private const int BytesPerMegabyte = 1_048_576;

        private ICommunicationPort _communicationPort = null!;
        public async Task<GetFileResult> Handle(GetFileCommand r, CancellationToken cancellationToken)
        {
            _communicationPort = r.CommunicationPort;

            _communicationPort.ClearBuffers();
            _communicationPort.SendIntBytes(TeensyToken.GetFile, 2);
            _communicationPort.HandleAck();
            _communicationPort.SendIntBytes(r.StorageType.GetStorageToken(), 1);
            _communicationPort.Write($"{r.FilePath}\0");

            try
            {
                var ackResult = _communicationPort.HandleAck();

				if (ackResult != TeensyToken.Ack)
				{
					return new GetFileResult
					{
						IsSuccess = false,
						ErrorCode = GetFileErrorCode.UnknownError
					};
				}

			}
            catch (Exception ex) when (!(ex is TimeoutException || TransportDrop.IsDrop(ex, _communicationPort)))
            {
                GetFileErrorCode errorCode = ex.Message switch
                {
                    string msg when msg.Contains("Error 1") => GetFileErrorCode.StorageParamError,
                    string msg when msg.Contains("Error 2") => GetFileErrorCode.PathParamError,
                    string msg when msg.Contains("Error 3") => GetFileErrorCode.StorageUnavailable,
                    string msg when msg.Contains("Error 4") => GetFileErrorCode.FileNotFound,
                    string msg when msg.Contains("Error 5") => GetFileErrorCode.FileOpenError,
                    _ => GetFileErrorCode.UnknownError
                };
                return new GetFileResult
                {
                    IsSuccess = false,
                    Error = ex.Message.SanitizeForLogging(),
                    ErrorCode = errorCode
                };
            }

            // Every read below waits for its bytes first: a serial read has no timeout of its own, and a
            // TCP read gives up after 500 ms, well short of the time the firmware spends summing a large file.
            await _communicationPort.WaitForSerialDataAsync(numBytes: 4, LengthWaitMs, cancellationToken);
            var fileLength = _communicationPort.ReadIntBytes(4);

            await _communicationPort.WaitForSerialDataAsync(numBytes: 4, ChecksumWaitMs(fileLength), cancellationToken);
            var checksum = _communicationPort.ReadIntBytes(4);

            var buffer = await GetFileBytes(fileLength, cancellationToken);
            _communicationPort.HandleAck();

            var receivedChecksum = buffer.CalculateChecksum();

            if (receivedChecksum != checksum)
            {
                throw new TeensyException("Checksum Mismatch");
            }
            return new GetFileResult
            {
                FileData = buffer
            };
        }

        public static int ChecksumWaitMs(uint fileLength) =>
            ChecksumBaseWaitMs + (int)((long)fileLength * ChecksumWaitMsPerMegabyte / BytesPerMegabyte);

        /// <summary>
        /// Reads the body as it arrives. A gap of <see cref="BodyStallMs"/> with nothing to read throws a
        /// <see cref="TimeoutException"/>, which the command pipeline treats as a suspect link.
        /// </summary>
        private async Task<byte[]> GetFileBytes(uint fileLength, CancellationToken ct)
        {
            if (!fileLength.TryParseInt(out int fileLengthInt))
            {
                throw new TeensyException("The file size attempting to be fetched is too large.");
            }

            var buffer = new byte[fileLength];
            int bytesRead = 0;

            while (bytesRead < fileLengthInt)
            {
                ct.ThrowIfCancellationRequested();

                if (_communicationPort.BytesToRead == 0)
                {
                    await _communicationPort.WaitForSerialDataAsync(numBytes: 1, BodyStallMs, ct);
                }

                bytesRead += _communicationPort.Read(buffer, bytesRead, fileLengthInt - bytesRead);
            }

            return buffer;
        }
    }
}
