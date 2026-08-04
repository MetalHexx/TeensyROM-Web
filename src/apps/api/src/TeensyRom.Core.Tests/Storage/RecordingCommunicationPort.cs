using System.Reactive;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Serial;

namespace TeensyRom.Core.Tests.Storage;

/// <summary>
/// A small recording stub port driving <see cref="SaveFileCommandHandler"/> directly - tracks the
/// handshake fields, delete calls and body bytes the handler writes, and can be told to throw on a
/// given (1-based) ack call to exercise the retry and delete-then-retry branches.
/// </summary>
internal sealed class RecordingCommunicationPort : ICommunicationPort
{
    private enum Stage { AwaitToken, AwaitLength, AwaitChecksum, AwaitStorageToken, AwaitPath, AwaitBody, AwaitDeleteStorageToken, AwaitDeletePath }

    private Stage _stage = Stage.AwaitToken;
    private uint _pendingLength;
    private ushort _pendingChecksum;
    private uint _pendingStorageToken;
    private string? _pendingPath;
    private List<byte> _pendingBody = [];
    private int _ackCallCount;

    /// <summary>Called with the 1-based ack-read index; a non-null result is thrown from that <see cref="Read"/> call.</summary>
    public Func<int, Exception?>? ExceptionForAckCall { get; set; }

    public int AttemptCount { get; private set; }
    public List<string> DeletedPaths { get; } = [];
    public string? ReceivedTargetPath { get; private set; }
    public uint ReceivedStorageToken { get; private set; }
    public uint ReceivedStreamLength { get; private set; }
    public ushort ReceivedChecksum { get; private set; }
    public byte[] ReceivedBody { get; private set; } = [];

    public bool IsOpen => true;
    public int BytesToRead => 2;

    public void ClearBuffers() { }

    public void SendIntBytes(uint intToSend, short numBytes)
    {
        if (numBytes == 2 && intToSend == TeensyToken.SendFile.Value)
        {
            AttemptCount++;
            _stage = Stage.AwaitLength;
            return;
        }
        if (numBytes == 2 && intToSend == TeensyToken.DeleteFile.Value)
        {
            _stage = Stage.AwaitDeleteStorageToken;
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
    }

    public void Write(string text)
    {
        var path = text.TrimEnd('\0');

        if (_stage == Stage.AwaitPath)
        {
            _pendingPath = path;
            _pendingBody = [];
            _stage = Stage.AwaitBody;
        }
        else if (_stage == Stage.AwaitDeletePath)
        {
            DeletedPaths.Add(path);
            _stage = Stage.AwaitToken;
        }
    }

    public void Write(byte[] buffer, int offset, int count)
    {
        if (_stage != Stage.AwaitBody) return;

        _pendingBody.AddRange(buffer.Skip(offset).Take(count));

        if (_pendingBody.Count >= _pendingLength)
        {
            ReceivedTargetPath = _pendingPath;
            ReceivedStorageToken = _pendingStorageToken;
            ReceivedStreamLength = _pendingLength;
            ReceivedChecksum = _pendingChecksum;
            ReceivedBody = [.. _pendingBody];
            _stage = Stage.AwaitToken;
        }
    }

    public void Write(char[] buffer, int offset, int count) { }

    public uint ReadIntBytes(short byteLength) => 0;

    public int Read(byte[] buffer, int offset, int count)
    {
        _ackCallCount++;
        var ex = ExceptionForAckCall?.Invoke(_ackCallCount);
        if (ex is not null) throw ex;

        var ackBytes = BitConverter.GetBytes(TeensyToken.Ack.Value);
        var toCopy = Math.Min(count, ackBytes.Length);
        Array.Copy(ackBytes, 0, buffer, offset, toCopy);
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
    public string? OpenPort(bool useRetryLoop = true) => "TEST";
    public Unit ClosePort() => Unit.Default;
    public Unit SetPort(string port) => Unit.Default;
    public string GetEndpoint() => "TEST";
    public ConnectionType GetConnectionType() => ConnectionType.Serial;

    public void Dispose() { }
}
