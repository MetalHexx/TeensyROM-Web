using FluentAssertions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using TeensyRom.Api.Services;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Device;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Tests.Services
{
    /// <summary>
    /// Behavioral tests for ApplicationBootstrapService startup orchestration.
    /// Tests focus on auto-connect logic, error handling, and settings integration.
    /// 
    /// IMPORTANT: Integration tests override SettingsService to disable auto-connect
    /// via TestSettingsService in EndpointFixture to maintain test isolation.
    /// </summary>
    public class ApplicationBootstrapServiceTests
    {
        private readonly ISettingsService _mockSettingsService;
        private readonly IDeviceConnectionManager _mockDeviceManager;
        private readonly ILoggingService _mockLog;
        private readonly ApplicationBootstrapService _service;

        public ApplicationBootstrapServiceTests()
        {
            _mockSettingsService = Substitute.For<ISettingsService>();
            _mockDeviceManager = Substitute.For<IDeviceConnectionManager>();
            _mockLog = Substitute.For<ILoggingService>();

            _service = new ApplicationBootstrapService(
                _mockSettingsService,
                _mockDeviceManager,
                _mockLog);
        }

        [Fact]
        public async Task StartAsync_WhenAutoConnectEnabled_ShouldFindAndConnectDevices()
        {
            // Arrange
            var settings = new TeensySettings
            {
                ConnectionSettings = new ConnectionSettings { AutoConnectEnabled = true }
            };
            _mockSettingsService.GetSettings().Returns(settings);

            var mockDevices = new List<TeensyRomDevice>
            {
                TestHelpers.CreateMockDevice("device-1"),
                TestHelpers.CreateMockDevice("device-2")
            };
            _mockDeviceManager.FindDevices(true, Arg.Any<CancellationToken>())
                .Returns(mockDevices);

            // Act
            await _service.StartAsync(CancellationToken.None);

            // Assert
            await _mockDeviceManager.Received(1).FindDevices(true, Arg.Any<CancellationToken>());
            _mockLog.Received().InternalInfo(Arg.Is<string>(s => s.Contains("Successfully connected to 2 device(s)")));
        }

        [Fact]
        public async Task StartAsync_WhenAutoConnectDisabled_ShouldSkipDeviceDiscovery()
        {
            // Arrange
            var settings = new TeensySettings
            {
                ConnectionSettings = new ConnectionSettings { AutoConnectEnabled = false }
            };
            _mockSettingsService.GetSettings().Returns(settings);

            // Act
            await _service.StartAsync(CancellationToken.None);

            // Assert
            await _mockDeviceManager.DidNotReceive().FindDevices(Arg.Any<bool>(), Arg.Any<CancellationToken>());
            _mockLog.Received().InternalInfo(Arg.Is<string>(s => s.Contains("auto-connect disabled")));
        }

        [Fact]
        public async Task StartAsync_WhenNoDevicesFound_ShouldLogWarning()
        {
            // Arrange
            var settings = new TeensySettings
            {
                ConnectionSettings = new ConnectionSettings { AutoConnectEnabled = true }
            };
            _mockSettingsService.GetSettings().Returns(settings);
            _mockDeviceManager.FindDevices(true, Arg.Any<CancellationToken>())
                .Returns(new List<TeensyRomDevice>());

            // Act
            await _service.StartAsync(CancellationToken.None);

            // Assert
            await _mockDeviceManager.Received(1).FindDevices(true, Arg.Any<CancellationToken>());
            _mockLog.Received().InternalWarning(Arg.Is<string>(s => s.Contains("No TeensyROM devices found")));
        }

        [Fact]
        public async Task StartAsync_WhenDeviceDiscoveryFails_ShouldLogErrorAndContinue()
        {
            // Arrange
            var settings = new TeensySettings
            {
                ConnectionSettings = new ConnectionSettings { AutoConnectEnabled = true }
            };
            _mockSettingsService.GetSettings().Returns(settings);
            _mockDeviceManager.FindDevices(true, Arg.Any<CancellationToken>())
                .Throws(new InvalidOperationException("Serial port unavailable"));

            // Act
            var act = async () => await _service.StartAsync(CancellationToken.None);

            // Assert - should not throw (non-critical failure)
            await act.Should().NotThrowAsync();
            _mockLog.Received().ExternalError(Arg.Is<string>(s => s.Contains("Device auto-connect failed")));
        }

        [Fact]
        public async Task StartAsync_WhenCancelled_ShouldLogWarning()
        {
            // Arrange
            var settings = new TeensySettings
            {
                ConnectionSettings = new ConnectionSettings { AutoConnectEnabled = true }
            };
            _mockSettingsService.GetSettings().Returns(settings);

            var cts = new CancellationTokenSource();
            cts.Cancel();

            _mockDeviceManager.FindDevices(true, Arg.Any<CancellationToken>())
                .Throws(new OperationCanceledException());

            // Act
            await _service.StartAsync(cts.Token);

            // Assert
            _mockLog.Received().InternalWarning(Arg.Is<string>(s => s.Contains("Bootstrap cancelled")));
        }

        [Fact]
        public async Task StopAsync_ShouldLogShutdown()
        {
            // Act
            await _service.StopAsync(CancellationToken.None);

            // Assert
            _mockLog.Received(1).InternalInfo(Arg.Is<string>(s => s.Contains("Stopping")));
        }

        [Fact]
        public async Task StartAsync_ShouldLogBootstrapStartAndComplete()
        {
            // Arrange
            var settings = new TeensySettings
            {
                ConnectionSettings = new ConnectionSettings { AutoConnectEnabled = false }
            };
            _mockSettingsService.GetSettings().Returns(settings);

            // Act
            await _service.StartAsync(CancellationToken.None);

            // Assert
            _mockLog.Received().InternalInfo(Arg.Is<string>(s => s.Contains("Starting application bootstrap")));
            _mockLog.Received().InternalInfo(Arg.Is<string>(s => s.Contains("Bootstrap complete")));
        }
    }

    /// <summary>
    /// Test helper methods for creating mock objects
    /// </summary>
    internal static class TestHelpers
    {
        public static TeensyRomDevice CreateMockDevice(string deviceId)
        {
            var mockSerialState = Substitute.For<ISerialState>();
            var cart = new TeensyRom.Core.Entities.Device.TeensyCart
            {
                ComPort = "COM1",
                Name = deviceId
            };

            // Use reflection to create device since constructor is internal
            var device = (TeensyRomDevice)Activator.CreateInstance(
                typeof(TeensyRomDevice),
                System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic,
                null,
                new object[] { cart, mockSerialState, Substitute.For<IStorageFactory>() },
                null)!;

            return device;
        }
    }
}
