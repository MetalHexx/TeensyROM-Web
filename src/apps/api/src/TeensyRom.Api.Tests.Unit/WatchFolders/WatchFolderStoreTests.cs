using System.Reactive.Subjects;
using TeensyRom.Api.WatchFolders;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Tests.Unit.WatchFolders;

public class WatchFolderStoreTests : IDisposable
{
    private const string DeviceA = "AAAA1111";
    private const string DeviceB = "BBBB2222";

    private readonly ISettingsService _settings = Substitute.For<ISettingsService>();
    private readonly IDeviceConnectionManager _devices = Substitute.For<IDeviceConnectionManager>();
    private readonly BehaviorSubject<TeensySettings> _stream;
    private readonly string _temp = Directory.CreateTempSubdirectory("teensyrom-watch-folder-tests-").FullName;
    private TeensySettings _current = new();

    public WatchFolderStoreTests()
    {
        _stream = new BehaviorSubject<TeensySettings>(_current);
        _settings.Settings.Returns(_stream);
        _settings.GetSettings().Returns(_ => _current with { });
        _settings.UpdateSettings(Arg.Any<Func<TeensySettings, TeensySettings>>()).Returns(call =>
        {
            var latest = _current with { };
            var updated = call.Arg<Func<TeensySettings, TeensySettings>>()(latest);
            if (!ReferenceEquals(updated, latest))
            {
                _current = updated;
                _stream.OnNext(updated);
            }
            return true;
        });
    }

    public void Dispose() => Directory.Delete(_temp, recursive: true);

    private WatchFolderStore NewStore() => new(_settings, _devices);

    private string Dir(params string[] parts)
    {
        var path = Path.Combine([_temp, .. parts]);
        Directory.CreateDirectory(path);
        return path;
    }

    private void GivenDevice(string id, bool sd = true, bool usb = true)
    {
        var cart = new Cart { DeviceId = id };
        cart.SdStorage.Available = sd;
        cart.UsbStorage.Available = usb;
        var device = new TeensyRomDevice(
            cart, Substitute.For<ICommunicationPort>(), Substitute.For<IStorageService>(), Substitute.For<IStorageService>());
        _devices.GetAvailableDevice(id).Returns(device);
    }

    private static WatchFolderAdd Request(string folder, string device = DeviceA, TeensyStorageType storage = TeensyStorageType.SD, string? devicePath = null, bool launch = false) =>
        new(folder, device, storage, devicePath, launch);

    [Fact]
    public void Add_NewFolder_CreatesAnEnabledFolderWithTheDestination()
    {
        GivenDevice(DeviceA);
        var folder = Dir("games");

        var result = NewStore().Add(Request(folder, devicePath: "music/incoming", launch: true));

        result.Error.Should().BeNull();
        result.Created.Should().BeTrue();
        result.Folder!.Path.Should().Be(WatchFolderPaths.Normalize(folder));
        result.Folder.Enabled.Should().BeTrue();
        result.Folder.Id.Should().NotBeNullOrEmpty();
        var destination = result.Folder.Destinations.Should().ContainSingle().Subject;
        destination.Should().BeEquivalentTo(new { DeviceId = DeviceA, StorageType = TeensyStorageType.SD, Path = "/music/incoming/", Launch = true });
        destination.Id.Should().NotBeNullOrEmpty();
        _current.WatchFolders.Should().ContainSingle().Which.Should().Be(result.Folder);
    }

    [Fact]
    public void Add_WithoutDevicePath_UsesAutoTransfer()
    {
        GivenDevice(DeviceA);

        var result = NewStore().Add(Request(Dir("games")));

        result.Folder!.Destinations.Single().Path.Should().Be("/auto-transfer/");
    }

    [Fact]
    public void Add_FolderMissing_IsRefused()
    {
        GivenDevice(DeviceA);

        var result = NewStore().Add(Request(Path.Combine(_temp, "nope")));

        result.Error.Should().Be(WatchFolderAddError.FolderNotFound);
        _current.WatchFolders.Should().BeEmpty();
    }

    [Fact]
    public void Add_PathOfAFile_IsRefused()
    {
        GivenDevice(DeviceA);
        var file = Path.Combine(Dir("games"), "a.prg");
        File.WriteAllText(file, "x");

        NewStore().Add(Request(file)).Error.Should().Be(WatchFolderAddError.FolderNotFound);
    }

