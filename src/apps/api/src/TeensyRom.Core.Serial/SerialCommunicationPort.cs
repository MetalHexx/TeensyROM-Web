using System.IO.Ports;
using System.Reactive;
using System.Reactive.Linq;
using System.Text;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Serial
{
  public class SerialCommunicationPort(ILoggingService log) : ICommunicationPort
  {
    /// <remarks>
    /// DTR off by default. Both TeensyROM images call Teensy 4's <c>Serial.begin()</c> at boot, which
    /// blocks until the host asserts DTR (up to 2 s once USB is enumerated) - so a port proven a
    /// TeensyROM by USB vendor/product wants DTR asserted, or a reboot holds twice (once in each image).
    /// But asserting DTR is also how a terminal resets an Arduino-style board, and this port is opened
    /// for any COM name a caller hands it - including, on a shared host, one that is not a TeensyROM at
    /// all. Asserting DTR unconditionally would reset that foreign board for no reason the caller asked
    /// for, so DTR only ever comes on when <see cref="SetPort(string, bool)"/> is told the port is a
    /// TeensyROM, and stays set until a later <see cref="SetPort(string, bool)"/> names another port.
    /// </remarks>
    private readonly SerialPort _serialPort = new()
    {
      Encoding = Encoding.UTF8,
      BaudRate = 115200,
      DtrEnable = false,
      WriteTimeout = WriteTimeoutMs
    };

    /// <summary>
    /// The most one read in <see cref="ReadExactlyAsync"/> asks the driver for. Asked for a whole
    /// multi-megabyte file in one read, the USB serial driver loses packets of it.
    /// </summary>
    public const int MaxReadBytes = 65_536;

    /// <summary>
    /// How long a write may wait for the device to drain the USB buffer. The default is infinite, so a device
    /// that stops reading parked its transfer thread in <see cref="SerialPort.Write(byte[], int, int)"/> for
    /// good. A normal chunk drains in milliseconds; reads are left unbounded on purpose.
    /// </summary>
    public const int WriteTimeoutMs = 10_000;

    private long _bytesWritten;

    public int BytesToRead => _serialPort.BytesToRead;
    public bool IsOpen => _serialPort.IsOpen;
    public void ClearBuffers() => _serialPort.ClearBuffers();
    public int Read(byte[] buffer, int offset, int count) => _serialPort.Read(buffer, offset, count);
    public string ReadAndLogSerialAsString(int msToWait = 0) => ReadSerialAsString(msToWait);
    public int ReadByte() => _serialPort.ReadByte();
    public uint ReadIntBytes(short byteLength) => _serialPort.ReadIntBytes(byteLength);
    public string ReadSerialAsString(int msToWait = 0) => _serialPort.ReadSerialAsString(msToWait);
    public byte[] ReadSerialBytes() => _serialPort.ReadSerialBytes();
    public byte[] ReadSerialBytes(int msToWait = 0) => _serialPort.ReadSerialBytes(msToWait);
    public void WaitForSerialData(int numBytes, int timeoutMs) => _serialPort.WaitForSerialData(numBytes, timeoutMs);

    /// <summary>
    /// Reads back to back, with the read timeout set to <paramref name="stallMs"/> once for the whole
    /// reply and restored once at the end. <see cref="WaitForSerialData"/> polls and sleeps 10 ms between
    /// checks, and over USB a port left unread while the device streams a file loses whole packets of it,
    /// so nothing runs between one read and the next but the cancellation check. A read already waiting
    /// cannot be cancelled; <paramref name="stallMs"/> bounds it.
    /// </summary>
    /// <exception cref="TeensyReadStalledException">Thrown if no byte arrives within <paramref name="stallMs"/></exception>
    public Task ReadExactlyAsync(byte[] buffer, int offset, int count, int stallMs, CancellationToken ct)
    {
      var start = offset;
      var end = offset + count;

      _serialPort.ReadTimeout = stallMs;
      try
      {
        while (offset < end)
        {
          ct.ThrowIfCancellationRequested();
          offset += _serialPort.Read(buffer, offset, Math.Min(end - offset, MaxReadBytes));
        }
      }
      catch (TimeoutException ex)
      {
        throw ICommunicationPort.Stalled(offset - start, count, stallMs, ex);
      }
      finally
      {
        _serialPort.ReadTimeout = SerialPort.InfiniteTimeout;
      }
      return Task.CompletedTask;
    }

    public long? BytesWritten => _bytesWritten;

    // Each write wrapper counts before delegating: SendIntBytes writes a byte at a time, so a count taken
    // afterwards would miss a partial write that threw.
    public void SendIntBytes(uint intToSend, short numBytes)
    {
      _bytesWritten += numBytes;
      GuardWrite(() => _serialPort.SendIntBytes(intToSend, numBytes));
    }

    public void SendSignedChar(sbyte charToSend)
    {
      _bytesWritten += 1;
      GuardWrite(() => _serialPort.SendSignedChar(charToSend));
    }

    public void SendSignedShort(short value)
    {
      _bytesWritten += 2;
      GuardWrite(() => _serialPort.SendSignedShort(value));
    }

    public void Write(string text)
    {
      _bytesWritten += Encoding.UTF8.GetByteCount(text);
      GuardWrite(() => _serialPort.Write(text));
    }

    public void Write(byte[] buffer, int offset, int count)
    {
      _bytesWritten += count;
      GuardWrite(() => _serialPort.Write(buffer, offset, count));
    }

    public void Write(char[] buffer, int offset, int count)
    {
      _bytesWritten += count;
      GuardWrite(() => _serialPort.Write(buffer, offset, count));
    }

    /// <summary>
    /// Turns the serial port's own write timeout into <see cref="TeensyWriteTimeoutException"/>, which names the
    /// port and still counts as a <see cref="TimeoutException"/> to the command pipeline's link recovery.
    /// </summary>
    private void GuardWrite(Action write)
    {
      try
      {
        write();
      }
      catch (TimeoutException ex)
      {
        throw new TeensyWriteTimeoutException($"Write to {_serialPort.PortName} timed out after {WriteTimeoutMs} ms", ex);
      }
    }

    public Unit SetPort(string port) => SetPort(port, isTeensyRomPort: false);

    public Unit SetPort(string port, bool isTeensyRomPort)
    {
      if (string.IsNullOrWhiteSpace(port))
      {
        throw new TeensyException("Port cannot be empty.");
      }
      var ports = SerialPort.GetPortNames();

      if (!ports.Contains(port))
      {
        throw new TeensyException("The set port is currently unavailable");
      }
      _serialPort.PortName = port;
      _serialPort.DtrEnable = isTeensyRomPort;

      return Unit.Default;
    }

    public string? OpenPort(bool useRetryLoop = true)
    {
      // useRetryLoop is a no-op here: EnsureConnection always makes a single attempt.
      EnsureConnection();
      return _serialPort.PortName;
    }

    public Unit ClosePort()
    {
      log.Internal($"Disconnecting from {_serialPort.PortName}.");

      if (_serialPort.IsOpen) _serialPort.Close();

      log.InternalSuccess($"Successfully disconnected from {_serialPort.PortName}.");

      return Unit.Default;
    }

    private void EnsureConnection()
    {
      if (_serialPort.IsOpen) return;

      if (_serialPort.IsOpen) _serialPort.Close();

      log.Internal($"ObservableSerialPort.EnsureConnection: Attempting to open {_serialPort.PortName}");

      var failureMessage = $"ObservableSerialPort.EnsureConnection: Unable to connect to {_serialPort.PortName}";

      try
      {
        _serialPort.Open();
      }
      catch (UnauthorizedAccessException)
      {
        log.InternalError(failureMessage);
        throw;
      }
      catch (Exception)
      {
        log.ExternalError(failureMessage);
        throw new TeensyException(failureMessage);
      }
      if (!_serialPort.IsOpen)
      {
        log.ExternalError(failureMessage);
        throw new TeensyException(failureMessage);
      }

      log.InternalSuccess($"ObservableSerialPort.EnsureConnection: Successfully connected to {_serialPort.PortName}");

      return;
    }

    public string GetEndpoint()
    {
      return _serialPort.PortName ?? string.Empty;
    }

    public ConnectionType GetConnectionType()
    {
      return ConnectionType.Serial;
    }

    public void Dispose()
    {
      if (_serialPort.IsOpen) _serialPort.Close();

      _serialPort?.Dispose();
    }


  }
}
