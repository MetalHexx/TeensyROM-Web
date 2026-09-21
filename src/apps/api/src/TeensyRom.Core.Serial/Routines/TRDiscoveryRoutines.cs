using System.Diagnostics;
using System.Text;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Serial.Routines
{
    public enum StoragePresence { Unknown, Present, Absent, Busy }

    /// <summary>
    /// Raw, MediatR-free port routines used to interrogate a device outside the command pipeline, so they
    /// are answered even while the C64 is busy running a command. Every routine here never throws.
    /// </summary>
    public static class TRDiscoveryRoutines
    {
        private const string _logClass = $"{nameof(TRDiscoveryRoutines)}:";

        /// <summary>
        /// Sends VersionInfo (0x6476), consumes the 2-byte Ack, and returns the reply text. Returns
        /// <see cref="string.Empty"/> on anything unexpected (non-Ack bytes, timeout). Never throws.
        /// </summary>
        public static string ReadVersionReply(this ICommunicationPort port, ILoggingService log, int ackTimeoutMs = 3000, int idleTimeoutMs = 200)
        {
            try
            {
                port.ClearBuffers();
                port.SendIntBytes(TeensyToken.VersionInfo, 2);
                port.WaitForSerialData(numBytes: 2, timeoutMs: ackTimeoutMs);

                var recBuf = new byte[2];
                port.Read(recBuf, 0, 2);
                var received = BitConverter.ToUInt16(recBuf, 0);

                if (received == TeensyToken.Ack.Value)
                {
                    return ReadTextUntilIdle(port, idleTimeoutMs);
                }

                var drained = ReadTextUntilIdle(port, idleTimeoutMs);
                log.Internal($"{_logClass} ReadVersionReply: unexpected response: {drained.SanitizeForLogging()}");
                return string.Empty;
            }
            catch (Exception ex)
            {
                log.Internal($"{_logClass} ReadVersionReply: {ex.Message}");
                return string.Empty;
            }
        }

        /// <summary>
        /// Root listing of one storage with take = 0 - enough to learn whether the storage device is
        /// present without paging any files. Never throws.
        /// </summary>
        public static StoragePresence ProbeStorageRoot(this ICommunicationPort port, TeensyStorageType storageType, ILoggingService log, int ackTimeoutMs = 6000)
        {
            try
            {
                port.ClearBuffers();
                port.SendIntBytes(TeensyToken.ListDirectory, 2);

                try
                {
                    port.HandleAck();
                }
                catch (TeensyBusyException)
                {
                    log.Internal($"{_logClass} ProbeStorageRoot: device busy ({storageType})");
                    return StoragePresence.Busy;
                }

                port.SendIntBytes(storageType.GetStorageToken(), 1);
                port.SendIntBytes(0, 2); // skip
                port.SendIntBytes(0, 2); // take
                port.Write("/\0");

                port.WaitForSerialData(numBytes: 2, timeoutMs: ackTimeoutMs);
                var ackBuf = new byte[2];
                port.Read(ackBuf, 0, 2);
                var reply = BitConverter.ToUInt16(ackBuf, 0);

                if (reply == TeensyToken.Fail.Value)
                {
                    var text = ReadTextUntilIdle(port, 200);

                    if (text.Contains("Specified storage device was not found") || text.Contains("Directory not found"))
                    {
                        return StoragePresence.Absent;
                    }
                    if (text.Contains("Busy!"))
                    {
                        return StoragePresence.Busy;
                    }
                    log.InternalWarning($"{_logClass} ProbeStorageRoot: unexpected fail text ({storageType}): {text.SanitizeForLogging()}");
                    return StoragePresence.Unknown;
                }

                if (reply != TeensyToken.Ack.Value)
                {
                    ReadTextUntilIdle(port, 200);
                    return StoragePresence.Unknown;
                }

                port.WaitForSerialData(numBytes: 4, timeoutMs: ackTimeoutMs);
                var listBuf = new byte[4];
                port.Read(listBuf, 0, 4);

                var startToken = BitConverter.ToUInt16(listBuf, 0);
                var endToken = BitConverter.ToUInt16(listBuf, 2);

                if (startToken == TeensyToken.StartDirectoryList.Value && endToken == TeensyToken.EndDirectoryList.Value)
                {
                    return StoragePresence.Present;
                }

                ReadTextUntilIdle(port, 200);
                return StoragePresence.Unknown;
            }
            catch (Exception)
            {
                return StoragePresence.Unknown;
            }
        }

        /// <summary>
        /// Reads until the device has been silent for <paramref name="idleTimeoutMs"/> or
        /// <paramref name="maxTotalMs"/> has elapsed. Latin-1 decoded, "\0" removed. Transport-neutral:
        /// serial polls BytesToRead while TCP pulls arriving bytes into its receive buffer, so the same
        /// wait-then-read loop is correct on both, unlike <c>ICommunicationPort.ReadSerialAsString</c>.
        /// </summary>
        internal static string ReadTextUntilIdle(ICommunicationPort port, int idleTimeoutMs, int maxTotalMs = 2000)
        {
            var received = new List<byte>();
            var stopwatch = Stopwatch.StartNew();

            while (stopwatch.ElapsedMilliseconds < maxTotalMs)
            {
                try
                {
                    port.WaitForSerialData(numBytes: 1, timeoutMs: idleTimeoutMs);
                }
                catch (TimeoutException)
                {
                    break;
                }

                var toRead = port.BytesToRead;
                if (toRead <= 0)
                {
                    break;
                }

                var buffer = new byte[toRead];
                var bytesRead = port.Read(buffer, 0, toRead);
                if (bytesRead > 0)
                {
                    received.AddRange(bytesRead == buffer.Length ? buffer : buffer.Take(bytesRead));
                }
            }

            return Encoding.Latin1.GetString(received.ToArray()).Replace("\0", string.Empty);
        }
    }
}
