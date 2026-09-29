using System.IO;
using System.Net.Sockets;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Core.Serial.Recovery
{
    /// <summary>
    /// Classifies an exception a command raised against an open port as "the transport is gone" versus
    /// "the device answered badly or slowly" - the line recovery uses to decide whether a failure is
    /// worth reacquiring the connection for.
    /// </summary>
    public static class TransportDrop
    {
        /// <summary>True when the exception (or the port's state) says the transport is gone rather than the device answering badly or slowly.</summary>
        public static bool IsDrop(Exception ex, ICommunicationPort port)
        {
            if (!port.IsOpen)
            {
                return true;
            }

            // The TCP port wraps every I/O error in one TeensyException; unwrap it once before
            // classifying. A TeensyException with no inner exception (e.g. an unexpected-response
            // failure) carries no transport exception at all, so it is never a drop.
            var candidate = ex is TeensyException teensy ? teensy.InnerException : ex;
            if (candidate is null)
            {
                return false;
            }

            if (candidate is InvalidOperationException invalidOperation &&
                (invalidOperation.Message.Contains("port is closed", StringComparison.OrdinalIgnoreCase) ||
                 invalidOperation.Message.Contains("not open", StringComparison.OrdinalIgnoreCase)))
            {
                return true;
            }

            if (candidate is UnauthorizedAccessException)
            {
                return true;
            }

            var socketException = FindSocketException(candidate);
            if (socketException is not null)
            {
                return socketException.SocketErrorCode is
                    SocketError.ConnectionReset or
                    SocketError.ConnectionAborted or
                    SocketError.Shutdown or
                    SocketError.NotConnected or
                    SocketError.NetworkDown or
                    SocketError.HostUnreachable;
            }

            return candidate is IOException && port.GetConnectionType() == ConnectionType.Tcp;
        }

        private static SocketException? FindSocketException(Exception ex)
        {
            for (var current = ex; current is not null; current = current.InnerException)
            {
                if (current is SocketException socketException)
                {
                    return socketException;
                }
            }
            return null;
        }
    }
}
