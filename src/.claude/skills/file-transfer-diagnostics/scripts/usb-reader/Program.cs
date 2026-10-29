// Downloads one file from a TeensyROM over USB with nothing but .NET's SerialPort, opened with the engine's
// settings and read back to back, so a loss it sees cannot come from the engine. The engine must be stopped.
// Usage: dotnet run -c Release -- <COM12> <device path> <local copy> [runs]
// Each run reports whether the body (plus the closing Ack) arrived whole, and where any bytes went missing.
using System.Diagnostics;
using System.IO.Ports;
using System.Text;

if (args.Length < 3)
{
    Console.Error.WriteLine("usage: <COM port> <device path> <local copy> [runs]");
    return 2;
}

var (portName, devicePath, localPath) = (args[0], args[1], args[2]);
var runs = args.Length > 3 ? int.Parse(args[3]) : 20;
var expected = File.ReadAllBytes(localPath);
const int StallMs = 5_000, ChecksumWaitMs = 20_000, MaxReadBytes = 65_536;
byte[] Ack = [0xCC, 0x64];

using var port = new SerialPort(portName)
{
    Encoding = Encoding.UTF8,
    BaudRate = 115200,
    DtrEnable = true,
    WriteTimeout = 10_000,
};
port.Open();
Console.WriteLine($"{portName} open; {runs} runs of {devicePath} ({expected.Length:N0} bytes)");

var whole = 0;
for (var run = 1; run <= runs; run++)
{
    port.DiscardInBuffer();
    port.DiscardOutBuffer();

    try
    {
        port.Write([0x64, 0xB0], 0, 2); // GetFile token, high byte first
        ExpectAck("token");
        port.Write([0x01, .. Encoding.Latin1.GetBytes(devicePath), 0x00], 0, devicePath.Length + 2); // SD + path
        ExpectAck("path");

        var length = (int)ReadU32(StallMs);
        ReadU32(ChecksumWaitMs); // the firmware sums the whole file before sending this

        // Body and the closing Ack, read back to back with the timeout set once.
        var received = new byte[length + 2];
        var got = 0;
        var clock = Stopwatch.StartNew();
        port.ReadTimeout = StallMs;
        try
        {
            while (got < received.Length)
            {
                got += port.Read(received, got, Math.Min(received.Length - got, MaxReadBytes));
            }
        }
        catch (TimeoutException) { }
        var bodyMs = clock.ElapsedMilliseconds - (got < received.Length ? StallMs : 0);

        var missing = received.Length - got;
        var endsWithAck = got >= 2 && received[got - 2] == Ack[0] && received[got - 1] == Ack[1];
        if (missing == 0 && received.AsSpan(0, length).SequenceEqual(expected) && endsWithAck)
        {
            whole++;
            Console.WriteLine($"run {run,2}  whole   body {bodyMs} ms");
        }
        else
        {
            Console.WriteLine($"run {run,2}  SHORT   body {bodyMs} ms, got {got:N0} of {received.Length:N0} (missing {missing:N0}), ends with Ack: {endsWithAck}, gaps: {Gaps(received, got)}");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"run {run,2}  ERROR   {ex.GetType().Name}: {ex.Message}");
    }

    Thread.Sleep(500);
}

Console.WriteLine($"TOTAL {whole}/{runs} whole");
return 0;

void ReadExactly(byte[] buffer, int timeoutMs)
{
    port.ReadTimeout = timeoutMs;
    var got = 0;
    while (got < buffer.Length)
    {
        got += port.Read(buffer, got, buffer.Length - got);
    }
}

void ExpectAck(string after)
{
    var reply = new byte[2];
    ReadExactly(reply, StallMs);
    if (!reply.AsSpan().SequenceEqual(Ack))
    {
        throw new InvalidOperationException($"expected Ack after the {after}, got {reply[0]:x2} {reply[1]:x2}");
    }
}

uint ReadU32(int timeoutMs)
{
    var bytes = new byte[4];
    ReadExactly(bytes, timeoutMs);
    return BitConverter.ToUInt32(bytes); // little-endian, low byte first
}

// Walks the received bytes against the original. At each mismatch, finds how far ahead in the original
// the received bytes pick up again (in whole 512-byte packets), and reports where and how much went missing.
string Gaps(byte[] received, int got)
{
    var gaps = new List<string>();
    var shift = 0;
    var i = 0;
    while (i < got - 2 && i + shift < expected.Length)
    {
        if (received[i] == expected[i + shift]) { i++; continue; }

        var found = false;
        for (var skip = 512; skip <= 64 * 512 && i + shift + skip < expected.Length; skip += 512)
        {
            var window = Math.Min(4096, Math.Min(got - 2 - i, expected.Length - (i + shift + skip)));
            if (window > 0 && received.AsSpan(i, window).SequenceEqual(expected.AsSpan(i + shift + skip, window)))
            {
                gaps.Add($"{i + shift:N0} (+{skip:N0}, file offset mod 2048 = {(i + shift) % 2048})");
                shift += skip;
                found = true;
                break;
            }
        }
        if (!found)
        {
            gaps.Add($"{i + shift:N0} (no realignment found)");
            break;
        }
    }
    return gaps.Count == 0 ? "none found" : string.Join("; ", gaps);
}
