using FluentAssertions;
using NSubstitute;
using TeensyRom.Api.Endpoints.FindCarts;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Settings;
using Xunit;

namespace TeensyRom.Api.Tests.Integration.Serial
{
    public class FindDevicesEndpointTests
    {
        [Fact]
        public async Task FindDevices_WhenDeviceFullyIndexed_ReturnsIndexExistsTrue()
        {
            // Arrange
            var deviceId = "test-device-001";
            var deviceSettings = new DeviceSettings
            {
                DeviceId = deviceId,
                IndexingStatus = new IndexingStatus
                {
                    SdLastIndexed = DateTime.UtcNow.AddDays(-1),
                    UsbLastIndexed = DateTime.UtcNow.AddDays(-2)
                }
            };

            var mockSettingsProvider = Substitute.For<IDeviceSettingsProvider>();
            mockSettingsProvider.GetDeviceSettings(deviceId).Returns(deviceSettings);

            var mockDevice = CreateMockDevice(deviceId, hasSd: true, hasUsb: true);
            var mockDeviceManager = Substitute.For<IDeviceConnectionManager>();
            mockDeviceManager.FindDevices(false, Arg.Any<CancellationToken>(), false).Returns([mockDevice]);

            var endpoint = new FindDevicesEndpoint(mockDeviceManager, mockSettingsProvider);

            // Act
            await endpoint.Handle(new FindDevicesRequest(), CancellationToken.None);
            var response = endpoint.Response;

            // Assert
            response.Should().NotBeNull();
            response!.Devices.Should().HaveCount(1);
            
            var device = response.Devices.First();
            device.SdStorage.IndexExists.Should().BeTrue();
            device.UsbStorage.IndexExists.Should().BeTrue();
        }

        [Fact]
        public async Task FindDevices_WhenDeviceNotIndexed_ReturnsIndexExistsFalse()
        {
            // Arrange
            var deviceId = "test-device-002";
            var deviceSettings = new DeviceSettings
            {
                DeviceId = deviceId,
                IndexingStatus = new IndexingStatus
                {
                    SdLastIndexed = null,
                    UsbLastIndexed = null
                }
            };

            var mockSettingsProvider = Substitute.For<IDeviceSettingsProvider>();
            mockSettingsProvider.GetDeviceSettings(deviceId).Returns(deviceSettings);

            var mockDevice = CreateMockDevice(deviceId, hasSd: true, hasUsb: true);
            var mockDeviceManager = Substitute.For<IDeviceConnectionManager>();
            mockDeviceManager.FindDevices(false, Arg.Any<CancellationToken>(), false).Returns([mockDevice]);

            var endpoint = new FindDevicesEndpoint(mockDeviceManager, mockSettingsProvider);

            // Act
            await endpoint.Handle(new FindDevicesRequest(), CancellationToken.None);
            var response = endpoint.Response;

            // Assert
            response.Should().NotBeNull();
            response!.Devices.Should().HaveCount(1);
            
            var device = response.Devices.First();
            device.SdStorage.IndexExists.Should().BeFalse();
            device.UsbStorage.IndexExists.Should().BeFalse();
        }

        [Fact]
        public async Task FindDevices_WhenOnlySdIndexed_ReturnsMixedIndexExists()
        {
            // Arrange
            var deviceId = "test-device-003";
            var deviceSettings = new DeviceSettings
            {
                DeviceId = deviceId,
                IndexingStatus = new IndexingStatus
                {
                    SdLastIndexed = DateTime.UtcNow.AddDays(-1),
                    UsbLastIndexed = null
                }
            };

            var mockSettingsProvider = Substitute.For<IDeviceSettingsProvider>();
            mockSettingsProvider.GetDeviceSettings(deviceId).Returns(deviceSettings);

            var mockDevice = CreateMockDevice(deviceId, hasSd: true, hasUsb: true);
            var mockDeviceManager = Substitute.For<IDeviceConnectionManager>();
            mockDeviceManager.FindDevices(false, Arg.Any<CancellationToken>(), false).Returns([mockDevice]);

            var endpoint = new FindDevicesEndpoint(mockDeviceManager, mockSettingsProvider);

            // Act
            await endpoint.Handle(new FindDevicesRequest(), CancellationToken.None);
            var response = endpoint.Response;

            // Assert
            response.Should().NotBeNull();
            response!.Devices.Should().HaveCount(1);
            
            var device = response.Devices.First();
            device.SdStorage.IndexExists.Should().BeTrue();
            device.UsbStorage.IndexExists.Should().BeFalse();
        }

        [Fact]
        public async Task FindDevices_WhenOnlyUsbIndexed_ReturnsMixedIndexExists()
        {
            // Arrange
            var deviceId = "test-device-004";
            var deviceSettings = new DeviceSettings
            {
                DeviceId = deviceId,
                IndexingStatus = new IndexingStatus
                {
                    SdLastIndexed = null,
                    UsbLastIndexed = DateTime.UtcNow.AddDays(-1)
                }
            };

            var mockSettingsProvider = Substitute.For<IDeviceSettingsProvider>();
            mockSettingsProvider.GetDeviceSettings(deviceId).Returns(deviceSettings);

            var mockDevice = CreateMockDevice(deviceId, hasSd: true, hasUsb: true);
            var mockDeviceManager = Substitute.For<IDeviceConnectionManager>();
            mockDeviceManager.FindDevices(false, Arg.Any<CancellationToken>(), false).Returns([mockDevice]);

            var endpoint = new FindDevicesEndpoint(mockDeviceManager, mockSettingsProvider);

            // Act
            await endpoint.Handle(new FindDevicesRequest(), CancellationToken.None);
            var response = endpoint.Response;

            // Assert
            response.Should().NotBeNull();
            response!.Devices.Should().HaveCount(1);
            
            var device = response.Devices.First();
            device.SdStorage.IndexExists.Should().BeFalse();
            device.UsbStorage.IndexExists.Should().BeTrue();
        }

