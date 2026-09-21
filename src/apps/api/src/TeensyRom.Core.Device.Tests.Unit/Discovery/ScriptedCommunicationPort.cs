using System.Text;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Serial;

namespace TeensyRom.Core.Device.Tests.Unit.Discovery;

/// <summary>
/// A hardware-free <see cref="ICommunicationPort"/> whose replies are scripted as segments - one
/// segment per device command - because <c>ReadTextUntilIdle</c> reads until the port goes quiet, and
/// a single flat queue would let one routine's reply swallow the bytes scripted for the next routine.
/// Models the serial port's exact-count <see cref="BytesToRead"/>: only "WaitForSerialData then Read
/// BytesToRead" is relied upon, so code exercised against this fake behaves the same on TCP.
/// Copied rather than shared: test projects do not reference each other.
/// </summary>
public sealed class ScriptedCommunicationPort : ICommunicationPort
{
    private readonly Queue<Queue<byte>> _segments = new();
    private readonly List<byte> _written = [];
    private Queue<byte>? _authoringSegment;
    private Queue<byte>? _currentSegment;

    /// <summary>Every byte the code under test wrote, in order.</summary>
    public IReadOnlyList<byte> Written => _written;

    /// <summary>True once <see cref="Dispose"/> has been called.</summary>
    public bool Disposed { get; private set; }

    /// <summary>Starts the next command's reply. A single-command test can skip this and call <see cref="Enqueue"/> directly.</summary>
    public ScriptedCommunicationPort NewSegment()
    {
        _authoringSegment = new Queue<byte>();
        _segments.Enqueue(_authoringSegment);
        return this;
    }

    public ScriptedCommunicationPort Enqueue(params byte[] bytes)
    {
        if (_authoringSegment is null)
        {
            NewSegment();
        }

        foreach (var b in bytes)
        {
            _authoringSegment!.Enqueue(b);
        }
        return this;
    }

    /// <summary>Enqueues a device->host token, low byte first, matching firmware's <c>SendU16</c>.</summary>
    public ScriptedCommunicationPort EnqueueToken(TeensyToken token) =>
        Enqueue((byte)(token.Value & 0xFF), (byte)(token.Value >> 8));

    public ScriptedCommunicationPort EnqueueText(string text) =>
        Enqueue(Encoding.Latin1.GetBytes(text));

    public int BytesToRead => _currentSegment?.Count ?? 0;

    /// <summary>Defaults to an open/connected port.</summary>
    public bool IsOpen { get; set; } = true;

    /// <summary>Nothing is readable until the first call: discards whatever remains of the current segment and makes the next segment current.</summary>
    public void ClearBuffers() => _currentSegment = _segments.Count > 0 ? _segments.Dequeue() : new Queue<byte>();

    public void Write(string text) => _written.AddRange(Encoding.Latin1.GetBytes(text));
    public void Write(byte[] buffer, int offset, int count) { }
    public void Write(char[] buffer, int offset, int count) { }

    // Fully qualified: a bare "Unit" is ambiguous whenever a caller's usings also bring in MediatR.
    public System.Reactive.Unit SetPort(string port) => System.Reactive.Unit.Default;
    public string? OpenPort(bool useRetryLoop = true) => null;
    public System.Reactive.Unit ClosePort() => System.Reactive.Unit.Default;

    /// <summary>Mirrors the real port: writes the most-significant byte first.</summary>
    public void SendIntBytes(uint intToSend, short numBytes)
    {
        var bytes = BitConverter.GetBytes(intToSend);
        for (var i = (short)(numBytes - 1); i >= 0; i--)
        {
            _written.Add(bytes[i]);
        }
    }

    public uint ReadIntBytes(short byteLength) => 0;

    public int Read(byte[] buffer, int offset, int count)
    {
        if (_currentSegment is null)
        {
            return 0;
        }

        var toRead = Math.Min(count, _currentSegment.Count);
        for (var i = 0; i < toRead; i++)
        {
            buffer[offset + i] = _currentSegment.Dequeue();
        }
        return toRead;
    }

    public int ReadByte() => -1;

    public string ReadSerialAsString(int msToWait = 0) => DrainCurrentSegmentAsText();
    public string ReadAndLogSerialAsString(int msToWait = 0) => DrainCurrentSegmentAsText();

    public byte[] ReadSerialBytes() => [];
    public byte[] ReadSerialBytes(int msToWait = 0) => [];

    /// <summary>Throws immediately (no real waiting) when the current segment holds fewer than <paramref name="numBytes"/> bytes.</summary>
    public void WaitForSerialData(int numBytes, int timeoutMs)
    {
        if (BytesToRead < numBytes)
        {
            throw new TimeoutException();
        }
    }

    public void SendSignedChar(sbyte charToSend) { }
    public void SendSignedShort(short value) { }

    public string GetEndpoint() => string.Empty;
    public ConnectionType GetConnectionType() => ConnectionType.Serial;

    public void Dispose() => Disposed = true;

    private string DrainCurrentSegmentAsText()
    {
        if (_currentSegment is null || _currentSegment.Count == 0)
        {
            return string.Empty;
        }

        var bytes = _currentSegment.ToArray();
        _currentSegment.Clear();
        return Encoding.Latin1.GetString(bytes).Replace("\0", string.Empty);
    }
}
