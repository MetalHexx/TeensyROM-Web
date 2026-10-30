using System.Reflection;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Themes;

namespace TeensyRom.Core.Tests.Themes;

[CollectionDefinition(Name)]
public class ThemeFolderCollection
{
    public const string Name = "Theme folders";
}

/// <summary>
/// Behavioral tests for ThemeStore against the theme folders under the test home.
/// </summary>
[Collection(ThemeFolderCollection.Name)]
public class ThemeStoreTests : IDisposable
{
    private static readonly string[] ShippedIds = ["tr-default", "black-and-white", "c64-mono", "cga", "the-blues", "rainbow"];

    private readonly ILoggingService _log = Substitute.For<ILoggingService>();
    private readonly string _dataPath = Assembly.GetExecutingAssembly().GetDataPath();

    private string HomeAssetsDir => Path.Combine(_dataPath, "Assets");
    private string HomeShippedDir => Path.Combine(_dataPath, ThemePaths.ShippedFolder);
    private string PackageShippedDir => Path.Combine(Assembly.GetExecutingAssembly().GetPath(), ThemePaths.ShippedFolder);
    private string CustomDir => Path.Combine(_dataPath, ThemePaths.CustomFolder);
    private string RecordsFile => Path.Combine(_dataPath, ThemePaths.DeviceRecordsFile);
    private string SystemThemesDir => Path.Combine(_dataPath, "Assets", "System", "Themes");

    public ThemeStoreTests()
    {
        DeleteFolders();
        Directory.Exists(PackageShippedDir).Should().BeTrue($"the shipped theme files must be copied to '{PackageShippedDir}' by the Core project");
    }

    public void Dispose()
    {
        DeleteFolders();
    }

    private void DeleteFolders()
    {
        if (Directory.Exists(HomeShippedDir)) Directory.Delete(HomeShippedDir, recursive: true);
        if (Directory.Exists(SystemThemesDir)) Directory.Delete(SystemThemesDir, recursive: true);
    }

    private ThemeStore NewStore() => new(_log);

    private string CustomFile(string id) => Path.Combine(CustomDir, id + ".json");

    private static DeviceThemePart Colors(int fill = 3) => new()
    {
        Background = fill,
        Border = fill,
        Banner = fill,
        Time = fill,
        Option = fill,
        Sources = fill,
        Name = fill
    };

    [Fact]
    public void ListThemes_ReturnsShippedFirstInOrder_ThenCustomByName()
    {
        var store = NewStore();
        store.CreateCustom("zeta", Colors());
        store.CreateCustom("Alpha", Colors());

        var themes = store.ListThemes();

        themes.Select(t => t.Id).Should().Equal([.. ShippedIds, "alpha", "zeta"]);
        themes.Take(ShippedIds.Length).Should().OnlyContain(t => t.Kind == ThemeKind.Shipped);
        themes.Skip(ShippedIds.Length).Should().OnlyContain(t => t.Kind == ThemeKind.Custom);
        themes[0].Parts.Device.Should().Be(ThemeDefaults.FactoryColors);
        ThemeDefaults.FactoryThemeId.Should().Be(themes[0].Id);
    }

    [Fact]
    public void ListThemes_WhenTheHomeVersionMarkerAlreadyMatches_StillListsTheShippedThemes()
    {
        const string version = "1.0.0-test";
        var marker = Path.Combine(HomeAssetsDir, TeensyRomHome.PackageVersionFileName);
        Directory.CreateDirectory(HomeAssetsDir);
        File.WriteAllText(marker, version);
        try
        {
            PackageAssetSync.Sync(Path.Combine(Assembly.GetExecutingAssembly().GetPath(), "Assets"), HomeAssetsDir, version);

            Directory.Exists(HomeShippedDir).Should().BeFalse("a matching marker means the sync copied nothing into the home");
            var themes = NewStore().ListThemes();

            themes.Select(t => t.Id).Should().Equal(ShippedIds);
            themes.Should().OnlyContain(t => t.Kind == ThemeKind.Shipped);
        }
        finally
        {
            File.Delete(marker);
        }
    }

