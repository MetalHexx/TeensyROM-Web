using System.Text;
using System.Text.Json;
using MediatR;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Commands.GetFile;
using TeensyRom.Core.Common;
using TeensyRom.Core.Device;

namespace TeensyRom.Core.Device.Tests.Unit;

/// <summary>
/// Comprehensive behavioral tests for CartTagger covering all 8 synchronization scenarios and error conditions.
/// Tests verify observable outcomes (CartTagResult properties, commands sent) through public API only.
/// </summary>
public class CartTaggerTests
{
    private readonly ILoggingService _mockLog;
    private readonly IMediator _mockMediator;
    private readonly ICommunicationPort _mockPort;
    private readonly CartTagger _sut;

    public CartTaggerTests()
    {
        _mockLog = Substitute.For<ILoggingService>();
        _mockMediator = Substitute.For<IMediator>();
        _mockPort = Substitute.For<ICommunicationPort>();
        _sut = new CartTagger(_mockLog, _mockMediator);
    }

    #region Helper Methods

    /// <summary>
    /// Serializes a CartTag with the given DeviceId for use in mock GetFileResult responses.
    /// </summary>
    private byte[] SerializeTag(string deviceId)
    {
        var tag = new CartTag { DeviceId = deviceId };
        return tag.Serialize() ?? throw new InvalidOperationException("Failed to serialize tag");
    }

    #endregion

    #region Scenario A: Both Exist with Same ID

