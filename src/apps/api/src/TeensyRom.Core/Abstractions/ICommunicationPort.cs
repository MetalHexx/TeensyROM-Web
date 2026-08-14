using System.Reactive;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Abstractions
{
  /// <summary>
  /// Provides an observable interface to a serial port that can be interacted with
  /// </summary>
  public interface ICommunicationPort : IDisposable
  {

    /// <summary>
    /// Number of bytes available to read from the serial port
    /// </summary>
    public int BytesToRead { get; }
    public bool IsOpen { get; }
    
    

    /// <summary>
    /// Clears the input and output buffers of the serial port
    /// </summary>
    void ClearBuffers();

    /// <summary>
    /// Writes text to the serial port
    /// </summary>
    /// <param name="text"></param>
    void Write(string text);

    /// <summary>
    /// Write byte array to serial port
    /// </summary>
    public void Write(byte[] buffer, int offset, int count);

    /// <summary>
    /// Write char buffer to serial port
    /// </summary>        
    public void Write(char[] buffer, int offset, int count);

    /// <summary>
    /// Sets the port to connect to
    /// </summary>
    Unit SetPort(string port);

    /// <summary>
    /// Opens the port with the current set port
    /// </summary>
    /// <param name="useRetryLoop">When true, uses retry logic for stability. When false, attempts single connection for fast discovery.</param>
    /// <returns>
    /// COM port successfully opened
    /// </returns>
    string? OpenPort(bool useRetryLoop = true);

    /// <summary>
    /// Closes the port
    /// </summary>
    Unit ClosePort();

    /// <summary>
    /// Writes an integer value to the serial ports output buffer
    /// </summary>
    /// <param name="intToSend">The integer</param>
    /// <param name="numBytes">The size of the integer in bytes</param>
    void SendIntBytes(uint intToSend, short numBytes);

    /// <summary>
    /// Reads an integer value from the serial port
    /// </summary>
    /// <param name="byteLength">The length of the byte</param>
    /// <returns>The integer value read from the serial port</returns>
    uint ReadIntBytes(short byteLength);

    /// <summary>
    /// Reads the buffer from the serial port
    /// </summary>
    int Read(byte[] buffer, int offset, int count);

    /// <summary>
    /// Reads a byte from the serial port
    /// </summary>        
    int ReadByte();

    /// <summary>
    /// Waits a specified number of milliseconds and then reads the serial port as a string
    /// </summary> 
    string ReadSerialAsString(int msToWait = 0);

    /// <summary>
    /// Waits a specified number of milliseconds and then reads the serial port as a string.
    /// Results also recorded to the output log.
    /// </summary>        
    string ReadAndLogSerialAsString(int msToWait = 0);

    /// <summary>
    /// Reads the serial port as a byte array
    /// </summary>
    byte[] ReadSerialBytes();

    /// <summary>
    /// Waits a specified number of milliseconds and then reads the serial port as bytes
    /// </summary>
    byte[] ReadSerialBytes(int msToWait = 0);

    /// <summary>
    /// Waits for a specified number of bytes to be available to read from the serial port
    /// </summary>
    /// <param name="numBytes"></param>
    /// <param name="timeoutMs">Total time to wait before a timeout exception is thrown</param>
    /// <exception cref="TimeoutException">Thrown if the timeout is reached before the specified number of bytes are available</exception>
    void WaitForSerialData(int numBytes, int timeoutMs);

    /// <summary>
    /// Async counterpart of <see cref="WaitForSerialData"/>. The default implementation observes the
    /// token and then runs <see cref="WaitForSerialData"/> inline on the calling thread, handing back a
    /// completed task - a port with no genuine async transport therefore behaves exactly as its
    /// synchronous self.
    /// </summary>
    /// <param name="numBytes"></param>
    /// <param name="timeoutMs">Total time to wait before a timeout exception is thrown</param>
    /// <param name="ct">Observed before any I/O is attempted</param>
    /// <exception cref="TimeoutException">Thrown if the timeout is reached before the specified number of bytes are available</exception>
    /// <exception cref="OperationCanceledException">Thrown when <paramref name="ct"/> is already cancelled</exception>
    Task WaitForSerialDataAsync(int numBytes, int timeoutMs, CancellationToken ct)
    {
      ct.ThrowIfCancellationRequested();
      WaitForSerialData(numBytes, timeoutMs);
      return Task.CompletedTask;
    }

    /// <summary>
    /// Async counterpart of <see cref="Read"/>. The default implementation observes the token and then
    /// runs <see cref="Read"/> inline on the calling thread, handing back a completed task - a port with
    /// no genuine async transport therefore behaves exactly as its synchronous self.
    /// </summary>
    /// <param name="buffer">Destination for the bytes read</param>
    /// <param name="offset">Offset into <paramref name="buffer"/> to write from</param>
    /// <param name="count">Maximum number of bytes to read</param>
    /// <param name="ct">Observed before any I/O is attempted</param>
    /// <returns>The number of bytes read, which may be fewer than <paramref name="count"/></returns>
    /// <exception cref="OperationCanceledException">Thrown when <paramref name="ct"/> is already cancelled</exception>
    Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken ct)
    {
      ct.ThrowIfCancellationRequested();
      return Task.FromResult(Read(buffer, offset, count));
    }

    void SendSignedChar(sbyte charToSend);
    void SendSignedShort(short value);

    /// <summary>
    /// Gets the current connection endpoint (COM port name or TCP address:port)
    /// </summary>
    /// <returns>COM port name (e.g., "COM3"), TCP endpoint (e.g., "192.168.1.42:80"), or empty string if not set</returns>
    string GetEndpoint();

    /// <summary>
    /// Gets the type of connection (Serial or TCP)
    /// </summary>
    /// <returns>The connection type for this communication port</returns>
    ConnectionType GetConnectionType();
  }
}