    [Fact]
    public void ListThemes_IgnoresShippedLookalikesInTheHome()
    {
        Directory.CreateDirectory(HomeShippedDir);
        File.Copy(Path.Combine(PackageShippedDir, "cga.json"), Path.Combine(HomeShippedDir, "cga-copy.json"));

        NewStore().ListThemes().Select(t => t.Id).Should().Equal(ShippedIds);
    }

    [Fact]
    public void CreateCustom_GeneratesIdFromName_AndRoundTrips()
    {
        var result = NewStore().CreateCustom("  My  Cool_Theme! ", Colors(5));

        result.Status.Should().Be(ThemeSaveStatus.Saved);
        result.Theme.Should().Match<Theme>(t => t.Id == "my-cool-theme" && t.Name == "My  Cool_Theme!" && t.Kind == ThemeKind.Custom);
        File.Exists(CustomFile("my-cool-theme")).Should().BeTrue();

        var read = NewStore().GetTheme("my-cool-theme");
        read.Should().NotBeNull();
        read!.Kind.Should().Be(ThemeKind.Custom);
        read.Parts.Device.Should().Be(Colors(5));
    }

    [Fact]
    public void CreateCustom_WhenSlugCollides_AppendsNumericSuffix()
    {
        var store = NewStore();

        store.CreateCustom("My Theme", Colors()).Theme!.Id.Should().Be("my-theme");
        store.CreateCustom("my-theme", Colors()).Theme!.Id.Should().Be("my-theme-2");
        store.CreateCustom("my theme!", Colors()).Theme!.Id.Should().Be("my-theme-3");
    }

    [Fact]
    public void CreateCustom_WithSlugOfAShippedId_GetsSuffix()
    {
        NewStore().CreateCustom("CGA!", Colors()).Theme!.Id.Should().Be("cga-2");
    }

    [Theory]
    [InlineData("!!!", "theme")]
    [InlineData("--A--", "a")]
    public void ThemeIds_FromName_HandlesEdges(string name, string expected)
    {
        ThemeIds.FromName(name, _ => false).Should().Be(expected);
    }

    [Fact]
    public void ThemeIds_FromName_CutsToFortyCharacters()
    {
        var id = ThemeIds.FromName(new string('a', 39) + "-" + new string('b', 10), _ => false);

        id.Should().Be(new string('a', 39));
        ThemeIds.IsValid(id).Should().BeTrue();
    }

    [Theory]
    [InlineData("TR Default")]
    [InlineData("  tr default ")]
    public void CreateCustom_WithShippedName_ReturnsNameTaken(string name)
    {
        NewStore().CreateCustom(name, Colors()).Status.Should().Be(ThemeSaveStatus.NameTaken);

        Directory.Exists(CustomDir).Should().BeFalse();
    }

    [Fact]
    public void CreateCustom_WithCustomName_ReturnsNameTakenCaseInsensitively()
    {
        var store = NewStore();
        store.CreateCustom("Mine", Colors());

        store.CreateCustom("MINE", Colors()).Status.Should().Be(ThemeSaveStatus.NameTaken);
    }

    [Fact]
    public void UpdateCustom_RenamesAndRecolors_AndMayChangeOnlyTheCaseOfItsName()
    {
        var store = NewStore();
        var id = store.CreateCustom("Mine", Colors()).Theme!.Id;

        store.UpdateCustom(id, "MINE", Colors(8)).Status.Should().Be(ThemeSaveStatus.Saved);

        var read = NewStore().GetTheme(id)!;
        read.Name.Should().Be("MINE");
        read.Parts.Device.Should().Be(Colors(8));

        store.UpdateCustom(id, "Renamed", Colors(8)).Theme!.Id.Should().Be(id);
    }

