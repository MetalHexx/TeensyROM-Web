using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Settings;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Core.Entities.Device
{
    public class TeensyRomDevice
    {
        public Cart Cart { get; private set; }
        public ICommunicationPort CommunicationPort { get; private set; }
        public IStorageService SdStorage { get; private set; }
        public IStorageService UsbStorage { get; private set; }
        public DeviceConnectionRecord Connection { get; }
        public string DeviceId => Cart?.DeviceId ?? string.Empty;
        public string ComPort => CommunicationPort.GetEndpoint();
        public ConnectionType ConnectionType => CommunicationPort.GetConnectionType();
        public string IpAddress
        {
            get
            {
                var endpoint = CommunicationPort.GetEndpoint();
                return endpoint.GetIpAddress();
            }
        }

        public int TcpPort
        {
            get
            {
                var endpoint = CommunicationPort.GetEndpoint();
                return endpoint.GetIpPort();
            }
        }

        public TeensyRomDevice(Cart cart, ICommunicationPort communicationPort, IStorageService sdStorage, IStorageService usbStorage)
            : this(cart, communicationPort, sdStorage, usbStorage, ConfirmedOnPort(cart, communicationPort))
        {
        }

        public TeensyRomDevice(Cart cart, ICommunicationPort communicationPort, IStorageService sdStorage, IStorageService usbStorage, DeviceConnectionRecord connection)
        {
            Cart = cart;
            CommunicationPort = communicationPort;
            SdStorage = sdStorage;
            UsbStorage = usbStorage;
            Connection = connection;
        }

        private static DeviceConnectionRecord ConfirmedOnPort(Cart cart, ICommunicationPort communicationPort)
        {
            var connection = new DeviceConnectionRecord(cart.DeviceId ?? "");
            connection.Confirm(communicationPort.GetConnectionType(), communicationPort.GetEndpoint(), DeviceMode.FullIdle);
            return connection;
        }

        /// <summary>
        /// A version reply with the expected chip ID arrived; keeps <see cref="Cart.IsMinimalFirmware"/>
        /// in step with <see cref="Connection"/>'s mode.
        /// </summary>
        public void Confirm(ConnectionType transport, string endpoint, DeviceMode mode)
        {
            Connection.Confirm(transport, endpoint, mode);
            Cart.IsMinimalFirmware = mode == DeviceMode.Minimal;
        }

        public void MarkBusy() => Connection.MarkBusy();

        public void MarkIdle()
        {
            Connection.MarkIdle();
            Cart.IsMinimalFirmware = false;
        }

        public void MarkUnreachable() => Connection.MarkUnreachable();

        public IStorageService? GetStorage(TeensyStorageType storageType)
        {
            if (storageType is TeensyStorageType.SD) 
            {
                if (!Cart.SdStorage.Available) return null;

                return SdStorage;
            }
            if (storageType is TeensyStorageType.USB)
            {
                if (!Cart.UsbStorage.Available) return null;

                return UsbStorage;
            }
            return null;
        }
    }
}
