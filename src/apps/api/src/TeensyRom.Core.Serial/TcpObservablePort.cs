using System.Diagnostics;
using System.Net.Sockets;
using System.Reactive;
using System.Reactive.Linq;
using System.Reactive.Subjects;
using System.Text;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial.State;

namespace TeensyRom.Core.Serial
{
    public class TcpObservablePort(ILoggingService log) : IObservableSerialPort
    {
        public IObservable<string[]> Ports => _ports.AsObservable();
        public IObservable<Type> State => _state.AsObservable();

        private readonly BehaviorSubject<string[]> _ports = new(Array.Empty<string>());
        private readonly BehaviorSubject<Type> _state = new(typeof(SerialStartState));

        private TcpClient? _tcpClient;
        private NetworkStream? _networkStream;
        private string? _endpoint;

        private const int _connectionTimeoutMs = 100;
        private const int _readTimeoutMs = 1000;
        private const int _writeTimeoutMs = 1000;

        private readonly Queue<byte> _receiveBuffer = new();
        private readonly object _lockObject = new();

        public int BytesToRead => _receiveBuffer.Count + (_networkStream?.DataAvailable == true ? 1 : 0);

        public bool IsOpen => _tcpClient?.Connected == true && _networkStream != null && IsConnectionActuallyHealthy();

        private bool IsConnectionActuallyHealthy()
        {
            if (_tcpClient == null || _networkStream == null)
                return false;

            if (!_tcpClient.Connected)
                return false;

            try
            {
                // Check if the socket is writable - this is the real test of connection health
                // Using NetworkStream.CanWrite which checks the actual socket state
                return _networkStream.CanWrite;
            }
            catch (ObjectDisposedException)
            {
                return false;
            }
            catch (IOException)
            {
                return false;
            }
        }

        public Unit SetPort(string port)
        {
            if (string.IsNullOrWhiteSpace(port))
            {
                throw new TeensyException("TCP endpoint cannot be empty.");
            }

            if (!NetworkHelper.TryParseEndpoint(port, out var host, out var portNumber))
            {
                throw new TeensyException($"Invalid TCP endpoint format: {port}. Expected format: '192.168.1.42:80'");
            }

            _endpoint = port;
            _state.OnNext(typeof(SerialConnectableState));

            log.Internal($"TCP endpoint set to: {_endpoint}");
            return Unit.Default;
        }

        public string? OpenPort()
        {
            EnsureConnection();
            return _endpoint;
        }

        public Unit ClosePort()
        {
            StopHealthCheck();
            log.Internal($"Disconnecting from {_endpoint}.");

            try
            {
                Lock();

                if (_tcpClient != null && _tcpClient.Connected)
                {
                    _networkStream?.Close();
                    _tcpClient.Close();
                }

                _state.OnNext(typeof(SerialConnectableState));
                log.InternalSuccess($"Successfully disconnected from {_endpoint}.");
            }
            catch (Exception ex)
            {
                log.InternalError($"Error during TCP disconnect: {ex.Message}");
            }

            return Unit.Default;
        }

        public void EnsureConnection(int waitTimeMs = 200)
        {
            // If already open and healthy, return
            if (IsOpen) return;

            log.Internal($"TcpObservablePort.EnsureConnection: Connecting to {_endpoint}");

            try
            {
                if (!NetworkHelper.TryParseEndpoint(_endpoint!, out var host, out var port))
                {
                    throw new TeensyException($"Invalid endpoint format: {_endpoint}");
                }

                _tcpClient = new TcpClient
                {
                    ReceiveTimeout = _readTimeoutMs,
                    SendTimeout = _writeTimeoutMs
                };

                var timeoutTask = Task.Delay(_connectionTimeoutMs);
                var connectTask = _tcpClient.ConnectAsync(host, port);

                var completedTask = Task.WhenAny(connectTask, timeoutTask).Result;

                if (completedTask == timeoutTask)
                {
                    _tcpClient?.Close();
                    throw new TimeoutException($"Connection to {_endpoint} timed out after {_connectionTimeoutMs}ms");
                }

                if (_tcpClient!.Connected == false)
                {
                    throw new TeensyException($"Unable to connect to {_endpoint}");
                }

                _networkStream = _tcpClient.GetStream();
                _networkStream!.ReadTimeout = _readTimeoutMs;
                _networkStream.WriteTimeout = _writeTimeoutMs;

                _state.OnNext(typeof(SerialConnectedState));
                log.InternalSuccess($"TcpObservablePort.EnsureConnection: Successfully connected to {_endpoint}");
            }
            catch (Exception ex)
            {
                _state.OnNext(typeof(SerialConnectionLostState));
                log.InternalError($"TcpObservablePort.EnsureConnection: {ex.Message}");
                throw;
            }
        }

        public void Lock()
        {
            // No-op for TCP
        }

        public void Unlock()
        {
            // No-op for TCP
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
                _state.OnNext(typeof(SerialConnectionLostState));
                throw new TeensyException("TCP connection lost during write", ex);
            }
            catch (SocketException ex)
            {
                _state.OnNext(typeof(SerialConnectionLostState));
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
                _state.OnNext(typeof(SerialConnectionLostState));
                throw new TeensyException("TCP connection lost during read", ex);
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

            try
            {
                return _networkStream.ReadByte();
            }
            catch (IOException ex)
            {
                _state.OnNext(typeof(SerialConnectionLostState));
                throw new TeensyException("TCP connection lost during read", ex);
            }
        }

        public string ReadSerialAsString(int msToWait = 0)
        {
            Thread.Sleep(msToWait);

            if (_networkStream == null || !IsOpen)
                return string.Empty;

            // Read() handles both _receiveBuffer and network stream automatically
            var buffer = new byte[4096];
            try
            {
                int bytesRead = Read(buffer, 0, buffer.Length);
                if (bytesRead > 0)
                {
                    var receivedData = new byte[bytesRead];
                    Array.Copy(buffer, 0, receivedData, 0, bytesRead);
                    var dataString = receivedData.ToUtf8();
                    return string.IsNullOrWhiteSpace(dataString) ? string.Empty : dataString;
                }
            }
            catch (IOException)
            {
                // Connection error
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
                if (_receiveBuffer.Count >= numBytes)
                {
                    sw.Stop();
                    return;
                }

                // If not, try to read from network stream into buffer
                if (_networkStream != null && _networkStream.DataAvailable)
                {
                    lock (_lockObject)
                    {
                        // Read all available data into buffer
                        var tempBuffer = new byte[4096];
                        int bytesRead = _networkStream.Read(tempBuffer, 0, tempBuffer.Length);
                        for (int i = 0; i < bytesRead; i++)
                        {
                            _receiveBuffer.Enqueue(tempBuffer[i]);
                        }
                    }

                    // Check again after buffering
                    if (_receiveBuffer.Count >= numBytes)
                    {
                        sw.Stop();
                        return;
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

        public string? StartHealthCheck()
        {
            try
            {
                EnsureConnection();

                if (IsOpen)
                {
                    _state.OnNext(typeof(SerialConnectedState));
                }
                else
                {
                    _state.OnNext(typeof(SerialConnectionLostState));
                }
            }
            catch (Exception) { }

            return null;
        }

        public void StopHealthCheck()
        {
            EnsureConnection();
        }

        public void StartPortPoll()
        {
        }

        public void Dispose()
        {
            if (IsOpen)
            {
                ClosePort();
            }

            _tcpClient?.Dispose();
            _networkStream?.Dispose();
            _ports?.Dispose();

            lock (_lockObject)
            {
                _receiveBuffer.Clear();
            }
        }
    }
}
