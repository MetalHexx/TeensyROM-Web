using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Core.Serial
{
    public interface IDeviceTransportFactory
    {
        /// <summary>
        /// Creates a serial state context based on the Cart's ConnectionType property.
        /// </summary>
        /// <param name="cart">The cart entity containing connection information.</param>
        /// <returns>A configured ISerialStateContext ready for connection.</returns>
        /// <exception cref="ArgumentException">Thrown when ConnectionType is not recognized.</exception>
        ISerialStateContext Create(Cart cart);

        /// <summary>
        /// Creates a serial transport state context for the specified COM port.
        /// </summary>
        /// <param name="portName">The COM port name (e.g., "COM3").</param>
        /// <returns>A configured ISerialStateContext for serial communication.</returns>
        ISerialStateContext CreateSerial(string portName);

        /// <summary>
        /// Creates a TCP transport state context for the specified endpoint.
        /// </summary>
        /// <param name="endpoint">The TCP endpoint in format "ip:port" (e.g., "192.168.1.42:80").</param>
        /// <returns>A configured ISerialStateContext for TCP communication.</returns>
        /// <exception cref="ArgumentException">Thrown when endpoint format is invalid.</exception>
        ISerialStateContext CreateTcp(string endpoint);
    }
}