    [Fact]
    public async Task EnsureTagsForDevice_BothExistWithSameId_ReturnsAsIsWithNoSaves()
    {
        // Arrange
        var sharedId = "AAA111";
        
        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = SerializeTag(sharedId)
            });

        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = SerializeTag(sharedId)
            });

        // Act
        var result = await _sut.EnsureTagsForDevice(_mockPort);

        // Assert
        result.Should().NotBeNull();
        result.DeviceId.Should().Be(sharedId);
        
        result.SdStorage.Should().NotBeNull();
        result.SdStorage.Available.Should().BeTrue();
        result.SdStorage.DeviceId.Should().Be(sharedId);
        result.SdStorage.Type.Should().Be(TeensyStorageType.SD);
        
        result.UsbStorage.Should().NotBeNull();
        result.UsbStorage.Available.Should().BeTrue();
        result.UsbStorage.DeviceId.Should().Be(sharedId);
        result.UsbStorage.Type.Should().Be(TeensyStorageType.USB);
        
        // Verify no SaveFilesCommand sent (already synchronized)
        await _mockMediator.DidNotReceive().Send(Arg.Any<SaveFilesCommand>());
    }

    #endregion

    #region Scenario B: Both Exist with Different IDs (Conflict)

    [Fact]
    public async Task EnsureTagsForDevice_BothExistWithDifferentIds_PrefersSdAndUpdatesUsb()
    {
        // Arrange
        var sdId = "AAA111";
        var usbId = "BBB222";
        
        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = SerializeTag(sdId)
            });

        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = SerializeTag(usbId)
            });

        _mockMediator.Send(Arg.Any<SaveFilesCommand>())
            .Returns(new SaveFilesResult { IsSuccess = true });

        // Act
        var result = await _sut.EnsureTagsForDevice(_mockPort);

        // Assert
        result.Should().NotBeNull();
        result.DeviceId.Should().Be(sdId, "SD storage is preferred in conflicts");
        
        result.SdStorage.DeviceId.Should().Be(sdId);
        result.SdStorage.Available.Should().BeTrue();
        
        result.UsbStorage.DeviceId.Should().Be(sdId, "USB should be updated to match SD");
        result.UsbStorage.Available.Should().BeTrue();
        
        // Verify SaveFilesCommand sent once for USB storage
        await _mockMediator.Received(1).Send(Arg.Is<SaveFilesCommand>(c =>
            c.Files.Any(f => f.TargetStorage == TeensyStorageType.USB)));
    }

    #endregion

    #region Scenario C: Only SD Exists, USB Available

    [Fact]
    public async Task EnsureTagsForDevice_OnlySdExistsUsbAvailable_ReusesIdAndSavesUsb()
    {
        // Arrange
        var sdId = "CCC333";
        
        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = SerializeTag(sdId)
            });

        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.FileNotFound
            });

        _mockMediator.Send(Arg.Any<SaveFilesCommand>())
            .Returns(new SaveFilesResult { IsSuccess = true });

        // Act
        var result = await _sut.EnsureTagsForDevice(_mockPort);

        // Assert
        result.Should().NotBeNull();
        result.DeviceId.Should().Be(sdId);
        
        result.SdStorage.DeviceId.Should().Be(sdId);
        result.SdStorage.Available.Should().BeTrue();
        
        result.UsbStorage.DeviceId.Should().Be(sdId, "USB should receive SD's DeviceId");
        result.UsbStorage.Available.Should().BeTrue();
        
        // Verify SaveFilesCommand sent once for USB storage
        await _mockMediator.Received(1).Send(Arg.Is<SaveFilesCommand>(c =>
            c.Files.Any(f => f.TargetStorage == TeensyStorageType.USB)));
    }

    #endregion

    #region Scenario D: Only USB Exists, SD Available

    [Fact]
    public async Task EnsureTagsForDevice_OnlyUsbExistsSdAvailable_ReusesIdAndSavesSd()
    {
        // Arrange
        var usbId = "DDD444";
        
        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.FileNotFound
            });

        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = SerializeTag(usbId)
            });

        _mockMediator.Send(Arg.Any<SaveFilesCommand>())
            .Returns(new SaveFilesResult { IsSuccess = true });

        // Act
        var result = await _sut.EnsureTagsForDevice(_mockPort);

        // Assert
        result.Should().NotBeNull();
        result.DeviceId.Should().Be(usbId);
        
        result.SdStorage.DeviceId.Should().Be(usbId, "SD should receive USB's DeviceId");
        result.SdStorage.Available.Should().BeTrue();
        
        result.UsbStorage.DeviceId.Should().Be(usbId);
        result.UsbStorage.Available.Should().BeTrue();
        
        // Verify SaveFilesCommand sent once for SD storage
        await _mockMediator.Received(1).Send(Arg.Is<SaveFilesCommand>(c =>
            c.Files.Any(f => f.TargetStorage == TeensyStorageType.SD)));
    }

    #endregion

    #region Scenario E: Neither Exists, Both Available

    [Fact]
    public async Task EnsureTagsForDevice_NeitherExistsBothAvailable_GeneratesNewIdAndSavesBoth()
    {
        // Arrange
        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.FileNotFound
            });

        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.FileNotFound
            });

        _mockMediator.Send(Arg.Any<SaveFilesCommand>())
            .Returns(new SaveFilesResult { IsSuccess = true });

        // Act
        var result = await _sut.EnsureTagsForDevice(_mockPort);

        // Assert
        result.Should().NotBeNull();
        result.DeviceId.Should().NotBeNullOrEmpty("a new DeviceId should be generated");
        
        result.SdStorage.DeviceId.Should().Be(result.DeviceId);
        result.SdStorage.Available.Should().BeTrue();
        
        result.UsbStorage.DeviceId.Should().Be(result.DeviceId);
        result.UsbStorage.Available.Should().BeTrue();
        
        // Verify SaveFilesCommand sent twice (once for SD, once for USB)
        await _mockMediator.Received(1).Send(Arg.Is<SaveFilesCommand>(c =>
            c.Files.Any(f => f.TargetStorage == TeensyStorageType.SD)));
        await _mockMediator.Received(1).Send(Arg.Is<SaveFilesCommand>(c =>
            c.Files.Any(f => f.TargetStorage == TeensyStorageType.USB)));
    }

    #endregion

    #region Scenario F: SD Unavailable, USB Has Tag

    [Fact]
    public async Task EnsureTagsForDevice_SdUnavailableUsbHasTag_UsesUsbIdAndNoSaves()
    {
        // Arrange
        var usbId = "FFF666";
        
        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.StorageUnavailable
            });

        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = SerializeTag(usbId)
            });

        // Act
        var result = await _sut.EnsureTagsForDevice(_mockPort);

        // Assert
        result.Should().NotBeNull();
        result.DeviceId.Should().Be(usbId);
        
        result.SdStorage.Available.Should().BeFalse("SD is unavailable");
        result.SdStorage.DeviceId.Should().Be(usbId);
        
        result.UsbStorage.Available.Should().BeTrue();
        result.UsbStorage.DeviceId.Should().Be(usbId);
        
        // Verify no SaveFilesCommand sent (SD unavailable, cannot save)
        await _mockMediator.DidNotReceive().Send(Arg.Any<SaveFilesCommand>());
    }

    #endregion

    #region Scenario G: USB Unavailable, SD Has Tag

    [Fact]
    public async Task EnsureTagsForDevice_UsbUnavailableSdHasTag_UsesSdIdAndNoSaves()
    {
        // Arrange
        var sdId = "GGG777";
        
        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = SerializeTag(sdId)
            });

        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.StorageUnavailable
            });

        // Act
        var result = await _sut.EnsureTagsForDevice(_mockPort);

        // Assert
        result.Should().NotBeNull();
        result.DeviceId.Should().Be(sdId);
        
        result.SdStorage.Available.Should().BeTrue();
        result.SdStorage.DeviceId.Should().Be(sdId);
        
        result.UsbStorage.Available.Should().BeFalse("USB is unavailable");
        result.UsbStorage.DeviceId.Should().Be(sdId);
        
        // Verify no SaveFilesCommand sent (USB unavailable, cannot save)
        await _mockMediator.DidNotReceive().Send(Arg.Any<SaveFilesCommand>());
    }

    #endregion

    #region Scenario H: Both Unavailable

    [Fact]
    public async Task EnsureTagsForDevice_BothUnavailable_ReturnsEmptyDeviceId()
    {
        // Arrange
        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.StorageUnavailable
            });

        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.StorageUnavailable
            });

        // Act
        var result = await _sut.EnsureTagsForDevice(_mockPort);

        // Assert
        result.Should().NotBeNull();
        result.DeviceId.Should().BeEmpty("cannot establish device identity when both storage unavailable");
        
        result.SdStorage.Available.Should().BeFalse();
        result.UsbStorage.Available.Should().BeFalse();
        
        // Verify no SaveFilesCommand sent (both unavailable)
        await _mockMediator.DidNotReceive().Send(Arg.Any<SaveFilesCommand>());
    }

    #endregion

    #region Error Handling: Save Command Failure

    [Fact]
    public async Task EnsureTagsForDevice_SaveCommandFails_LogsErrorAndContinues()
    {
        // Arrange
        var sdId = "ERR999";
        
        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = SerializeTag(sdId)
            });

        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.FileNotFound
            });

        _mockMediator.Send(Arg.Any<SaveFilesCommand>())
            .Returns(new SaveFilesResult { IsSuccess = false });

        // Act
        var result = await _sut.EnsureTagsForDevice(_mockPort);

        // Assert
        result.Should().NotBeNull("method should complete successfully even if save fails");
        result.DeviceId.Should().Be(sdId, "DeviceId should still be determined correctly");
        
        result.SdStorage.DeviceId.Should().Be(sdId);
        result.UsbStorage.DeviceId.Should().Be(sdId);
        
        // Verify error was logged
        _mockLog.Received().InternalError(Arg.Is<string>(s => 
            s.Contains("Failed to save cart-tag.txt")));
    }

    #endregion

    #region Error Handling: Multiple Save Operations

    [Fact]
    public async Task EnsureTagsForDevice_NeitherExistsBothAvailable_SavesBothIndependently()
    {
        // Arrange
        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.FileNotFound
            });

        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.FileNotFound
            });

        // First save (SD) succeeds, second save (USB) fails
        var callCount = 0;
        _mockMediator.Send(Arg.Any<SaveFilesCommand>())
            .Returns(_ => new SaveFilesResult { IsSuccess = ++callCount == 1 });

        // Act
        var result = await _sut.EnsureTagsForDevice(_mockPort);

        // Assert
        result.Should().NotBeNull();
        result.DeviceId.Should().NotBeNullOrEmpty();
        
        // Both saves should be attempted
        await _mockMediator.Received(2).Send(Arg.Any<SaveFilesCommand>());
        
        // One error should be logged (for USB failure)
        _mockLog.Received(1).InternalError(Arg.Is<string>(s => 
            s.Contains("Failed to save cart-tag.txt")));
    }

    #endregion

    #region Edge Case: Empty/Null FileData

    [Fact]
    public async Task EnsureTagsForDevice_EmptyFileData_TreatsAsFileNotFound()
    {
        // Arrange
        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = Array.Empty<byte>()
            });

        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.FileNotFound
            });

        _mockMediator.Send(Arg.Any<SaveFilesCommand>())
            .Returns(new SaveFilesResult { IsSuccess = true });

        // Act
        var result = await _sut.EnsureTagsForDevice(_mockPort);

        // Assert
        result.Should().NotBeNull();
        result.DeviceId.Should().NotBeNullOrEmpty("should generate new ID when both effectively empty");
        
        // Both saves should be attempted (since both are "empty")
        await _mockMediator.Received(2).Send(Arg.Any<SaveFilesCommand>());
    }

    #endregion

    #region Edge Case: Malformed JSON

    [Fact]
    public async Task EnsureTagsForDevice_MalformedJson_TreatsAsFileNotFound()
    {
        // Arrange
        var malformedJson = Encoding.UTF8.GetBytes("{\"DeviceId\":\"incomplete");
        
        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.SD))
            .Returns(new GetFileResult
            {
                IsSuccess = true,
                FileData = malformedJson
            });

        _mockMediator.Send(Arg.Is<GetFileCommand>(c => c.StorageType == TeensyStorageType.USB))
            .Returns(new GetFileResult
            {
                IsSuccess = false,
                ErrorCode = GetFileErrorCode.FileNotFound
            });

        _mockMediator.Send(Arg.Any<SaveFilesCommand>())
            .Returns(new SaveFilesResult { IsSuccess = true });

        // Act
        var result = await _sut.EnsureTagsForDevice(_mockPort);

        // Assert
        result.Should().NotBeNull();
        result.DeviceId.Should().NotBeNullOrEmpty("should generate new ID when deserialization fails");
        
        // Both saves should be attempted (SD treated as empty due to deserialization failure)
        await _mockMediator.Received(2).Send(Arg.Any<SaveFilesCommand>());
    }

    #endregion
}
