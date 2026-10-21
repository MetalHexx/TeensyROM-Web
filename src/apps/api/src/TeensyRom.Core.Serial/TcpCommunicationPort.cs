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

    /// <remarks>
    /// Keep-alive probes are empty ACKs answered by the unit's network stack; they never reach the
    /// firmware's service loop, so they cannot take its single client slot. The idle time sits above the
    /// longest silence a healthy link has in normal use (a reset waits up to 45 s for the menu to boot,
    /// <c>HandleAck</c> up to 20 s), so a stack that stops answering ACKs for a moment during the menu's
    /// network set-up does not get a healthy link killed mid-reset. A dead idle link is marked dead within
    /// ~75 s (60 s idle + 3 probes at 5 s).
    /// </remarks>
    private const int _keepAliveIdleSeconds = 60;
    private const int _keepAliveIntervalSeconds = 5;
    private const int _keepAliveProbeCount = 3;

    private const string _closedByPeerMessage = "The TeensyROM closed the connection.";

    private readonly Queue<byte> _receiveBuffer = new();
    private readonly object _lockObject = new();
    private long _bytesWritten;
    private bool _keepAliveTimingFailureLogged;

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
      ConfigureKeepAlive(connectedClient.Client);

      if (connectedClient.Client.RemoteEndPoint is System.Net.IPEndPoint remoteEp)
      { 
        var address = remoteEp.Address.IsIPv4MappedToIPv6 
          ? remoteEp.Address.MapToIPv4() 
          : remoteEp.Address;
        _endpoint = $"{address}:{remoteEp.Port}";
      }
    }

    public int BytesToRead => _receiveBuffer.Count + (_networkStream?.DataAvailable == true ? 1 : 0);

    /// <summary>
    /// True while the connection is up. A connection the unit closed or reset reads as closed: .NET's own
    /// <see cref="TcpClient.Connected"/> only learns of that on the next I/O, so the socket is also polled
    /// (a local, non-blocking check that sends and consumes nothing).
    /// </summary>
    public bool IsOpen => _tcpClient?.Connected == true && _networkStream != null && !PeerHasClosed();

    public long? BytesWritten => _bytesWritten;

    /// <summary>
    /// True when the peer has closed or reset the connection and no unread data remains. A readable
    /// socket with nothing available is an orderly close or a reset. A socket closed locally or disposed
    /// reads as closed.
    /// </summary>
    private bool PeerHasClosed()
    {
      try
      {
        var socket = _tcpClient?.Client;
        return socket == null || (socket.Poll(0, SelectMode.SelectRead) && socket.Available == 0);
      }
      catch (SocketException)
      {
        return true;
      }
      catch (ObjectDisposedException)
      {
        return true;
      }
    }

    private void ConfigureKeepAlive(Socket socket)
    {
      try
      {
        socket.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.KeepAlive, true);
      }
      catch (SocketException ex)
      {
        log.Internal($"TcpObservablePort: could not enable TCP keep-alive: {ex.Message}");
        return;
      }

      try
      {
        socket.SetSocketOption(SocketOptionLevel.Tcp, SocketOptionName.TcpKeepAliveTime, _keepAliveIdleSeconds);
        socket.SetSocketOption(SocketOptionLevel.Tcp, SocketOptionName.TcpKeepAliveInterval, _keepAliveIntervalSeconds);
        socket.SetSocketOption(SocketOptionLevel.Tcp, SocketOptionName.TcpKeepAliveRetryCount, _keepAliveProbeCount);
      }
      catch (Exception ex) when (ex is SocketException or PlatformNotSupportedException)
      {
        if (_keepAliveTimingFailureLogged) return;

        _keepAliveTimingFailureLogged = true;
        log.Internal($"TcpObservablePort: keep-alive timings not applied, using the OS defaults: {ex.Message}");
      }
    }

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

    /// <summary>
    /// A single connect attempt bounded to <paramref name="connectTimeoutMs"/>, via <see cref="TcpClient.ConnectAsync(string, int, CancellationToken)"/>
    /// awaited synchronously - this port is a synchronous object. A connect that does not complete in
    /// time is cancelled and surfaces as a <see cref="TimeoutException"/> rather than the OS's own
    /// multi-second SYN retry.
    /// </summary>
    public string? OpenPort(int connectTimeoutMs)
    {
      if (IsOpen) return _endpoint;

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

      using var cts = new CancellationTokenSource(connectTimeoutMs);

      try
      {
        log.Internal($"TcpObservablePort.OpenPort: Connecting to {_endpoint} (bounded, {connectTimeoutMs}ms)");
        _tcpClient.ConnectAsync(host, port, cts.Token).AsTask().GetAwaiter().GetResult();
        _networkStream = _tcpClient.GetStream();
        _networkStream.ReadTimeout = _readTimeoutMs;
        _networkStream.WriteTimeout = _writeTimeoutMs;
        ConfigureKeepAlive(_tcpClient.Client);
        log.InternalSuccess($"TcpObservablePort.OpenPort: Successfully connected to {_endpoint}");
      }
      catch (OperationCanceledException)
      {
        log.Internal($"TcpObservablePort.OpenPort: Connect to {_endpoint} did not complete within {connectTimeoutMs}ms");
        _tcpClient?.Close();
        throw new TimeoutException($"Connection to {_endpoint} timed out after {connectTimeoutMs}ms");
      }
      catch (Exception)
      {
        log.Internal($"TcpObservablePort.OpenPort: There was an error trying to connect to {_endpoint}");
        _tcpClient?.Close();
        throw;
      }

      return _endpoint;
    }

    public Unit ClosePort()
    {
      log.Internal($"Disconnecting from {_endpoint}.");

      try
      {
        // Release the client even when .NET already marked it not connected, or it leaks with its stream.
        if (_tcpClient != null)
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
        ConfigureKeepAlive(_tcpClient.Client);

        log.InternalSuccess($"TcpObservablePort.TryConnect: Successfully connected to {_endpoint}");
        return true;
      }
      catch (Exception)
      {
        // Polling connect misses are expected here (discovery's fast single-attempt scan and the
        // retry loop both call this repeatedly), so a miss is not error-worthy on its own.
        log.Internal($"TcpObservablePort.TryConnect: There was an error trying to connect to {_endpoint}");
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

      // Counted before the write: a write that throws may still have put bytes on the wire.
      _bytesWritten += count;

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

        // Like SerialPort.Read: once buffered bytes are in hand, take only what the socket already
        // holds. Blocking for the remainder would wait out the read timeout and discard what was read.
        if (bytesRead < count && (bytesRead == 0 || _networkStream.DataAvailable))
        {
          int streamRead = _networkStream.Read(buffer, offset + bytesRead, count - bytesRead);
          if (streamRead == 0 && bytesRead == 0) throw EndOfStream();
          bytesRead += streamRead;
        }

        return bytesRead;
      }
      catch (IOException ex)
      {
        throw ReadFailure(ex);
      }
      catch (SocketException ex)
      {
        throw ReadFailure(ex);
      }
    }

    private static TeensyException EndOfStream() =>
      new("TCP connection lost during read", new IOException(_closedByPeerMessage));

    /// <summary>
    /// The stream's read timeout is a slow device, not a lost link; every other I/O failure is a lost link.
    /// </summary>
    private static Exception ReadFailure(Exception ex) =>
      ex is IOException { InnerException: SocketException { SocketErrorCode: SocketError.TimedOut } }
        ? new TimeoutException("The TeensyROM did not answer in time.", ex)
        : new TeensyException("TCP connection lost during read", ex);

    /// <summary>
    /// Async counterpart of <see cref="Read"/>. Drains the receive buffer first and, exactly like
    /// <see cref="Read"/>, goes to the socket for the remainder only when nothing was buffered or the
    /// socket already holds more - at most a single stream read - so it may return fewer than
    /// <paramref name="count"/> bytes.
    /// </summary>
    public async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken ct)
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

        if (bytesRead < count && (bytesRead == 0 || _networkStream.DataAvailable))
        {
          int streamRead = await _networkStream.ReadAsync(buffer.AsMemory(offset + bytesRead, count - bytesRead), ct);
          if (streamRead == 0 && bytesRead == 0) throw EndOfStream();
          bytesRead += streamRead;
        }

        return bytesRead;
      }
      catch (IOException ex)
      {
        throw ReadFailure(ex);
      }
      catch (SocketException ex)
      {
        throw ReadFailure(ex);
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

      if (_networkStream == null)
        return string.Empty;

      // A link the unit closed is a drop, not an empty reply: a ping must not read it as success.
      bool nothingBuffered;
      lock (_lockObject) nothingBuffered = _receiveBuffer.Count == 0;
      if (nothingBuffered && PeerHasClosed())
        throw new IOException(_closedByPeerMessage);

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

        // The peer is gone and what it sent is not enough: no more will come, so do not spin out the timeout.
        if (_networkStream != null && PeerHasClosed())
          throw new IOException(_closedByPeerMessage);

        Thread.Sleep(10);
      }

      throw new TimeoutException("Timed out waiting for data to be received");
    }

    /// <summary>
    /// Async counterpart of <see cref="WaitForSerialData"/>. Awaits the socket rather than polling it,
    /// so a caller waiting on the device does not hold a thread. <paramref name="timeoutMs"/> is enforced
    /// by a linked token: its expiry surfaces as a <see cref="TimeoutException"/> while a cancel of
    /// <paramref name="ct"/> surfaces as an <see cref="OperationCanceledException"/>.
    /// </summary>
    /// <exception cref="TimeoutException">Thrown if the timeout is reached before the specified number of bytes are available</exception>
    /// <exception cref="IOException">Thrown at once if the peer closes the connection</exception>
    public async Task WaitForSerialDataAsync(int numBytes, int timeoutMs, CancellationToken ct)
    {
      lock (_lockObject)
      {
        if (_receiveBuffer.Count >= numBytes) return;
      }

      using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
      cts.CancelAfter(timeoutMs);

      var stream = _networkStream;

      try
      {
        if (stream == null)
        {
          // The synchronous wait has no null-stream guard - it polls until the timeout and throws - so
          // with nothing to read, wait the linked token out and let it surface as the same timeout.
          await Task.Delay(Timeout.Infinite, cts.Token);
          return;
        }

        var tempBuffer = new byte[4096];

        while (true)
        {
          int bytesRead = await stream.ReadAsync(tempBuffer.AsMemory(0, tempBuffer.Length), cts.Token);

          // A zero-length read means the peer closed the connection.
          if (bytesRead == 0) throw new IOException(_closedByPeerMessage);

          lock (_lockObject)
          {
            for (int i = 0; i < bytesRead; i++)
            {
              _receiveBuffer.Enqueue(tempBuffer[i]);
            }

            if (_receiveBuffer.Count >= numBytes) return;
          }
        }
      }
      catch (OperationCanceledException)
      {
        if (ct.IsCancellationRequested) throw;

        throw new TimeoutException("Timed out waiting for data to be received");
      }
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
          // Only what the socket already holds: ReadExactly waited out the read timeout for a full
          // 4096 bytes whenever fewer were stale, and threw.
          var discardBuffer = new byte[4096];
          while (_networkStream.DataAvailable)
          {
            if (_networkStream.Read(discardBuffer, 0, discardBuffer.Length) == 0) break;
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
