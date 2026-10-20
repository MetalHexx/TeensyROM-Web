using TeensyRom.Cli.PathSetup;

namespace TeensyRom.Cli.Tests.PathSetup;

public sealed class PathRegistrarWindowsTests : IDisposable
{
    private readonly PathSandbox _sandbox = new();
    private readonly InMemorySettings _settings = new();

    public void Dispose() => _sandbox.Dispose();

    private PathRegistrar Registrar(string installFolder, FakeUserPathStore store, string? pathVariable = null) =>
        new(_sandbox.Environment(installFolder, PathPlatform.Windows, pathVariable: pathVariable), store, _settings);

    [Fact]
    public void Add_AppendsTheFolder_KeepsOtherEntriesVerbatim_AndRecordsIt()
    {
        var folder = _sandbox.InstallFolder("trom");
        var store = new FakeUserPathStore(@"%USERPROFILE%\bin;C:\Tools");

        var change = Registrar(folder, store).Add();

        change.Changed.Should().BeTrue();
        store.Value.Should().Be($@"%USERPROFILE%\bin;C:\Tools;{folder}");
        _settings.GetSettings().PathEntriesAdded.Should().Equal(folder);
    }

    [Fact]
    public void Add_Twice_ChangesNothingTheSecondTime()
    {
        var folder = _sandbox.InstallFolder("trom");
        var store = new FakeUserPathStore(@"C:\Tools");
        var registrar = Registrar(folder, store);

        registrar.Add();
        var again = registrar.Add();

        again.Changed.Should().BeFalse();
        store.Writes.Should().Be(1);
        _settings.GetSettings().PathEntriesAdded.Should().Equal(folder);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public void Add_TreatsAnEntryThatDiffersOnlyByCaseOrTrailingSlashAsTheSame(bool upperCase, bool trailingSlash)
    {
        var folder = _sandbox.InstallFolder("trom");
        var entry = (upperCase ? folder.ToUpperInvariant() : folder) + (trailingSlash ? @"\" : string.Empty);
        var store = new FakeUserPathStore(entry);

        var change = Registrar(folder, store).Add();

        change.Changed.Should().BeFalse();
        store.Writes.Should().Be(0);
        _settings.GetSettings().PathEntriesAdded.Should().BeEmpty("an entry the user put there is not trom's to remove");
    }

    [Fact]
    public void Remove_TakesOutOnlyTheRecordedEntries()
    {
        var folder = _sandbox.InstallFolder("trom");
        var store = new FakeUserPathStore(@"%USERPROFILE%\bin;C:\Tools");
        var registrar = Registrar(folder, store);
        registrar.Add();

        var change = registrar.Remove();

        change.Changed.Should().BeTrue();
        change.Locations.Should().Equal(PathRegistrar.WindowsLocation);
        store.Value.Should().Be(@"%USERPROFILE%\bin;C:\Tools");
        _settings.GetSettings().PathEntriesAdded.Should().BeEmpty();
    }

    [Fact]
    public void Remove_LeavesAnEntryTromDidNotAdd()
    {
        var folder = _sandbox.InstallFolder("trom");
        var store = new FakeUserPathStore(folder);

        var change = Registrar(folder, store).Remove();

        change.Changed.Should().BeFalse();
        change.Locations.Should().BeEmpty();
        store.Value.Should().Be(folder);
        store.Writes.Should().Be(0);
    }

    [Fact]
    public void Add_FromANewFolder_DropsTheRecordedEntryWhoseFolderNoLongerHoldsTrom()
    {
        var oldFolder = _sandbox.InstallFolder("old");
        var store = new FakeUserPathStore(@"C:\Tools");
        Registrar(oldFolder, store).Add();
        File.Delete(Path.Combine(oldFolder, "trom.exe"));
        var newFolder = _sandbox.InstallFolder("new");

        var change = Registrar(newFolder, store).Add();

        change.Changed.Should().BeTrue();
        store.Value.Should().Be($@"C:\Tools;{newFolder}");
        _settings.GetSettings().PathEntriesAdded.Should().Equal(newFolder);
    }

    [Fact]
    public void Add_FromANewFolder_KeepsARecordedEntryThatStillHoldsTrom()
    {
        var firstFolder = _sandbox.InstallFolder("first");
        var secondFolder = _sandbox.InstallFolder("second");
        var store = new FakeUserPathStore();
        Registrar(firstFolder, store).Add();

        Registrar(secondFolder, store).Add();

        store.Value.Should().Be($"{firstFolder};{secondFolder}");
        _settings.GetSettings().PathEntriesAdded.Should().Equal(firstFolder, secondFolder);
    }

    [Fact]
    public void Status_ListsTheManagedEntries_AndMarksOneWhoseFolderLostTromAsStale()
    {
        var folder = _sandbox.InstallFolder("trom");
        var registrar = Registrar(folder, new FakeUserPathStore());
        registrar.Add();

        registrar.Status().Entries.Should().ContainSingle()
            .Which.Should().Be(new PathEntry(PathRegistrar.WindowsLocation, folder, Stale: false));

        File.Delete(Path.Combine(folder, "trom.exe"));

        registrar.Status().Entries.Should().ContainSingle().Which.Stale.Should().BeTrue();
    }

    [Fact]
    public void Status_OnPath_IsTrueOnlyWhenAProcessPathDirectoryHoldsTrom()
    {
        var folder = _sandbox.InstallFolder("trom");
        var elsewhere = _sandbox.EmptyFolder("elsewhere");
        var store = new FakeUserPathStore();

        Registrar(folder, store, $"{elsewhere};{elsewhere}").Status().OnPath.Should().BeFalse();
        Registrar(folder, store, $"{elsewhere};{folder}").Status().OnPath.Should().BeTrue();
    }
}