    [Theory]
    [InlineData("/music/../etc")]
    [InlineData("/music/./x")]
    [InlineData("..")]
    [InlineData("bad\\path")]
    public void Add_InvalidDevicePath_IsRefused(string devicePath)
    {
        GivenDevice(DeviceA);

        NewStore().Add(Request(Dir("games"), devicePath: devicePath)).Error.Should().Be(WatchFolderAddError.InvalidDevicePath);
    }

    [Fact]
    public void Add_DeviceNotConnected_IsRefused()
    {
        NewStore().Add(Request(Dir("games"))).Error.Should().Be(WatchFolderAddError.DeviceNotFound);
    }

    [Theory]
    [InlineData("Unknown")]
    [InlineData("Unknown-2")]
    public void Add_StandInDevice_IsRefused(string standIn)
    {
        GivenDevice(standIn);

        var result = NewStore().Add(Request(Dir("games"), standIn));

        result.Error.Should().Be(WatchFolderAddError.StandInDevice);
        _current.WatchFolders.Should().BeEmpty();
    }

    [Fact]
    public void Add_StorageMissing_IsRefused()
    {
        GivenDevice(DeviceA, usb: false);

        NewStore().Add(Request(Dir("games"), storage: TeensyStorageType.USB)).Error.Should().Be(WatchFolderAddError.StorageUnavailable);
    }

    [Fact]
    public void Add_SameFolderForAnotherDevice_AppendsADestination()
    {
        GivenDevice(DeviceA);
        GivenDevice(DeviceB);
        var folder = Dir("games");
        var store = NewStore();
        var first = store.Add(Request(folder));

        var second = store.Add(Request(folder + Path.DirectorySeparatorChar, DeviceB, TeensyStorageType.USB));

        second.Error.Should().BeNull();
        second.Created.Should().BeFalse();
        second.Folder!.Id.Should().Be(first.Folder!.Id);
        second.Folder.Destinations.Select(d => d.DeviceId).Should().Equal(DeviceA, DeviceB);
        _current.WatchFolders.Should().ContainSingle();
    }

    [Fact]
    public void Add_SecondDestinationForTheSameDevice_IsRefusedWhateverTheStorage()
    {
        GivenDevice(DeviceA);
        var folder = Dir("games");
        var store = NewStore();
        store.Add(Request(folder, storage: TeensyStorageType.SD));

        var other = store.Add(Request(folder, storage: TeensyStorageType.USB));
        var identical = store.Add(Request(folder, storage: TeensyStorageType.SD));

        other.Error.Should().Be(WatchFolderAddError.DeviceAlreadyOnFolder);
        identical.Error.Should().Be(WatchFolderAddError.DeviceAlreadyOnFolder);
        _current.WatchFolders.Single().Destinations.Should().ContainSingle();
    }

    [Fact]
    public void Add_FolderUnderAWatchedFolder_IsRefused()
    {
        GivenDevice(DeviceA);
        var store = NewStore();
        store.Add(Request(Dir("games")));

        store.Add(Request(Dir("games", "c64"))).Error.Should().Be(WatchFolderAddError.Nested);
    }

    [Fact]
    public void Add_FolderContainingAWatchedFolder_IsRefused()
    {
        GivenDevice(DeviceA);
        var store = NewStore();
        store.Add(Request(Dir("games", "c64")));

        store.Add(Request(Dir("games"))).Error.Should().Be(WatchFolderAddError.Nested);
    }

    [Fact]
    public void Add_FilesystemRootOverAWatchedFolder_IsRefused()
    {
        GivenDevice(DeviceA);
        var store = NewStore();
        store.Add(Request(Dir("games")));

        store.Add(Request(Path.GetPathRoot(_temp)!)).Error.Should().Be(WatchFolderAddError.Nested);
    }

    [Fact]
    public void Add_SiblingSharingANamePrefix_IsAllowed()
    {
        GivenDevice(DeviceA);
        var store = NewStore();
        store.Add(Request(Dir("games")));

        store.Add(Request(Dir("games2"))).Created.Should().BeTrue();
    }

