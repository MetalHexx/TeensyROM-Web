using System.IO.Ports;
using System.Reactive;
using System.Reactive.Linq;
using System.Text;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Serial
{
  public class SerialCommunicationPort(ILoggingService log) : ICommunicationPort
  {
    private readonly SerialPort _serialPort = new()
    {
      Encoding = Encoding.UTF8,
      BaudRate = 115200
    };

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
    public void SendIntBytes(uint intToSend, short numBytes) => _serialPort.SendIntBytes(intToSend, numBytes);
    public void SendSignedChar(sbyte charToSend) => _serialPort.SendSignedChar(charToSend);
    public void SendSignedShort(short value) => _serialPort.SendSignedShort(value);
    public void WaitForSerialData(int numBytes, int timeoutMs) => _serialPort.WaitForSerialData(numBytes, timeoutMs);
    public void Write(string text) => _serialPort.Write(text);
    public void Write(byte[] buffer, int offset, int count) => _serialPort.Write(buffer, offset, count);
    public void Write(char[] buffer, int offset, int count) => _serialPort.Write(buffer, offset, count);

    public Unit SetPort(string port)
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

      return Unit.Default;
    }

    public string? OpenPort(bool useRetryLoop = true)
    {
      // Parameter ignored for now - will be implemented later
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
      catch (UnauthorizedAccessException ex)
      {
        log.InternalError(failureMessage);
        log.InternalError("ObservableSerialPort.EnsureConnection: Make sure you don't have multiple TeensyROM API instances running!");
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
