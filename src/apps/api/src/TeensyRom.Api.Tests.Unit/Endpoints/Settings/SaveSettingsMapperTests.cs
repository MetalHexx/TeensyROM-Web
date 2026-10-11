using TeensyRom.Api.Endpoints.Settings;
using TeensyRom.Api.Endpoints.Settings.SaveSettings;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Settings;

public class SaveSettingsMapperTests
{
    private readonly ISettingsService _settingsService = Substitute.For<ISettingsService>();

    private SaveSettingsMapper GivenMapperWithExisting(params DeviceSettings[] existing)
    {
        _settingsService.GetSettings().Returns(new TeensySettings { KnownDevices = existing.ToList() });
        return new SaveSettingsMapper(_settingsService);
    }

    private static DeviceSettings ExistingDevice(string id, bool enableVideo = false, DateTime? sdLastIndexed = null) => new()
    {
        DeviceId = id,
        VideoSettings = new VideoSettings { EnableVideo = enableVideo },
        IndexingStatus = new IndexingStatus { SdLastIndexed = sdLastIndexed }
    };

    private static DeviceSettingsDto RequestedDevice(string id, bool enableVideo) => new()
    {
        DeviceId = id,
        VideoSettings = new VideoSettingsDto { EnableVideo = enableVideo },
        AudioSettings = new AudioSettingsDto()
    };

    private static SaveSettingsRequest GivenRequest(params DeviceSettingsDto[] devices) => new()
    {
        KnownDevices = devices.ToList(),
        PlayerSettings = new PlayerSettingsDto(),
        FileTransferSettings = new FileTransferSettingsDto(),
        SearchSettings = new SearchSettingsDto { SearchWeights = new SearchWeightsDto() },
        AppSettings = new AppSettingsDto()
    };

    [Fact]
    public void ToEntity_RequestedExistingDevice_UpdatesInPlaceAndKeepsIndexingStatus()
    {
        var indexedAt = new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc);
        var mapper = GivenMapperWithExisting(ExistingDevice("AAAA", enableVideo: false, sdLastIndexed: indexedAt));

        var entity = mapper.ToEntity(GivenRequest(RequestedDevice("AAAA", enableVideo: true)));

        var device = entity.KnownDevices.Should().ContainSingle().Subject;
        device.VideoSettings.EnableVideo.Should().BeTrue();
        device.IndexingStatus.SdLastIndexed.Should().Be(indexedAt);
    }

    [Fact]
    public void ToEntity_DeviceOmittedFromRequest_KeepsItsEntryUntouched()
    {
        var kept = ExistingDevice("BBBB", enableVideo: true);
        var mapper = GivenMapperWithExisting(ExistingDevice("AAAA"), kept);

        var entity = mapper.ToEntity(GivenRequest(RequestedDevice("AAAA", enableVideo: true)));

        entity.KnownDevices.Select(d => d.DeviceId).Should().Equal("AAAA", "BBBB");
        entity.KnownDevices[1].Should().Be(kept);
    }

    [Fact]
    public void ToEntity_EmptyRequestList_KeepsEveryExistingEntry()
    {
        var mapper = GivenMapperWithExisting(ExistingDevice("AAAA"), ExistingDevice("BBBB"));

        var entity = mapper.ToEntity(GivenRequest());

        entity.KnownDevices.Select(d => d.DeviceId).Should().Equal("AAAA", "BBBB");
    }

    [Fact]
    public void ToEntity_UnknownIdInRequest_IsIgnored()
    {
        var mapper = GivenMapperWithExisting(ExistingDevice("AAAA"));

        var entity = mapper.ToEntity(GivenRequest(RequestedDevice("AAAA", true), RequestedDevice("STRANGER", true)));

        entity.KnownDevices.Should().ContainSingle().Which.DeviceId.Should().Be("AAAA");
    }

    [Fact]
    public void ToEntity_RepeatedIdInRequest_FirstOneWins()
    {
        var mapper = GivenMapperWithExisting(ExistingDevice("AAAA", enableVideo: false));

        var entity = mapper.ToEntity(GivenRequest(RequestedDevice("AAAA", true), RequestedDevice("AAAA", false)));

        entity.KnownDevices.Should().ContainSingle().Which.VideoSettings.EnableVideo.Should().BeTrue();
    }

    [Fact]
    public void ToEntity_OrderFollowsTheExistingList()
    {
        var mapper = GivenMapperWithExisting(ExistingDevice("CCCC"), ExistingDevice("AAAA"), ExistingDevice("BBBB"));

        var entity = mapper.ToEntity(GivenRequest(RequestedDevice("BBBB", true), RequestedDevice("AAAA", true)));

        entity.KnownDevices.Select(d => d.DeviceId).Should().Equal("CCCC", "AAAA", "BBBB");
    }
}
