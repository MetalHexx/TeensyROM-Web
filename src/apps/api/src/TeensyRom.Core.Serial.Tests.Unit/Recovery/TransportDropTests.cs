using System.IO;
using System.Net.Sockets;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Serial.Recovery;

namespace TeensyRom.Core.Serial.Tests.Unit.Recovery
{
    public class TransportDropTests
    {
        private static ICommunicationPort OpenPort(ConnectionType transport = ConnectionType.Tcp)
        {
            var port = Substitute.For<ICommunicationPort>();
            port.IsOpen.Returns(true);
            port.GetConnectionType().Returns(transport);
            return port;
        }

        [Fact]
        public void IsDrop_PortNotOpen_ReturnsTrueRegardlessOfException()
        {
            var port = Substitute.For<ICommunicationPort>();
            port.IsOpen.Returns(false);

            TransportDrop.IsDrop(new TimeoutException(), port).Should().BeTrue();
        }

        [Fact]
        public void IsDrop_SerialPortIsClosedInvalidOperationException_ReturnsTrue()
        {
            var port = OpenPort(ConnectionType.Serial);
            var ex = new InvalidOperationException("The port is closed.");

            TransportDrop.IsDrop(ex, port).Should().BeTrue();
        }

        [Fact]
        public void IsDrop_SerialNotOpenInvalidOperationException_ReturnsTrue()
        {
            var port = OpenPort(ConnectionType.Serial);
            var ex = new InvalidOperationException("Specified port is not open.");

            TransportDrop.IsDrop(ex, port).Should().BeTrue();
        }

        [Fact]
        public void IsDrop_UnauthorizedAccessException_ReturnsTrue()
        {
            var port = OpenPort(ConnectionType.Serial);
            var ex = new UnauthorizedAccessException("Access to the port 'COM3' is denied.");

            TransportDrop.IsDrop(ex, port).Should().BeTrue();
        }

        [Fact]
        public void IsDrop_TeensyExceptionWrappingIOExceptionWrappingConnectionResetSocketException_ReturnsTrue()
        {
            var port = OpenPort();
            var socketEx = new SocketException((int)SocketError.ConnectionReset);
            var ioEx = new IOException("stream error", socketEx);
            var ex = new TeensyException("read failed", ioEx);

            TransportDrop.IsDrop(ex, port).Should().BeTrue();
        }

        [Fact]
        public void IsDrop_TeensyExceptionWrappingIOExceptionWrappingTimedOutSocketException_ReturnsFalse()
        {
            var port = OpenPort();
            var socketEx = new SocketException((int)SocketError.TimedOut);
            var ioEx = new IOException("stream error", socketEx);
            var ex = new TeensyException("read failed", ioEx);

            TransportDrop.IsDrop(ex, port).Should().BeFalse();
        }

        [Fact]
        public void IsDrop_PlainTimeoutException_ReturnsFalse()
        {
            var port = OpenPort();

            TransportDrop.IsDrop(new TimeoutException(), port).Should().BeFalse();
        }

        [Fact]
        public void IsDrop_TeensyExceptionWithNoInner_ReturnsFalse()
        {
            var port = OpenPort();
            var ex = new TeensyException("Received unexpected response from TR (Fail Token) with data: No Data");

            TransportDrop.IsDrop(ex, port).Should().BeFalse();
        }

        [Fact]
        public void IsDrop_TeensyExceptionWrappingIOExceptionWithNoSocketExceptionOnTcp_ReturnsTrue()
        {
            var port = OpenPort(ConnectionType.Tcp);
            var ioEx = new IOException("TCP connection lost during write");
            var ex = new TeensyException("TCP connection lost during write", ioEx);

            TransportDrop.IsDrop(ex, port).Should().BeTrue();
        }

        [Fact]
        public void IsDrop_TeensyExceptionWrappingIOExceptionWithNoSocketExceptionOnSerial_ReturnsFalse()
        {
            var port = OpenPort(ConnectionType.Serial);
            var ioEx = new IOException("some serial I/O error");
            var ex = new TeensyException("some serial I/O error", ioEx);

            TransportDrop.IsDrop(ex, port).Should().BeFalse();
        }
    }
}
