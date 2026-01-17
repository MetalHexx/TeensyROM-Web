using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Core.Serial
{
    public interface IDeviceTransportFactory
    {
        /// <summary>
        /// Creates a serial state context based on the device's ConnectionType property.
        /// </summary>
        /// <param name="device">The TeensyRomDevice containing connection information.</param>
        /// <returns>A configured ISerialStateContext ready for connection.</returns>
        /// <exception cref="ArgumentException">Thrown when ConnectionType is not recognized.</exception>
        ICommunicationPort Create(TeensyRomDevice device);

        /// <summary>
        /// Creates a serial transport state context for the specified COM port.
        /// </summary>
        /// <param name="portName">The COM port name (e.g., "COM3").</param>
        /// <returns>A configured ISerialStateContext for serial communication.</returns>
        ICommunicationPort CreateSerial(string portName);

        /// <summary>
        /// Creates a TCP transport state context for the specified endpoint.
        /// </summary>
        /// <param name="endpoint">The TCP endpoint in format "ip:port" (e.g., "192.168.1.42:80").</param>
        /// <returns>A configured ISerialStateContext for TCP communication.</returns>
        /// <exception cref="ArgumentException">Thrown when endpoint format is invalid.</exception>
        ICommunicationPort CreateTcp(string endpoint);
    }
}
