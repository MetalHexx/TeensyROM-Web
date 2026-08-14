using System.Reactive;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Serial;

namespace TeensyRom.Core.Tests.Storage;

/// <summary>
/// One file received by a <see cref="RecordingCommunicationPort"/>, as declared by the sender's
/// handshake and the body bytes actually written.
/// </summary>
internal sealed record RecordedFile(string Path, uint StorageToken, uint StreamLength, ushort Checksum, byte[] Body);

/// <summary>
/// A small recording stub port driving <see cref="TransferFilesCommandHandler"/> directly - tracks the
/// handshake fields, delete calls and body bytes the handler writes for every file in a batch, and can
/// be told to throw on a given (1-based, batch-wide) ack call or for a specific target path, to exercise
/// the retry, delete-then-retry, and device-loss branches. <see cref="ClosePort"/> flips
/// <see cref="IsOpen"/> false so a <see cref="FailFor"/> callback can simulate the device vanishing
/// mid-write the same way a real port would.
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
    private bool _isOpen = true;

    /// <summary>Called with the 1-based ack-read index spanning the whole batch; a non-null result is thrown from that <see cref="Read"/> call.</summary>
    public Func<int, Exception?>? ExceptionForAckCall { get; set; }

    /// <summary>Called with the target path about to be sent; a non-null result is thrown from that file's <see cref="Write(string)"/> call, mirroring FakeCommunicationPort.FailFor.</summary>
    public Func<string, Exception?>? FailFor { get; set; }

    public int AttemptCount { get; private set; }
    public List<string> DeletedPaths { get; } = [];
    public List<RecordedFile> Received { get; } = [];

    public bool IsOpen => _isOpen;
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
            Received.Add(new RecordedFile(_pendingPath!, _pendingStorageToken, _pendingLength, _pendingChecksum, [.. _pendingBody]));
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
    public string? OpenPort(bool useRetryLoop = true)
    {
        _isOpen = true;
        return "TEST";
    }

    public Unit ClosePort()
    {
        _isOpen = false;
        return Unit.Default;
    }

    public Unit SetPort(string port) => Unit.Default;
    public string GetEndpoint() => "TEST";
    public ConnectionType GetConnectionType() => ConnectionType.Serial;

    public void Dispose() { }
}