    [Fact]
    public void UpdateCustom_ToAnotherThemesName_ReturnsNameTaken()
    {
        var store = NewStore();
        var id = store.CreateCustom("Mine", Colors()).Theme!.Id;
        store.CreateCustom("Other", Colors());

        store.UpdateCustom(id, "other", Colors()).Status.Should().Be(ThemeSaveStatus.NameTaken);
        store.UpdateCustom(id, "black & white", Colors()).Status.Should().Be(ThemeSaveStatus.NameTaken);
        store.GetTheme(id)!.Name.Should().Be("Mine");
    }

    [Fact]
    public void UpdateAndDelete_OfShippedTheme_AreReadOnly()
    {
        var store = NewStore();

        store.UpdateCustom("tr-default", "Edited", Colors()).Status.Should().Be(ThemeSaveStatus.ShippedReadOnly);
        store.DeleteCustom("tr-default").Should().Be(ThemeDeleteStatus.ShippedReadOnly);
        File.Exists(Path.Combine(PackageShippedDir, "tr-default.json")).Should().BeTrue();
    }

    [Fact]
    public void UpdateAndDelete_OfUnknownTheme_AreNotFound()
    {
        var store = NewStore();

        store.UpdateCustom("nope", "Name", Colors()).Status.Should().Be(ThemeSaveStatus.NotFound);
        store.DeleteCustom("nope").Should().Be(ThemeDeleteStatus.NotFound);
        store.GetTheme("nope").Should().BeNull();
    }

    [Fact]
    public void DeleteCustom_RemovesTheFile()
    {
        var store = NewStore();
        var id = store.CreateCustom("Mine", Colors()).Theme!.Id;

        store.DeleteCustom(id).Should().Be(ThemeDeleteStatus.Deleted);

        File.Exists(CustomFile(id)).Should().BeFalse();
        store.ListThemes().Should().OnlyContain(t => t.Kind == ThemeKind.Shipped);
    }

    [Fact]
    public void CorruptCustomFile_IsSkippedWithOneWarning_AndStaysOnDisk()
    {
        var store = NewStore();
        store.CreateCustom("Good", Colors());
        File.WriteAllText(CustomFile("broken"), "{ not json");

        var ids = store.ListThemes().Select(t => t.Id).ToList();

        ids.Should().Contain("good").And.NotContain("broken");
        _log.Received(1).InternalWarning(Arg.Is<string>(m => m.Contains("broken.json")), Arg.Any<string?>());
        File.ReadAllText(CustomFile("broken")).Should().Be("{ not json");
    }

    [Fact]
    public void FileWithMismatchedIdOrOutOfRangeColors_IsSkippedWithWarning()
    {
        var store = NewStore();
        store.CreateCustom("Good", Colors());
        File.Copy(CustomFile("good"), CustomFile("copy"));
        File.WriteAllText(CustomFile("loud"), """
            { "id": "loud", "name": "Loud", "parts": { "device": { "background": 16, "border": 0, "banner": 0, "time": 0, "option": 0, "sources": 0, "name": 0 } } }
            """);

        store.ListThemes().Select(t => t.Id).Should().Contain("good").And.NotContain(["copy", "loud"]);

        _log.Received(1).InternalWarning(Arg.Is<string>(m => m.Contains("copy.json")), Arg.Any<string?>());
        _log.Received(1).InternalWarning(Arg.Is<string>(m => m.Contains("loud.json")), Arg.Any<string?>());
    }

    [Theory]
    [InlineData("../evil")]
    [InlineData("a.b")]
    [InlineData("a/b")]
    [InlineData("a\\b")]
    [InlineData("Upper")]
    [InlineData("-lead")]
    [InlineData("double--hyphen")]
    [InlineData("")]
    public void IdsThatFormPaths_AreRejectedBeforeAnyFileAccess(string id)
    {
        var store = NewStore();

        Action[] calls =
        [
            () => store.GetTheme(id),
            () => store.UpdateCustom(id, "Name", Colors()),
            () => store.DeleteCustom(id)
        ];

        foreach (var call in calls) call.Should().Throw<ArgumentException>();
        Directory.Exists(CustomDir).Should().BeFalse();
    }

