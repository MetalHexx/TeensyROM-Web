using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Logging;
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

        public ICommunicationPort Create(TeensyRomDevice device)
        {
            return device.ConnectionType switch
            {
                ConnectionType.Serial => CreateSerial(device.ComPort),
                ConnectionType.Tcp => CreateTcp($"{device.IpAddress}:{device.TcpPort}"),
                _ => throw new ArgumentException($"Unknown ConnectionType: {device.ConnectionType}", nameof(device))
            };
        }

        public ICommunicationPort CreateSerial(string portName)
        {
            var serialPort = new SerialCommunicationPort(_log);
            serialPort.SetPort(portName);
            return serialPort;
        }

        public ICommunicationPort CreateTcp(string endpoint)
        {
            if (!NetworkHelper.TryParseEndpoint(endpoint, out var host, out var port))
            {
                throw new ArgumentException($"Invalid TCP endpoint format: {endpoint}. Expected format: '192.168.1.42:80'", nameof(endpoint));
            }

            var tcpPort = new TcpCommunicationPort(_log);
            tcpPort.SetPort(endpoint);
            return tcpPort;
        }
    }
}
