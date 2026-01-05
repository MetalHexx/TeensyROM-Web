using System.Reactive;

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
    void SendSignedChar(sbyte charToSend);
    void SendSignedShort(short value);
  }
}