        [Fact]
        public async Task FindDevices_WhenMultipleDevices_ReturnsIndependentIndexStatus()
        {
            // Arrange
            var deviceId1 = "test-device-005";
            var deviceId2 = "test-device-006";
            
            var deviceSettings1 = new DeviceSettings
            {
                DeviceId = deviceId1,
                IndexingStatus = new IndexingStatus
                {
                    SdLastIndexed = DateTime.UtcNow.AddDays(-1),
                    UsbLastIndexed = DateTime.UtcNow.AddDays(-1)
                }
            };
            
            var deviceSettings2 = new DeviceSettings
            {
                DeviceId = deviceId2,
                IndexingStatus = new IndexingStatus
                {
                    SdLastIndexed = null,
                    UsbLastIndexed = null
                }
            };

            var mockSettingsProvider = Substitute.For<IDeviceSettingsProvider>();
            mockSettingsProvider.GetDeviceSettings(deviceId1).Returns(deviceSettings1);
            mockSettingsProvider.GetDeviceSettings(deviceId2).Returns(deviceSettings2);

            var mockDevice1 = CreateMockDevice(deviceId1, hasSd: true, hasUsb: true);
            var mockDevice2 = CreateMockDevice(deviceId2, hasSd: true, hasUsb: true);
            var mockDeviceManager = Substitute.For<IDeviceConnectionManager>();
            mockDeviceManager.FindDevices(false, Arg.Any<CancellationToken>(), false).Returns([mockDevice1, mockDevice2]);

            var endpoint = new FindDevicesEndpoint(mockDeviceManager, mockSettingsProvider);

            // Act
            await endpoint.Handle(new FindDevicesRequest(), CancellationToken.None);
            var response = endpoint.Response;

            // Assert
            response.Should().NotBeNull();
            response!.Devices.Should().HaveCount(2);
            
            var device1 = response.Devices.First(d => d.DeviceId == deviceId1);
            device1.SdStorage.IndexExists.Should().BeTrue();
            device1.UsbStorage.IndexExists.Should().BeTrue();
            
            var device2 = response.Devices.First(d => d.DeviceId == deviceId2);
            device2.SdStorage.IndexExists.Should().BeFalse();
            device2.UsbStorage.IndexExists.Should().BeFalse();
        }

        [Fact]
        public async Task FindDevices_WhenDeviceSettingsNull_ReturnsIndexExistsFalse()
        {
            // Arrange
            var deviceId = "test-device-007";

            var mockSettingsProvider = Substitute.For<IDeviceSettingsProvider>();
            mockSettingsProvider.GetDeviceSettings(deviceId).Returns((DeviceSettings?)null);

            var mockDevice = CreateMockDevice(deviceId, hasSd: true, hasUsb: true);
            var mockDeviceManager = Substitute.For<IDeviceConnectionManager>();
            mockDeviceManager.FindDevices(false, Arg.Any<CancellationToken>(), false).Returns([mockDevice]);

            var endpoint = new FindDevicesEndpoint(mockDeviceManager, mockSettingsProvider);

            // Act
            await endpoint.Handle(new FindDevicesRequest(), CancellationToken.None);
            var response = endpoint.Response;

            // Assert
            response.Should().NotBeNull();
            response!.Devices.Should().HaveCount(1);
            
            var device = response.Devices.First();
            device.SdStorage.IndexExists.Should().BeFalse();
            device.UsbStorage.IndexExists.Should().BeFalse();
        }

        private static TeensyRomDevice CreateMockDevice(string deviceId, bool hasSd, bool hasUsb)
        {
            var sdStorage = new CartStorage
            {
                DeviceId = deviceId,
                Type = TeensyStorageType.SD,
                Available = hasSd
            };

            var usbStorage = new CartStorage
            {
                DeviceId = deviceId,
                Type = TeensyStorageType.USB,
                Available = hasUsb
            };

            var cart = new Cart
            {
                DeviceId = deviceId,
                Name = $"TestDevice-{deviceId}",
                FwVersion = "1.0.0",
                IsCompatible = true,
                SdStorage = sdStorage,
                UsbStorage = usbStorage
            };

            var mockComPort = Substitute.For<ICommunicationPort>();
            mockComPort.GetEndpoint().Returns("COM3");
            mockComPort.GetConnectionType().Returns(ConnectionType.Serial);

            var mockSdStorageService = Substitute.For<IStorageService>();
            var mockUsbStorageService = Substitute.For<IStorageService>();

            return new TeensyRomDevice(cart, mockComPort, mockSdStorageService, mockUsbStorageService);
        }
    }
}
