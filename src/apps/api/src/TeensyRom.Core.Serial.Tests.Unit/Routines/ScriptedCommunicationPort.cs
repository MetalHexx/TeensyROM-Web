using System.Text;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Core.Serial.Tests.Unit.Routines
{
    /// <summary>
    /// A hardware-free <see cref="ICommunicationPort"/> whose replies are scripted as segments - one
    /// segment per device command - because <c>ReadTextUntilIdle</c> reads until the port goes quiet, and
    /// a single flat queue would let one routine's reply swallow the bytes scripted for the next routine.
    /// Models the serial port's exact-count <see cref="BytesToRead"/>: only "WaitForSerialData then Read
    /// BytesToRead" is relied upon, so code exercised against this fake behaves the same on TCP.
    /// </summary>
    public sealed class ScriptedCommunicationPort : ICommunicationPort
    {
        private readonly Queue<Queue<byte>> _segments = new();
        private readonly Queue<(int QuietMs, byte[] Bytes)> _lateArrivals = new();
        private readonly List<byte> _written = [];
        private Queue<byte>? _authoringSegment;
        private Queue<byte>? _currentSegment;
        private Exception? _scriptedReadException;

        /// <summary>Every byte the code under test wrote, in order.</summary>
        public IReadOnlyList<byte> Written => _written;

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

        /// <summary>
        /// Scripts bytes the device only sends after <paramref name="quietMs"/> of silence - the shape of
        /// the C64 menu's boot SID token, which lands well after the reset text has gone quiet. They
        /// become readable inside <see cref="WaitForSerialData"/>, and only when the caller gave that wait
        /// a budget long enough to cover the gap, so a routine that stops reading too early misses them.
        /// Virtual time: no test actually sleeps.
        /// </summary>
        public ScriptedCommunicationPort EnqueueAfterQuiet(int quietMs, params byte[] bytes)
        {
            _lateArrivals.Enqueue((quietMs, bytes));
            return this;
        }

        /// <summary>Late-arriving device->host token, low byte first - see <see cref="EnqueueAfterQuiet"/>.</summary>
        public ScriptedCommunicationPort EnqueueTokenAfterQuiet(int quietMs, TeensyToken token) =>
            EnqueueAfterQuiet(quietMs, (byte)(token.Value & 0xFF), (byte)(token.Value >> 8));

        /// <summary>Arms a one-shot exception thrown by the next <see cref="ReadSerialBytes(int)"/> call, then clears itself.</summary>
        public ScriptedCommunicationPort ThrowOnNextRead(Exception exception)
        {
            _scriptedReadException = exception;
            return this;
        }

        public int BytesToRead => _currentSegment?.Count ?? 0;

        /// <summary>Defaults to an open/connected port; a test scripts <see langword="false"/> to model an already-dropped transport.</summary>
        public bool IsOpen { get; set; } = true;

        /// <summary>Nothing is readable until the first call: discards whatever remains of the current segment and makes the next segment current.</summary>
        public void ClearBuffers() => _currentSegment = _segments.Count > 0 ? _segments.Dequeue() : new Queue<byte>();

        public void Write(string text) => _written.AddRange(Encoding.Latin1.GetBytes(text));
        public void Write(byte[] buffer, int offset, int count) { }
        public void Write(char[] buffer, int offset, int count) { }

        // Fully qualified: this file's namespace ends in ".Unit", which shadows the System.Reactive.Unit
        // type import when referenced unqualified.
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

        /// <summary>
        /// Drains whatever remains of the current segment. When the current segment is exhausted and
        /// another is queued, this call advances to it (mirroring a device that answers on a later poll
        /// tick) and returns empty - the newly-current segment's bytes are read on the next call.
        /// </summary>
        public byte[] ReadSerialBytes(int msToWait = 0)
        {
            if (_scriptedReadException is not null)
            {
                var exception = _scriptedReadException;
                _scriptedReadException = null;
                throw exception;
            }

            if ((_currentSegment is null || _currentSegment.Count == 0) && _segments.Count > 0)
            {
                _currentSegment = _segments.Dequeue();
                return [];
            }

            if (_currentSegment is null || _currentSegment.Count == 0)
            {
                return [];
            }

            var bytes = _currentSegment.ToArray();
            _currentSegment.Clear();
            return bytes;
        }

        /// <summary>
        /// Returns as soon as the current segment holds <paramref name="numBytes"/> bytes. Otherwise it
        /// advances virtual time by <paramref name="timeoutMs"/> and delivers any late arrival whose quiet
        /// gap fits inside that budget; nothing left to deliver in time is a timeout, thrown immediately
        /// so no test spends real seconds waiting.
        /// </summary>
        public void WaitForSerialData(int numBytes, int timeoutMs)
        {
            if (BytesToRead >= numBytes)
            {
                return;
            }

            if (_lateArrivals.Count > 0 && _lateArrivals.Peek().QuietMs <= timeoutMs)
            {
                var (_, bytes) = _lateArrivals.Dequeue();
                _currentSegment ??= new Queue<byte>();

                foreach (var b in bytes)
                {
                    _currentSegment.Enqueue(b);
                }

                if (BytesToRead >= numBytes)
                {
                    return;
                }
            }

            throw new TimeoutException();
        }

        public void SendSignedChar(sbyte charToSend) { }
        public void SendSignedShort(short value) { }

        public string GetEndpoint() => string.Empty;
        public ConnectionType GetConnectionType() => ConnectionType.Serial;

        public void Dispose() { }

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
}
