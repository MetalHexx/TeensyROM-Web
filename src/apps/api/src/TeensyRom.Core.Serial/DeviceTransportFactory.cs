using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial.State;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Serial
{
    public class DeviceTransportFactory : IDeviceTransportFactory
    {
        private readonly ILoggingService _log;
        private readonly IAlertService _alert;

        public DeviceTransportFactory(ILoggingService log, IAlertService alert)
        {
            _log = log;
            _alert = alert;
        }

        public ISerialStateContext Create(Cart cart)
        {
            return cart.ConnectionType switch
            {
                ConnectionType.Serial => CreateSerial(cart.ComPort),
                ConnectionType.Tcp => CreateTcp($"{cart.IpAddress}:{cart.TcpPort}"),
                _ => throw new ArgumentException($"Unknown ConnectionType: {cart.ConnectionType}", nameof(cart))
            };
        }

        public ISerialStateContext CreateSerial(string portName)
        {
            var serial = new SimpleObservableSerialPort(_log, _alert);
            var context = new SerialStateContext(serial, _log);
            serial.SetPort(portName);
            return context;
        }

        public ISerialStateContext CreateTcp(string endpoint)
        {
            if (!NetworkHelper.TryParseEndpoint(endpoint, out var host, out var port))
            {
                throw new ArgumentException($"Invalid TCP endpoint format: {endpoint}. Expected format: '192.168.1.42:80'", nameof(endpoint));
            }

            var tcpPort = new TcpObservablePort(_log);
            var context = new SerialStateContext(tcpPort, _log);
            tcpPort.SetPort(endpoint);
            return context;
        }
    }
}
