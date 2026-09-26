using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Core.Serial.Tests.Unit.Recovery
{
    /// <summary>
    /// A hardware-free <see cref="ICommunicationPort"/> for <see cref="DeviceRecovery"/> tests: scripts
    /// the result of each bounded <c>OpenPort(int)</c> call (succeed / throw) and tracks open/close calls
    /// so a test can assert reacquire happened - or didn't - without ever touching real bytes. The wire
    /// exchange itself is faked at <c>IDeviceInterrogator</c>, not here.
    /// </summary>
    /// <remarks>Fully qualifies <see cref="System.Reactive.Unit"/>: this namespace's ".Unit." segment shadows the unqualified name.</remarks>
    public sealed class RecoveryScriptedPort : ICommunicationPort
    {
        private readonly Queue<Action> _openOutcomes = new();
        private readonly Queue<Action> _closeOutcomes = new();
        private readonly Queue<Action> _waitOutcomes = new();
        private readonly Queue<byte> _incoming = new();

        public List<string> Calls { get; } = [];
        public bool IsOpen { get; private set; }
        public ConnectionType ConnectionType { get; set; } = ConnectionType.Tcp;
        public bool Disposed { get; private set; }

        /// <summary>Every <c>SetPort</c> call, in order, with the DTR (isTeensyRomPort) flag it was made with.</summary>
        public List<(string Port, bool IsTeensyRomPort)> SetPortCalls { get; } = [];

        private string? _endpoint;

        public RecoveryScriptedPort ThenSucceed()
        {
            _openOutcomes.Enqueue(() => { });
            return this;
        }

        public RecoveryScriptedPort ThenTimeOut()
        {
            _openOutcomes.Enqueue(() => throw new TimeoutException("connect timed out"));
            return this;
        }

        /// <summary>
        /// Scripts the next <c>ClosePort</c> as a port whose USB device has gone: the port ends closed (the
        /// handle is released) and the close still throws, as <c>SerialPort.Close</c> does on the bench.
        /// </summary>
        public RecoveryScriptedPort ThenCloseVanishes()
        {
            _closeOutcomes.Enqueue(() => throw new IOException("A device attached to the system is not functioning."));
            return this;
        }

        /// <summary>
        /// Scripts the next wait for incoming bytes as a serial port whose USB device has gone: .NET throws
        /// an <see cref="IOException"/> while the port still reads open.
        /// </summary>
        public RecoveryScriptedPort ThenWaitVanishes()
        {
            _waitOutcomes.Enqueue(() => throw new IOException("A device attached to the system is not functioning."));
            return this;
        }

        /// <summary>
        /// Scripts a token the device sends unprompted - the C64 menu's boot-time SID load answering after
        /// a reset. The wire exchange recovery drives is faked at <c>IDeviceInterrogator</c>; this is the
        /// traffic that arrives alongside it.
        /// </summary>
        public RecoveryScriptedPort EnqueueToken(TeensyToken token)
        {
            _incoming.Enqueue((byte)(token.Value & 0xFF));
            _incoming.Enqueue((byte)(token.Value >> 8));
            return this;
        }

        public int BytesToRead => _incoming.Count;

        public void ClearBuffers() => _incoming.Clear();
        public void Write(string text) { }
        public void Write(byte[] buffer, int offset, int count) { }
        public void Write(char[] buffer, int offset, int count) { }

        public System.Reactive.Unit SetPort(string port) => SetPort(port, isTeensyRomPort: false);

        public System.Reactive.Unit SetPort(string port, bool isTeensyRomPort)
        {
            _endpoint = port;
            SetPortCalls.Add((port, isTeensyRomPort));
            return System.Reactive.Unit.Default;
        }

        public string? OpenPort(bool useRetryLoop = true) => OpenPort(connectTimeoutMs: 0);

        public string? OpenPort(int connectTimeoutMs)
        {
            Calls.Add("Open");
            var outcome = _openOutcomes.Count > 0 ? _openOutcomes.Dequeue() : () => { };
            outcome();
            IsOpen = true;
            return _endpoint;
        }

        public System.Reactive.Unit ClosePort()
        {
            Calls.Add("Close");
            IsOpen = false;
            if (_closeOutcomes.Count > 0) _closeOutcomes.Dequeue()();
            return System.Reactive.Unit.Default;
        }

        public void SendIntBytes(uint intToSend, short numBytes) { }
        public uint ReadIntBytes(short byteLength) => 0;
        public int Read(byte[] buffer, int offset, int count)
        {
            var toRead = Math.Min(count, _incoming.Count);

            for (var i = 0; i < toRead; i++)
            {
                buffer[offset + i] = _incoming.Dequeue();
            }
            return toRead;
        }
        public int ReadByte() => -1;
        public string ReadSerialAsString(int msToWait = 0) => string.Empty;
        public string ReadAndLogSerialAsString(int msToWait = 0) => string.Empty;
        public byte[] ReadSerialBytes() => [];
        public byte[] ReadSerialBytes(int msToWait = 0) => [];
        /// <summary>Throws immediately (no real waiting) when fewer than <paramref name="numBytes"/> scripted bytes are pending.</summary>
        public void WaitForSerialData(int numBytes, int timeoutMs)
        {
            Calls.Add("Wait");
            if (_waitOutcomes.Count > 0) _waitOutcomes.Dequeue()();

            if (_incoming.Count < numBytes)
            {
                throw new TimeoutException();
            }
        }
        public void SendSignedChar(sbyte charToSend) { }
        public void SendSignedShort(short value) { }

        public string GetEndpoint() => _endpoint ?? string.Empty;
        public ConnectionType GetConnectionType() => ConnectionType;

        public void Dispose() => Disposed = true;
    }
}
