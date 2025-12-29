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
        private IDisposable? _dataReceptionSubscription;

        public int BytesToRead => _receiveBuffer.Count;

        public bool IsOpen => _tcpClient?.Connected == true && _networkStream != null;

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
            if (IsOpen) return;

            Lock();

            if (_tcpClient != null && _tcpClient.Connected)
            {
                _tcpClient.Close();
            }

            log.Internal($"TcpObservablePort.EnsureConnection: Attempting to connect to {_endpoint}");

            var failureMessage = $"TcpObservablePort.EnsureConnection: Unable to connect to {_endpoint}";

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
                    throw new TeensyException(failureMessage);
                }

                _networkStream = _tcpClient.GetStream();
                _networkStream!.ReadTimeout = _readTimeoutMs;
                _networkStream.WriteTimeout = _writeTimeoutMs;

                log.InternalSuccess($"TcpObservablePort.EnsureConnection: Successfully connected to {_endpoint}");

                Unlock();
                return;
            }
            catch (AggregateException ex) when (ex.InnerException is SocketException)
            {
                log.ExternalError(failureMessage);
                throw new TeensyException(failureMessage, ex.InnerException);
            }
            catch (SocketException ex)
            {
                log.ExternalError(failureMessage);
                throw new TeensyException(failureMessage, ex);
            }
            catch (TimeoutException ex)
            {
                log.ExternalError(failureMessage);
                throw new TeensyException(failureMessage, ex);
            }
            catch (Exception ex)
            {
                log.ExternalError(failureMessage);
                throw new TeensyException(failureMessage, ex);
            }
        }

        public void Lock()
        {
            ClearBuffers();
            _dataReceptionSubscription?.Dispose();
            _dataReceptionSubscription = null;
        }

        public void Unlock()
        {
            _dataReceptionSubscription?.Dispose();

            _dataReceptionSubscription = Observable
                .Interval(TimeSpan.FromMilliseconds(50))
                .SelectMany(_ => Observable.FromAsync(async token =>
                {
                    try
                    {
                        if (!IsOpen || _networkStream == null)
                        {
                            return Array.Empty<byte>();
                        }

                        if (_networkStream.DataAvailable)
                        {
                            var buffer = new byte[4096];
                            var bytesRead = await _networkStream.ReadAsync(buffer, 0, buffer.Length, token);

                            if (bytesRead > 0)
                            {
                                var receivedData = buffer.Take(bytesRead).ToArray();

                                lock (_lockObject)
                                {
                                    foreach (var b in receivedData)
                                    {
                                        _receiveBuffer.Enqueue(b);
                                    }
                                }

                                return receivedData;
                            }
                        }
                        return [];
                    }
                    catch (IOException)
                    {
                        return [];
                    }
                    catch (OperationCanceledException)
                    {
                        return [];
                    }
                }))
                .Where(bytes => bytes.Length > 0)
                .Select(bytes => bytes.ToLogString())
                .Where(logEntry => !string.IsNullOrWhiteSpace(logEntry))
                .Publish()
                .RefCount()
                .Subscribe(logs => log.External(logs));
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

            if (BytesToRead == 0)
                return string.Empty;

            byte[] receivedData = new byte[BytesToRead];
            Read(receivedData, 0, receivedData.Length);

            var dataString = receivedData.ToUtf8();

            return string.IsNullOrWhiteSpace(dataString) ? string.Empty : dataString;
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
                if (BytesToRead >= numBytes)
                {
                    sw.Stop();
                    return;
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
            _dataReceptionSubscription?.Dispose();

            lock (_lockObject)
            {
                _receiveBuffer.Clear();
            }
        }
    }
}