    [Fact]
    public void Add_SameFolderInAnotherCase_IsTheSameFolderOnWindowsOnly()
    {
        GivenDevice(DeviceA);
        GivenDevice(DeviceB);
        var folder = Dir("Games");
        var store = NewStore();
        store.Add(Request(folder));

        var result = store.Add(Request(folder.Replace("Games", "GAMES"), DeviceB));

        if (OperatingSystem.IsWindows())
        {
            result.Created.Should().BeFalse();
            _current.WatchFolders.Should().ContainSingle();
        }
        else
        {
            result.Error.Should().Be(WatchFolderAddError.FolderNotFound);
        }
    }

    [Fact]
    public void RemoveFolder_RemovesItAndReportsMissingOnes()
    {
        GivenDevice(DeviceA);
        var store = NewStore();
        var id = store.Add(Request(Dir("games"))).Folder!.Id;

        store.RemoveFolder("missing").Should().BeFalse();
        store.RemoveFolder(id).Should().BeTrue();

        _current.WatchFolders.Should().BeEmpty();
        Directory.Exists(Path.Combine(_temp, "games")).Should().BeTrue();
    }

    [Fact]
    public void RemoveDevice_KeepsTheFolderWhileOtherDestinationsRemain()
    {
        GivenDevice(DeviceA);
        GivenDevice(DeviceB);
        var folder = Dir("games");
        var store = NewStore();
        var id = store.Add(Request(folder)).Folder!.Id;
        store.Add(Request(folder, DeviceB));

        var result = store.RemoveDevice(id, DeviceA);

        result.Found.Should().BeTrue();
        result.FolderRemoved.Should().BeFalse();
        result.Folder!.Destinations.Should().ContainSingle().Which.DeviceId.Should().Be(DeviceB);
        store.Get(id)!.Destinations.Should().ContainSingle();
    }

    [Fact]
    public void RemoveDevice_LastDestination_RemovesTheFolder()
    {
        GivenDevice(DeviceA);
        var store = NewStore();
        var id = store.Add(Request(Dir("games"))).Folder!.Id;

        var result = store.RemoveDevice(id, DeviceA);

        result.Should().Be(new WatchFolderRemoveDeviceResult(Found: true, FolderRemoved: true, null));
        store.Get(id).Should().BeNull();
    }

    [Fact]
    public void RemoveDevice_UnknownFolderOrDevice_IsNotFound()
    {
        GivenDevice(DeviceA);
        var store = NewStore();
        var id = store.Add(Request(Dir("games"))).Folder!.Id;

        store.RemoveDevice("missing", DeviceA).Found.Should().BeFalse();
        store.RemoveDevice(id, DeviceB).Found.Should().BeFalse();
        store.Get(id).Should().NotBeNull();
    }

    [Fact]
    public void SetEnabled_TogglesAndReportsMissingFolders()
    {
        GivenDevice(DeviceA);
        var store = NewStore();
        var id = store.Add(Request(Dir("games"))).Folder!.Id;

        store.SetEnabled(id, false)!.Enabled.Should().BeFalse();
        store.Get(id)!.Enabled.Should().BeFalse();
        store.SetEnabled(id, true)!.Enabled.Should().BeTrue();
        store.SetEnabled("missing", true).Should().BeNull();
    }

    [Fact]
    public void Changed_EmitsOnEveryChangeIncludingOnesMadeOutsideTheStore()
    {
        GivenDevice(DeviceA);
        var store = NewStore();
        var emissions = new List<int>();
        using var subscription = store.Changed.Subscribe(list => emissions.Add(list.Count));

        var id = store.Add(Request(Dir("games"))).Folder!.Id;
        store.SetEnabled(id, false);
        _settings.UpdateSettings(s => s with { WatchFolders = [] });

        emissions.Should().Equal(0, 1, 1, 0);
    }

    [Fact]
    public void Changed_DoesNotEmitForChangesToOtherSettings()
    {
        var store = NewStore();
        var emissions = 0;
        using var subscription = store.Changed.Subscribe(_ => emissions++);

        _settings.UpdateSettings(s => s with { AppSettings = new AppSettings { FirstTimeSetup = false } });

        emissions.Should().Be(1);
    }
}
