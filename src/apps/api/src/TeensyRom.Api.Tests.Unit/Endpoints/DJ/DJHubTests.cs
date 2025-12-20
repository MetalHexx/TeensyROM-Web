using MediatR;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using TeensyRom.Api.Endpoints.DJ;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands.MuteSidVoices;
using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Api.Tests.Unit.Endpoints.DJ
{
    /// <summary>
    /// Unit tests for DJHub SignalR hub.
    /// Tests focus on hub method behavior, device resolution, MediatR command dispatch, and error handling.
    /// </summary>
    public class DJHubTests
    {
        private readonly IMediator _mockMediator;
        private readonly IDeviceConnectionManager _mockDeviceManager;
        private readonly ILogger<DJHub> _mockLogger;

        public DJHubTests()
        {
            _mockMediator = Substitute.For<IMediator>();
            _mockDeviceManager = Substitute.For<IDeviceConnectionManager>();
            _mockLogger = Substitute.For<ILogger<DJHub>>();
        }

        [Fact]
        public async Task MuteSidVoices_WithValidParameters_DispatchesCommandToMediatR()
        {
            // Arrange
            const string deviceId = "test-device-123";
            var mockDevice = CreateMockDevice(deviceId);
            _mockDeviceManager.GetConnectedDevice(deviceId).Returns(mockDevice);

            var hub = CreateHub();

            // Act
            await hub.MuteSidVoices(
                deviceId, 
                VoiceState.Enabled, 
                VoiceState.Disabled, 
                VoiceState.Enabled);

            // Assert
            await _mockMediator.Received(1).Send(
                Arg.Is<MuteSidVoicesCommand>(cmd =>
                    cmd.DeviceId == deviceId &&
                    cmd.Voice1Enabled == VoiceState.Enabled &&
                    cmd.Voice2Enabled == VoiceState.Disabled &&
                    cmd.Voice3Enabled == VoiceState.Enabled &&
                    cmd.Serial == mockDevice.SerialState
                ),
                Arg.Any<CancellationToken>()
            );
        }

        [Fact]
        public async Task MuteSidVoices_WithAllVoicesEnabled_DispatchesCorrectCommand()
        {
            // Arrange
            const string deviceId = "test-device-456";
            var mockDevice = CreateMockDevice(deviceId);
            _mockDeviceManager.GetConnectedDevice(deviceId).Returns(mockDevice);

            var hub = CreateHub();

            // Act
            await hub.MuteSidVoices(
                deviceId, 
                VoiceState.Enabled, 
                VoiceState.Enabled, 
                VoiceState.Enabled);

            // Assert
            await _mockMediator.Received(1).Send(
                Arg.Is<MuteSidVoicesCommand>(cmd =>
                    cmd.Voice1Enabled == VoiceState.Enabled &&
                    cmd.Voice2Enabled == VoiceState.Enabled &&
                    cmd.Voice3Enabled == VoiceState.Enabled
                ),
                Arg.Any<CancellationToken>()
            );
        }

        [Fact]
        public async Task MuteSidVoices_WithAllVoicesDisabled_DispatchesCorrectCommand()
        {
            // Arrange
            const string deviceId = "test-device-789";
            var mockDevice = CreateMockDevice(deviceId);
            _mockDeviceManager.GetConnectedDevice(deviceId).Returns(mockDevice);

            var hub = CreateHub();

            // Act
            await hub.MuteSidVoices(
                deviceId, 
                VoiceState.Disabled, 
                VoiceState.Disabled, 
                VoiceState.Disabled);

            // Assert
            await _mockMediator.Received(1).Send(
                Arg.Is<MuteSidVoicesCommand>(cmd =>
                    cmd.Voice1Enabled == VoiceState.Disabled &&
                    cmd.Voice2Enabled == VoiceState.Disabled &&
                    cmd.Voice3Enabled == VoiceState.Disabled
                ),
                Arg.Any<CancellationToken>()
            );
        }

        [Fact]
        public async Task MuteSidVoices_WithMixedVoiceStates_DispatchesCorrectCommand()
        {
            // Arrange
            const string deviceId = "test-device-mixed";
            var mockDevice = CreateMockDevice(deviceId);
            _mockDeviceManager.GetConnectedDevice(deviceId).Returns(mockDevice);

            var hub = CreateHub();

            // Act
            await hub.MuteSidVoices(
                deviceId, 
                VoiceState.Disabled, 
                VoiceState.Enabled, 
                VoiceState.Disabled);

            // Assert
            await _mockMediator.Received(1).Send(
                Arg.Is<MuteSidVoicesCommand>(cmd =>
                    cmd.Voice1Enabled == VoiceState.Disabled &&
                    cmd.Voice2Enabled == VoiceState.Enabled &&
                    cmd.Voice3Enabled == VoiceState.Disabled
                ),
                Arg.Any<CancellationToken>()
            );
        }

        [Fact]
        public async Task MuteSidVoices_WithInvalidDeviceId_ThrowsHubException()
        {
            // Arrange
            const string invalidDeviceId = "invalid-device";
            _mockDeviceManager.GetConnectedDevice(invalidDeviceId).Returns((TeensyRomDevice?)null);

            var hub = CreateHub();

            // Act
            var act = async () => await hub.MuteSidVoices(
                invalidDeviceId, 
                VoiceState.Enabled, 
                VoiceState.Enabled, 
                VoiceState.Enabled);

            // Assert
            await act.Should().ThrowAsync<HubException>()
                .WithMessage($"Device not found: {invalidDeviceId}");
        }

        [Fact]
        public async Task MuteSidVoices_WithNullDevice_ThrowsHubException()
        {
            // Arrange
            const string deviceId = "null-device";
            _mockDeviceManager.GetConnectedDevice(deviceId).Returns((TeensyRomDevice?)null);

            var hub = CreateHub();

            // Act
            var act = async () => await hub.MuteSidVoices(
                deviceId, 
                VoiceState.Disabled, 
                VoiceState.Disabled, 
                VoiceState.Disabled);

            // Assert
            await act.Should().ThrowAsync<HubException>()
                .WithMessage("Device not found: *");
        }

        [Fact]
        public async Task MuteSidVoices_WithInvalidDeviceId_DoesNotCallMediator()
        {
            // Arrange
            const string invalidDeviceId = "bad-device";
            _mockDeviceManager.GetConnectedDevice(invalidDeviceId).Returns((TeensyRomDevice?)null);

            var hub = CreateHub();

            // Act
            try
            {
                await hub.MuteSidVoices(
                    invalidDeviceId, 
                    VoiceState.Enabled, 
                    VoiceState.Enabled, 
                    VoiceState.Enabled);
            }
            catch (HubException)
            {
                // Expected exception
            }

            // Assert
            await _mockMediator.DidNotReceive().Send(
                Arg.Any<MuteSidVoicesCommand>(),
                Arg.Any<CancellationToken>()
            );
        }

        [Fact]
        public async Task MuteSidVoices_WithValidDevice_BindsSerialContextToCommand()
        {
            // Arrange
            const string deviceId = "device-with-context";
            var mockDevice = CreateMockDevice(deviceId);
            var expectedSerialContext = mockDevice.SerialState;
            
            _mockDeviceManager.GetConnectedDevice(deviceId).Returns(mockDevice);

            var hub = CreateHub();

            // Act
            await hub.MuteSidVoices(
                deviceId, 
                VoiceState.Enabled, 
                VoiceState.Enabled, 
                VoiceState.Enabled);

            // Assert
            await _mockMediator.Received(1).Send(
                Arg.Is<MuteSidVoicesCommand>(cmd => cmd.Serial == expectedSerialContext),
                Arg.Any<CancellationToken>()
            );
        }

        [Fact]
        public async Task MuteSidVoices_PassesCancellationTokenToMediator()
        {
            // Arrange
            const string deviceId = "device-cancellation";
            var mockDevice = CreateMockDevice(deviceId);
            _mockDeviceManager.GetConnectedDevice(deviceId).Returns(mockDevice);

            var hub = CreateHub();

            // Act
            await hub.MuteSidVoices(
                deviceId, 
                VoiceState.Enabled, 
                VoiceState.Disabled, 
                VoiceState.Enabled);

            // Assert
            await _mockMediator.Received(1).Send(
                Arg.Any<MuteSidVoicesCommand>(),
                Arg.Any<CancellationToken>()
            );
        }

        private DJHub CreateHub()
        {
            var hub = new DJHub(_mockMediator, _mockDeviceManager, _mockLogger);
            
            // Mock the Hub's Context property (normally provided by SignalR runtime)
            var mockHubCallerContext = Substitute.For<HubCallerContext>();
            mockHubCallerContext.ConnectionAborted.Returns(CancellationToken.None);
            hub.Context = mockHubCallerContext;
            
            return hub;
        }

        private static TeensyRomDevice CreateMockDevice(string deviceId)
        {
            var cart = new Cart { DeviceId = deviceId };
            var mockSerialContext = Substitute.For<ISerialStateContext>();
            var mockSdStorage = Substitute.For<IStorageService>();
            var mockUsbStorage = Substitute.For<IStorageService>();
            
            var mockDevice = new TeensyRomDevice(cart, mockSerialContext, mockSdStorage, mockUsbStorage);
            return mockDevice;
        }
    }
}
