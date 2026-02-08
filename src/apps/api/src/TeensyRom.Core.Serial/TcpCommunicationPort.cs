using System.Diagnostics;
using System.Net.Sockets;
using System.Reactive;
using System.Text;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Serial
{
  public class TcpCommunicationPort(ILoggingService log) : ICommunicationPort
  {
    private TcpClient? _tcpClient;
    private NetworkStream? _networkStream;
    private string? _endpoint;
    private const int _maxEnsureConnectTimeMs = 10000;
    private const int _readTimeoutMs = 500;
    private const int _writeTimeoutMs = 500;

    private readonly Queue<byte> _receiveBuffer = new();
    private readonly object _lockObject = new();

    /// <summary>
    /// Creates a TcpObservablePort from an already-connected TcpClient.
    /// Used for discovery to reuse validated connections without reconnecting.
    /// </summary>
    public TcpCommunicationPort(ILoggingService log, TcpClient connectedClient) : this(log)
    {
      _tcpClient = connectedClient ?? throw new ArgumentNullException(nameof(connectedClient));
      _networkStream = connectedClient.GetStream();
      _networkStream.ReadTimeout = _readTimeoutMs;
      _networkStream.WriteTimeout = _writeTimeoutMs;
      
      if (connectedClient.Client.RemoteEndPoint is System.Net.IPEndPoint remoteEp)
      { 
        var address = remoteEp.Address.IsIPv4MappedToIPv6 
          ? remoteEp.Address.MapToIPv4() 
          : remoteEp.Address;
        _endpoint = $"{address}:{remoteEp.Port}";
      }
    }

    public int BytesToRead => _receiveBuffer.Count + (_networkStream?.DataAvailable == true ? 1 : 0);

    public bool IsOpen => _tcpClient?.Connected == true && _networkStream != null;

    public Unit SetPort(string endpoint)
    {
      if (string.IsNullOrWhiteSpace(endpoint))
      {
        throw new TeensyException("TCP endpoint cannot be empty.");
      }

      if (!NetworkHelper.TryParseEndpoint(endpoint, out var host, out var portNumber))
      {
        throw new TeensyException($"Invalid TCP endpoint format: {endpoint}. Expected format: '192.168.1.42:80'");
      }
      _endpoint = endpoint;
      
      return Unit.Default;
    }

    public string? OpenPort(bool useRetryLoop = true)
    {
      EnsureConnection(useRetryLoop: useRetryLoop);
      return _endpoint;
    }

    public Unit ClosePort()
    {
      log.Internal($"Disconnecting from {_endpoint}.");

      try
      {
        if (_tcpClient != null && _tcpClient.Connected)
        {
          _networkStream?.Close();
          _networkStream?.Dispose();
          _networkStream = null;
          _tcpClient.Close();
        }
        log.InternalSuccess($"Successfully disconnected from {_endpoint}.");
      }
      catch (Exception ex)
      {
        log.InternalError($"Error during TCP disconnect: {ex.Message}");
      }

      return Unit.Default;
    }

    public void EnsureConnection(int waitTimeMs = 200, bool useRetryLoop = true)
    {
      if (IsOpen) return;

      var sw = Stopwatch.StartNew();
      ClosePort();

      if (!NetworkHelper.TryParseEndpoint(_endpoint!, out var host, out var port))
      {
        throw new TeensyException($"Invalid endpoint format: {_endpoint}");
      }

      _tcpClient = new TcpClient
      {
        ReceiveTimeout = _readTimeoutMs,
        SendTimeout = _writeTimeoutMs
      };

      if (!useRetryLoop)
      {
        TryConnect(host, port);
      }

      while (useRetryLoop && !IsOpen && sw.ElapsedMilliseconds < _maxEnsureConnectTimeMs)
      {
        if (TryConnect(host, port)) break;
      }

      if (!IsOpen)
      {
        _networkStream?.Dispose();
        _tcpClient?.Close();
        log.InternalError($"TcpObservablePort.EnsureConnection: Failed to connect to {_endpoint} after {sw.ElapsedMilliseconds}ms");
        throw new TimeoutException($"Connection to {_endpoint} timed out after {_maxEnsureConnectTimeMs}ms");
      }
      log.Internal($"TcpObservablePort.EnsureConnection: Reconnect time: {sw.Elapsed.TotalMilliseconds}ms");
    }

    private bool TryConnect(string host, int port)
    {
      try
      {
        var logMessage = $"TcpObservablePort.TryConnect: Connecting to {_endpoint}";

        log.Internal(logMessage);

        _tcpClient!.Connect(host, port);
        _networkStream = _tcpClient!.GetStream();
        _networkStream!.ReadTimeout = _readTimeoutMs;
        _networkStream.WriteTimeout = _writeTimeoutMs;

        log.InternalSuccess($"TcpObservablePort.TryConnect: Successfully connected to {_endpoint}");
        return true;
      }
      catch (Exception ex)
      {
        log.InternalError($"TcpObservablePort.TryConnect: There was an error trying to connect to {_endpoint}");
        throw;
      }
    }

    public void Write(string text)
    {
      if (!IsOpen || _networkStream == null)
        throw new TeensyException("Cannot write: TCP connection is not open");

      var buffer = Encoding.UTF8.GetBytes(text);
      Write(buffer, 0, buffer.Length);
    }

    public void Write(byte[] buffer, int offset, int count)
    {
      if (!IsOpen || _networkStream == null)
        throw new TeensyException("Cannot write: TCP connection is not open");

      try
      {
        _networkStream.Write(buffer, offset, count);
        _networkStream.Flush();
      }
      catch (IOException ex)
      {
        throw new TeensyException("TCP connection lost during write", ex);
      }
      catch (SocketException ex)
      {
        throw new TeensyException("Socket error during write", ex);
      }
    }

    public void Write(char[] buffer, int offset, int count)
    {
      var byteBuffer = Encoding.UTF8.GetBytes(buffer, offset, count);
      Write(byteBuffer, 0, byteBuffer.Length);
    }

    public int Read(byte[] buffer, int offset, int count)
    {
      if (_networkStream == null)
        throw new TeensyException("Cannot read: TCP connection is not open");

      try
      {
        int bytesRead = 0;

        lock (_lockObject)
        {
          while (_receiveBuffer.Count > 0 && bytesRead < count)
          {
            buffer[offset + bytesRead] = _receiveBuffer.Dequeue();
            bytesRead++;
          }
        }

        if (bytesRead < count)
        {
          int streamRead = _networkStream.Read(buffer, offset + bytesRead, count - bytesRead);
          bytesRead += streamRead;
        }

        return bytesRead;
      }
      catch (IOException ex)
      {
        var errorMessage = GetBufferContentsAsString(buffer, offset, count);
        throw new TeensyException(errorMessage, ex);
      }
      catch (SocketException ex)
      {
        var errorMessage = GetBufferContentsAsString(buffer, offset, count);
        throw new TeensyException(errorMessage, ex);
      }
    }

    private string GetBufferContentsAsString(byte[] buffer, int offset, int count)
    {
      try
      {
        if (buffer != null && count > 0)
        {
          var actualBytes = Math.Min(count, buffer.Length - offset);
          var bufferSegment = new byte[actualBytes];
          Array.Copy(buffer, offset, bufferSegment, 0, actualBytes);
          
          var bufferString = Encoding.UTF8.GetString(bufferSegment);
          return bufferString;
        }
        return "TCP connection error";
      }
      catch
      {
        return "TCP connection error - failed to read buffer";
      }
    }

    public int ReadByte()
    {
      if (_networkStream == null)
        throw new TeensyException("Cannot read: TCP connection is not open");

      lock (_lockObject)
      {
        if (_receiveBuffer.Count > 0)
        {
          return _receiveBuffer.Dequeue();
        }
      }
      return _networkStream.ReadByte();
    }

    public string ReadSerialAsString(int msToWait = 0)
    {
      Thread.Sleep(msToWait);

      if (_networkStream == null || !IsOpen)
        return string.Empty;

      // Read() handles both _receiveBuffer and network stream automatically
      var buffer = new byte[4096];

      int bytesRead = Read(buffer, 0, buffer.Length);
      if (bytesRead > 0)
      {
        var receivedData = new byte[bytesRead];
        Array.Copy(buffer, 0, receivedData, 0, bytesRead);
        var dataString = receivedData.ToUtf8();
        return string.IsNullOrWhiteSpace(dataString) ? string.Empty : dataString;
      }
      return string.Empty;
    }

    public string ReadAndLogSerialAsString(int msToWait = 0)
        => ReadSerialAsString(msToWait);

    public byte[] ReadSerialBytes()
    {
      if (BytesToRead == 0)
        return Array.Empty<byte>();

      var data = new byte[BytesToRead];
      Read(data, 0, data.Length);
      return data;
    }

    public byte[] ReadSerialBytes(int msToWait = 0)
    {
      Thread.Sleep(msToWait);

      if (BytesToRead == 0)
        return Array.Empty<byte>();

      byte[] receivedData = new byte[BytesToRead];
      Read(receivedData, 0, receivedData.Length);

      return receivedData;
    }

    public void SendIntBytes(uint intToSend, short numBytes)
    {
      var bytesToSend = BitConverter.GetBytes(intToSend);

      for (short byteNum = (short)(numBytes - 1); byteNum >= 0; byteNum--)
      {
        Write(bytesToSend, byteNum, 1);
      }
    }

    public uint ReadIntBytes(short byteLength)
    {
      if (IsOpen && BytesToRead == 0)
      {
        WaitForSerialData(byteLength, timeoutMs: 500);
      }

      byte[] receivedBytes = new byte[byteLength];
      int bytesReadTotal = 0;

      while (bytesReadTotal < byteLength)
      {
        int bytesRead = Read(receivedBytes, bytesReadTotal, byteLength - bytesReadTotal);
        if (bytesRead == 0)
        {
          throw new TimeoutException("Timeout while reading bytes from TCP stream.");
        }
        bytesReadTotal += bytesRead;
      }

      uint result = 0;

      for (short byteNum = 0; byteNum < byteLength; byteNum++)
      {
        result |= (uint)(receivedBytes[byteNum] << (8 * byteNum));
      }

      return result;
    }

    public void SendSignedChar(sbyte charToSend)
    {
      byte[] byteToSend = { (byte)charToSend };
      Write(byteToSend, 0, 1);
    }
    public void SendSignedShort(short value)
    {
      byte highByte = (byte)((value >> 8) & 0xFF);
      byte lowByte = (byte)(value & 0xFF);

      Write([highByte], 0, 1);
      Write([lowByte], 0, 1);
    }

    public void WaitForSerialData(int numBytes, int timeoutMs)
    {
      var sw = Stopwatch.StartNew();

      while (sw.ElapsedMilliseconds < timeoutMs)
      {
        // First check if we have enough in the buffer
        lock (_lockObject)
        {
          if (_receiveBuffer.Count >= numBytes)
          {
            sw.Stop();
            return;
          }

          if (_networkStream != null && _networkStream.DataAvailable)
          {
            var tempBuffer = new byte[4096];
            int bytesRead = _networkStream.Read(tempBuffer, 0, tempBuffer.Length);
            for (int i = 0; i < bytesRead; i++)
            {
              _receiveBuffer.Enqueue(tempBuffer[i]);
            }

            if (_receiveBuffer.Count >= numBytes)
            {
              sw.Stop();
              return;
            }
          }
        }

        Thread.Sleep(10);
      }

      throw new TimeoutException("Timed out waiting for data to be received");
    }

    public void ClearBuffers()
    {
      lock (_lockObject)
      {
        _receiveBuffer.Clear();
      }

      try
      {
        if (_networkStream != null && _networkStream.DataAvailable)
        {
          var discardBuffer = new byte[4096];
          while (_networkStream.DataAvailable)
          {
            _networkStream.ReadExactly(discardBuffer);
          }
        }
      }
      catch { }
    }

    public string GetEndpoint()
    {
      return _endpoint ?? string.Empty;
    }

    public ConnectionType GetConnectionType()
    {
      return ConnectionType.Tcp;
    }

    public void Dispose()
    {
      lock (_lockObject)
      {
        _receiveBuffer.Clear();
      }
      ClosePort();
      _tcpClient?.Dispose();      
    }
  }
}
