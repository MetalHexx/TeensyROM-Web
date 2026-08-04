using System.Collections.Concurrent;
using System.Reactive;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Serial;

namespace TeensyRom.Api.Tests.Integration.Common
{
    /// <summary>
    /// One file received by a <see cref="FakeCommunicationPort"/>, as declared by the sender's
    /// handshake and the body bytes actually written.
    /// </summary>
    public sealed record FakeReceivedFile(string Path, uint StorageToken, uint DeclaredLength, ushort DeclaredChecksum, byte[] Body);

    /// <summary>
    /// A hardware-free <see cref="ICommunicationPort"/> that speaks just enough of the wire protocol to
    /// satisfy <c>CommunicationPortBehavior</c>'s pre-handler firmware/busy checks and the SendFile /
    /// DeleteFile handshake, recording every file it "receives" for test assertions.
    /// </summary>
    public sealed class FakeCommunicationPort : ICommunicationPort
    {
        private enum Stage { AwaitToken, AwaitLength, AwaitChecksum, AwaitStorageToken, AwaitPath, AwaitBody, AwaitDeleteStorageToken, AwaitDeletePath }

        private readonly object _gate = new();
        private readonly ConcurrentQueue<FakeReceivedFile> _received = new();

        private Stage _stage = Stage.AwaitToken;
        private uint _pendingLength;
        private ushort _pendingChecksum;
        private uint _pendingStorageToken;
        private string? _pendingPath;
        private List<byte> _pendingBody = [];
        private ushort _nextTwoByteResponse = TeensyToken.Ack.Value;

        /// <summary>Applied while a file body is being written - the knob the concurrency proof turns.</summary>
        public TimeSpan PerFileDelay { get; set; } = TimeSpan.Zero;

        /// <summary>When set, invoked with the target path of an incoming SendFile write; a non-null result is thrown.</summary>
        public Func<string, Exception?>? FailFor { get; set; }

        /// <summary>When true, every command the device would otherwise acknowledge fails as if the device vanished mid-command.</summary>
        public bool SimulateDeviceLoss { get; set; }

        public IReadOnlyList<FakeReceivedFile> Received => [.. _received];

        public bool IsOpen => true;
        public int BytesToRead => 2;

        public void ClearBuffers() { }

        public void SendIntBytes(uint intToSend, short numBytes)
        {
            if (SimulateDeviceLoss)
            {
                throw new IOException("Fake device connection lost.");
            }

            lock (_gate)
            {
                if (numBytes == 2 && intToSend == TeensyToken.FwCheckToken.Value)
                {
                    _nextTwoByteResponse = TeensyToken.FWFullToken.Value;
                    return;
                }
                if (numBytes == 2 && intToSend == TeensyToken.Ping.Value)
                {
                    return;
                }
                if (numBytes == 2 && intToSend == TeensyToken.SendFile.Value)
                {
                    _stage = Stage.AwaitLength;
                    _nextTwoByteResponse = TeensyToken.Ack.Value;
                    return;
                }
                if (numBytes == 2 && intToSend == TeensyToken.DeleteFile.Value)
                {
                    _stage = Stage.AwaitDeleteStorageToken;
                    _nextTwoByteResponse = TeensyToken.Ack.Value;
                    return;
                }

                switch (_stage)
                {
                    case Stage.AwaitLength:
                        _pendingLength = intToSend;
                        _stage = Stage.AwaitChecksum;
                        break;
                    case Stage.AwaitChecksum:
                        _pendingChecksum = (ushort)intToSend;
                        _stage = Stage.AwaitStorageToken;
                        break;
                    case Stage.AwaitStorageToken:
                        _pendingStorageToken = intToSend;
                        _stage = Stage.AwaitPath;
                        break;
                    case Stage.AwaitDeleteStorageToken:
                        _stage = Stage.AwaitDeletePath;
                        break;
                }
                _nextTwoByteResponse = TeensyToken.Ack.Value;
            }
        }

        public void Write(string text)
        {
            lock (_gate)
            {
                var path = text.TrimEnd('\0');

                if (_stage == Stage.AwaitPath)
                {
                    if (FailFor?.Invoke(path) is Exception ex)
                    {
                        _stage = Stage.AwaitToken;
                        throw ex;
                    }
                    _pendingPath = path;
                    _pendingBody = [];
                    _stage = Stage.AwaitBody;
                }
                else if (_stage == Stage.AwaitDeletePath)
                {
                    _stage = Stage.AwaitToken;
                }
            }
        }

        public void Write(byte[] buffer, int offset, int count)
        {
            List<byte>? completedBody = null;
            uint length = 0, storageToken = 0;
            ushort checksum = 0;
            string? path = null;

            lock (_gate)
            {
                if (_stage != Stage.AwaitBody) return;

                _pendingBody.AddRange(buffer.Skip(offset).Take(count));

                if (_pendingBody.Count >= _pendingLength)
                {
                    completedBody = _pendingBody;
                    length = _pendingLength;
                    storageToken = _pendingStorageToken;
                    checksum = _pendingChecksum;
                    path = _pendingPath;
                    _stage = Stage.AwaitToken;
                }
            }

            if (completedBody is null || path is null) return;

            if (PerFileDelay > TimeSpan.Zero)
            {
                Thread.Sleep(PerFileDelay);
            }

            _received.Enqueue(new FakeReceivedFile(path, storageToken, length, checksum, [.. completedBody]));
        }

        public void Write(char[] buffer, int offset, int count) { }

        public uint ReadIntBytes(short byteLength) => 0;

        public int Read(byte[] buffer, int offset, int count)
        {
            ushort response;
            lock (_gate)
            {
                response = _nextTwoByteResponse;
            }
            var bytes = BitConverter.GetBytes(response);
            var toCopy = Math.Min(count, bytes.Length);
            Array.Copy(bytes, 0, buffer, offset, toCopy);
            return toCopy;
        }

        public int ReadByte() => -1;
        public string ReadSerialAsString(int msToWait = 0) => string.Empty;
        public string ReadAndLogSerialAsString(int msToWait = 0) => string.Empty;
        public byte[] ReadSerialBytes() => [];
        public byte[] ReadSerialBytes(int msToWait = 0) => [];
        public void WaitForSerialData(int numBytes, int timeoutMs) { }
        public void SendSignedChar(sbyte charToSend) { }
        public void SendSignedShort(short value) { }
        public string? OpenPort(bool useRetryLoop = true) => "FAKE0";
        public Unit ClosePort() => Unit.Default;
        public Unit SetPort(string port) => Unit.Default;
        public string GetEndpoint() => "FAKE0";
        public ConnectionType GetConnectionType() => ConnectionType.Serial;

        public void Dispose() { }
    }
}
