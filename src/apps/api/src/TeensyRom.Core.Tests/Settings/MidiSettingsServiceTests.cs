using System.Reflection;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Tests.Settings;

/// <summary>
/// Tests that write into the shared Assets/System/Config folder run one at a time: SettingsServiceTests
/// removes the folder when it is empty, which would otherwise race with a save in progress.
/// </summary>
[CollectionDefinition(Name)]
public class ConfigFolderCollection
{
    public const string Name = "Config folder";
}

/// <summary>
/// Behavioral tests for MidiSettingsService: the file-backed, cached MIDI settings set.
/// The file lives where the service puts it, in the test output directory.
/// </summary>
[Collection(ConfigFolderCollection.Name)]
public class MidiSettingsServiceTests : IDisposable
{
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();
    private readonly string _filePath = Path.Combine(Assembly.GetExecutingAssembly().GetDataPath(), SettingsConstants.MidiSettingsPath);

    public MidiSettingsServiceTests()
    {
        DeleteArtifacts();
    }

    public void Dispose()
    {
        DeleteArtifacts();
    }

    private void DeleteArtifacts()
    {
        if (Directory.Exists(_filePath)) Directory.Delete(_filePath, recursive: true);
        if (File.Exists(_filePath)) File.Delete(_filePath);

        var directory = Path.GetDirectoryName(_filePath)!;
        if (!Directory.Exists(directory)) return;

        foreach (var temp in Directory.EnumerateFiles(directory, Path.GetFileName(_filePath) + ".*.tmp"))
        {
            File.Delete(temp);
        }
    }

    private static MidiSettings SampleSettings() => new()
    {
        Controllers =
        [
            new KnownMidiController { Id = "c1", Name = "Launch Control XL", LastPortId = "input-3", Listening = true },
            new KnownMidiController { Id = "c2", Name = "Keystation", LastPortId = null, Listening = false }
        ],
        Mappings =
        [
            new MidiControlMapping
            {
                Id = "m1",
                Source = new MidiSource { ControllerId = "c1", Channel = 1, Kind = "cc", Number = 21 },
                Owner = "A",
                Control = "speed",
                Style = new MidiMappingStyle { Kind = "relative-offset", Amount = 0.01 }
            },
            new MidiControlMapping
            {
                Id = "m2",
                Source = new MidiSource { ControllerId = "c2", Channel = 16, Kind = "note", Number = 127 },
                Owner = "mixer",
                Control = "crossfader",
                Style = new MidiMappingStyle { Kind = "absolute", Amount = null }
            }
        ],
        DeckBindings =
        [
            new DeckDeviceBinding { Slot = "A", DeviceId = "19277260", LastSeenName = "TR-2" }
        ]
    };

    [Fact]
    public void Get_WhenNoFileExists_ReturnsEmptySetAndCreatesNoFile()
    {
        var service = new MidiSettingsService(_log);

        var settings = service.Get();

        settings.Controllers.Should().BeEmpty();
        settings.Mappings.Should().BeEmpty();
        settings.DeckBindings.Should().BeEmpty();
        File.Exists(_filePath).Should().BeFalse();
    }

    [Fact]
    public void Save_ThenGetFromNewService_RoundTripsTheSet()
    {
        var saved = SampleSettings();

        new MidiSettingsService(_log).Save(saved).Should().BeTrue();
        var loaded = new MidiSettingsService(_log).Get();

        loaded.Controllers.Should().Equal(saved.Controllers);
        loaded.Mappings.Should().Equal(saved.Mappings);
        loaded.DeckBindings.Should().Equal(saved.DeckBindings);
    }

    [Fact]
    public void Save_ReturnsTrue_WritesTheFileAndUpdatesTheCache()
    {
        var service = new MidiSettingsService(_log);
        service.Get();

        var saved = service.Save(SampleSettings());

        saved.Should().BeTrue();
        File.Exists(_filePath).Should().BeTrue();
        Directory.EnumerateFiles(Path.GetDirectoryName(_filePath)!, "*.tmp").Should().BeEmpty();
        service.Get().Mappings.Should().HaveCount(2);
    }

    [Fact]
    public void Save_ReplacesTheWholeSet()
    {
        var service = new MidiSettingsService(_log);
        service.Save(SampleSettings());

        service.Save(new MidiSettings { Controllers = [SampleSettings().Controllers[0]] });

        var loaded = new MidiSettingsService(_log).Get();
        loaded.Controllers.Should().HaveCount(1);
        loaded.Mappings.Should().BeEmpty();
        loaded.DeckBindings.Should().BeEmpty();
    }

    [Fact]
    public void Get_ReturnsACopy_SoCallersCannotChangeTheCachedSet()
    {
        var service = new MidiSettingsService(_log);
        service.Save(SampleSettings());

        service.Get().Controllers.Clear();

        service.Get().Controllers.Should().HaveCount(2);
    }

    [Fact]
    public void Get_WhenFileIsCorrupt_ReturnsEmptySetLogsWarningAndLeavesTheFile()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_filePath)!);
        File.WriteAllText(_filePath, "{ this is not json");

        var settings = new MidiSettingsService(_log).Get();

        settings.Controllers.Should().BeEmpty();
        settings.Mappings.Should().BeEmpty();
        settings.DeckBindings.Should().BeEmpty();
        _log.Received(1).InternalWarning(Arg.Any<string>(), Arg.Any<string?>());
        File.ReadAllText(_filePath).Should().Be("{ this is not json");
    }

    [Fact]
    public void Save_OverACorruptFile_ReplacesIt()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_filePath)!);
        File.WriteAllText(_filePath, "{ this is not json");
        var service = new MidiSettingsService(_log);
        service.Get();

        service.Save(SampleSettings()).Should().BeTrue();

        new MidiSettingsService(_log).Get().Controllers.Should().HaveCount(2);
    }

    [Fact]
    public void Save_WhenTheFileCannotBeReplaced_ReturnsFalseLogsAnErrorAndKeepsTheCachedSet()
    {
        var service = new MidiSettingsService(_log);
        service.Save(SampleSettings());
        File.Delete(_filePath);
        Directory.CreateDirectory(_filePath);

        var saved = service.Save(new MidiSettings());

        saved.Should().BeFalse();
        _log.Received().InternalError(Arg.Any<string>(), Arg.Any<string?>());
        service.Get().Controllers.Should().HaveCount(2);
        Directory.EnumerateFiles(Path.GetDirectoryName(_filePath)!, "*.tmp").Should().BeEmpty();
    }
}