    [Fact]
    public void IdLongerThanFortyEightCharacters_IsRejected()
    {
        ThemeIds.IsValid(new string('a', 48)).Should().BeTrue();
        NewStore().Invoking(s => s.GetTheme(new string('a', 49))).Should().Throw<ArgumentException>();
    }

    [Fact]
    public void InvalidNameOrColors_Throw()
    {
        var store = NewStore();

        store.Invoking(s => s.CreateCustom("   ", Colors())).Should().Throw<ArgumentException>();
        store.Invoking(s => s.CreateCustom(new string('x', 25), Colors())).Should().Throw<ArgumentException>();
        store.Invoking(s => s.CreateCustom("Fine", Colors(16))).Should().Throw<ArgumentException>();
        store.Invoking(s => s.CreateCustom("Fine", Colors(-1))).Should().Throw<ArgumentException>();
    }

    [Fact]
    public void CreateCustom_WhenFileCannotBeReplaced_FailsAndLeavesNoTempFile()
    {
        var store = NewStore();
        Directory.CreateDirectory(CustomFile("mine"));

        var result = store.CreateCustom("Mine", Colors());

        result.Should().Be(new ThemeSaveResult(ThemeSaveStatus.Failed));
        Directory.Exists(CustomFile("mine")).Should().BeTrue();
        Directory.GetFiles(CustomDir, "*.tmp").Should().BeEmpty();
        _log.Received(1).InternalError(Arg.Any<string>(), Arg.Any<string?>());
    }

    [Fact]
    public void SaveDeviceRecord_WhenFileCannotBeReplaced_ReturnsFalseAndLeavesNoTempFile()
    {
        var store = NewStore();
        Directory.CreateDirectory(RecordsFile);

        store.SaveDeviceRecord(new DeviceThemeRecord("dev1", Colors(), null, DateTimeOffset.UtcNow)).Should().BeFalse();

        Directory.Exists(RecordsFile).Should().BeTrue();
        Directory.GetFiles(SystemThemesDir, "*.tmp").Should().BeEmpty();
        _log.Received(1).InternalError(Arg.Any<string>(), Arg.Any<string?>());
    }

    [Fact]
    public void DeviceRecords_RoundTrip_PerDevice()
    {
        var store = NewStore();
        var appliedAt = new DateTimeOffset(2026, 10, 28, 12, 30, 0, TimeSpan.Zero);

        store.GetDeviceRecord("dev1").Should().BeNull();
        store.SaveDeviceRecord(new DeviceThemeRecord("dev1", Colors(2), "cga", appliedAt)).Should().BeTrue();
        store.SaveDeviceRecord(new DeviceThemeRecord("dev2", Colors(9), null, appliedAt)).Should().BeTrue();
        store.SaveDeviceRecord(new DeviceThemeRecord("dev1", Colors(4), null, appliedAt)).Should().BeTrue();

        var fresh = NewStore();
        fresh.GetDeviceRecord("dev1").Should().Be(new DeviceThemeRecord("dev1", Colors(4), null, appliedAt));
        fresh.GetDeviceRecord("dev2")!.Colors.Should().Be(Colors(9));
        fresh.GetDeviceRecord("unknown").Should().BeNull();
        _log.DidNotReceive().InternalWarning(Arg.Any<string>(), Arg.Any<string?>());
    }

    [Fact]
    public void DeviceRecords_WithBadDeviceId_Throw()
    {
        var store = NewStore();

        store.Invoking(s => s.GetDeviceRecord("../x")).Should().Throw<ArgumentException>();
        store.Invoking(s => s.SaveDeviceRecord(new DeviceThemeRecord("a b", Colors(), null, DateTimeOffset.UtcNow))).Should().Throw<ArgumentException>();
    }

    [Fact]
    public void CorruptDeviceRecordsFile_ReadsAsNoRecord_WithWarning()
    {
        Directory.CreateDirectory(SystemThemesDir);
        File.WriteAllText(RecordsFile, "{ not json");

        NewStore().GetDeviceRecord("dev1").Should().BeNull();

        _log.Received(1).InternalWarning(Arg.Is<string>(m => m.Contains("device-records.json")), Arg.Any<string?>());
    }
}
