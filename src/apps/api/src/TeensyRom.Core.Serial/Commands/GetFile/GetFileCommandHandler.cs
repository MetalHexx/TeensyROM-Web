using MediatR;
using TeensyRom.Core.Common;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Logging;
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

    public class GetFileCommandHandler(ILoggingService log) : IRequestHandler<GetFileCommand, GetFileResult>
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

        private static readonly byte[] ClosingAck = [(byte)(TeensyToken.Ack.Value & 0xFF), (byte)(TeensyToken.Ack.Value >> 8)];

        private ICommunicationPort _communicationPort = null!;

        /// <summary>
        /// Over USB a download now and then arrives short: the device sends the whole file and its closing Ack,
        /// and a block of it never reaches the host. The device has finished and is answering, so the file is
        /// asked for once more. A second short download, or a body that stops before the closing Ack, goes to
        /// the command pipeline as a timeout, as before.
        /// </summary>
        public async Task<GetFileResult> Handle(GetFileCommand r, CancellationToken cancellationToken)
        {
            _communicationPort = r.CommunicationPort;

            try
            {
                return await Download(r, cancellationToken);
            }
            catch (TeensyShortDownloadException ex)
            {
                log.InternalWarning($"GetFileCommandHandler: {ex.Message}; asking for {r.FilePath} once more", r.DeviceId);
                return await Download(r, cancellationToken);
            }
        }

        private async Task<GetFileResult> Download(GetFileCommand r, CancellationToken cancellationToken)
        {
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

            // The length and the checksum are waited for before they are read: a serial read has no timeout of
            // its own, and a TCP read gives up after 500 ms, well short of the time the firmware spends summing
            // a large file. The device sends nothing else meanwhile, so nothing is lost while these waits poll.
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
        /// Hands the port the whole body in one read: over USB, a port left unread between reads while the
        /// device streams the file loses whole packets of it, so the serial port reads back to back. A gap
        /// of <see cref="BodyStallMs"/> with nothing arriving throws a <see cref="TimeoutException"/>, which
        /// the command pipeline treats as a suspect link. When the bytes that did arrive end with the closing
        /// Ack, the device sent everything and part of it was lost: that is a <see cref="TeensyShortDownloadException"/>.
        /// </summary>
        private async Task<byte[]> GetFileBytes(uint fileLength, CancellationToken ct)
        {
            if (!fileLength.TryParseInt(out int fileLengthInt))
            {
                throw new TeensyException("The file size attempting to be fetched is too large.");
            }

            var buffer = new byte[fileLength];

            try
            {
                await _communicationPort.ReadExactlyAsync(buffer, 0, fileLengthInt, BodyStallMs, ct);
            }
            catch (TeensyReadStalledException stall) when (EndsWithTheClosingAck(buffer, stall.BytesRead))
            {
                var fileBytesRead = stall.BytesRead - ClosingAck.Length;
                throw new TeensyShortDownloadException(
                    $"The download arrived {fileLengthInt - fileBytesRead} bytes short: the closing Ack came after {fileBytesRead} of {fileLengthInt} bytes",
                    stall);
            }
            return buffer;
        }

        private static bool EndsWithTheClosingAck(byte[] buffer, int bytesRead) =>
            bytesRead >= ClosingAck.Length && buffer.AsSpan(bytesRead - ClosingAck.Length, ClosingAck.Length).SequenceEqual(ClosingAck);
    }
}
