using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

/// <summary>Staging a package: real archives on disk, a download that copies one in, and a fake trom to run.</summary>
public sealed class PackageStagerTests : IDisposable
{
    private readonly Scratch _scratch = new();
    private readonly ScriptedFileOps _files = new(new PhysicalFileOps());

    public void Dispose() => _scratch.Dispose();

    /// <summary>Stands in for the release server: "downloads" a prepared archive and records what was asked for.</summary>
    private sealed class CopyingClient(string archive, Exception? failure = null) : IReleaseClient
    {
        public List<string> Downloads { get; } = [];

        public Task<IReadOnlyList<ReleaseInfo>> GetReleasesAsync(TimeSpan timeout, CancellationToken ct = default) => throw new NotSupportedException();

        public Task DownloadVerifiedAsync(ReleaseAsset asset, string destination, IProgress<DownloadProgress>? progress, CancellationToken ct = default)
        {
            Downloads.Add(destination);

            if (failure is not null) throw failure;

            File.Copy(archive, destination, overwrite: true);
            return Task.CompletedTask;
        }
    }

    private string Root => _scratch.At("install");

    private ReleaseInfo Release(string rid) => ReleaseSelectorTests.Release("v1.0.0-beta.2", true, rid);

    private static FakeProcessRunner Trom(string reports) =>
        new((_, _) => FakeProcessRunner.Ok($"{reports}\nOS: test\nArchitecture: X64\n"));

    private Task<string> Stage(string rid, string archive, FakeProcessRunner runner, CopyingClient? client = null)
    {
        var release = Release(rid);
        var asset = release.Assets.Single() with { Size = new FileInfo(archive).Length };

        return new PackageStager(client ?? new CopyingClient(archive), runner, _files).StageAsync(Root, release, asset, rid, null, default);
    }

    private string Archive(string rid, IEnumerable<(string Name, string Content)> entries)
    {
        var path = _scratch.At(PlatformRid.AssetName(SemVersionTests.V("1.0.0-beta.2"), rid));

        if (PlatformRid.IsWindows(rid)) PackageBuilder.WriteZip(path, entries);
        else PackageBuilder.WriteTarGz(path, entries);

        return path;
    }

    // ---- the happy path ------------------------------------------------------------------------------------

    [Theory]
    [InlineData("win-x64")]
    [InlineData("linux-x64")]
    [InlineData("osx-arm64")]
    public async Task Stage_DownloadsUnpacksAndChecksTheTromTheyHold(string rid)
    {
        var archive = Archive(rid, PackageBuilder.Entries(rid));
        var runner = Trom("trom 1.0.0-beta.2");
        var client = new CopyingClient(archive);

        var staging = await Stage(rid, archive, runner, client);

        staging.Should().Be(Path.Combine(Root, ".trom-update", "staging"));
        client.Downloads.Should().ContainSingle().Which.Should().StartWith(Path.Combine(Root, ".trom-update", "download"));
        File.ReadAllText(Path.Combine(staging, "README.txt")).Should().Be("new readme");
        File.ReadAllText(Path.Combine(staging, "api", PlatformRid.ApiExecutable(rid))).Should().Be("new api");
        File.ReadAllText(Path.Combine(staging, "api", "Assets", "System", "Config", "readme.txt")).Should().Be("asset");
        runner.Calls.Should().ContainSingle().Which.Should().Match<(string File, string[] Args, TimeSpan Timeout)>(
            call => call.File == Path.Combine(staging, "cli", PlatformRid.TromExecutable(rid))
                && call.Args.SequenceEqual(new[] { "--version" })
                && call.Timeout == TimeSpan.FromSeconds(10));
    }

    [Fact]
    public async Task Stage_OnUnix_MakesBothExecutablesExecutable()
    {
        if (OperatingSystem.IsWindows()) return;

        var archive = Archive("linux-x64", PackageBuilder.Entries("linux-x64"));

        var staging = await Stage("linux-x64", archive, Trom("trom 1.0.0-beta.2"));

        foreach (var exe in new[] { Path.Combine("api", "TeensyRom.Api"), Path.Combine("cli", "trom") })
        {
            File.GetUnixFileMode(Path.Combine(staging, exe)).Should().HaveFlag(UnixFileMode.UserExecute, exe);
        }
    }

    [Fact]
    public async Task Stage_ClearsAnEarlierStaging()
    {
        _scratch.Write("install/.trom-update/staging/leftover.txt", "old");
        var archive = Archive("win-x64", PackageBuilder.Entries("win-x64"));

        var staging = await Stage("win-x64", archive, Trom("trom 1.0.0-beta.2"));

        File.Exists(Path.Combine(staging, "leftover.txt")).Should().BeFalse();
    }

    // ---- refusals ------------------------------------------------------------------------------------------

    [Fact]
    public async Task Stage_WhenThePackageIsIncomplete_NamesWhatIsMissingAndNeverRunsIt()
    {
        var entries = PackageBuilder.Entries("win-x64").Where(e => e.Name is not ("README.txt" or "api/wwwroot/index.html"));
        var runner = Trom("trom 1.0.0-beta.2");

        var stage = () => Stage("win-x64", Archive("win-x64", entries), runner);

        var error = (await stage.Should().ThrowAsync<CliException>()).Which;
        error.Message.Should().Contain("README.txt").And.Contain("api/wwwroot/index.html").And.Contain("nothing was changed");
        runner.Calls.Should().BeEmpty();
    }

    [Fact]
    public async Task Stage_WhenThePackageHasATopLevelFolder_ItIsIncomplete()
    {
        var entries = PackageBuilder.Entries("linux-x64").Select(e => ($"TeensyROM-Suite/{e.Name}", e.Content));

        var stage = () => Stage("linux-x64", Archive("linux-x64", entries), Trom("trom 1.0.0-beta.2"));

        await stage.Should().ThrowAsync<CliException>();
    }

    [Fact]
    public async Task Stage_RefusesAZipEntryThatWouldLeaveTheStagingFolder()
    {
        var entries = PackageBuilder.Entries("win-x64").Append(("../../evil.txt", "boom"));

        var stage = () => Stage("win-x64", Archive("win-x64", entries), Trom("trom 1.0.0-beta.2"));

        (await stage.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("outside");
        File.Exists(Path.Combine(Root, ".trom-update", "evil.txt")).Should().BeFalse();
        File.Exists(Path.Combine(Root, "evil.txt")).Should().BeFalse();
    }

    [Fact]
    public async Task Stage_RefusesATarEntryThatWouldLeaveTheStagingFolder()
    {
        var entries = PackageBuilder.Entries("linux-x64").Append(("../../evil.txt", "boom"));

        var stage = () => Stage("linux-x64", Archive("linux-x64", entries), Trom("trom 1.0.0-beta.2"));

        (await stage.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("outside");
        File.Exists(Path.Combine(Root, "evil.txt")).Should().BeFalse();
    }

    [Theory]
    [InlineData("/etc/evil.txt")]
    [InlineData("api/../../evil.txt")]
    [InlineData("..\\evil.txt")]
    public void Target_RefusesAnythingNotInsideTheDestination(string name)
    {
        var destination = _scratch.At("staging");

        var target = () => PackageStager.Target(destination, name);

        target.Should().Throw<CliException>();
    }

    [Theory]
    [InlineData("./", null)]
    [InlineData(".", null)]
    [InlineData("./api/TeensyRom.Api", "api/TeensyRom.Api")]
    [InlineData("api\\appsettings.json", "api/appsettings.json")]
    [InlineData("README.txt", "README.txt")]
    public void Target_PlacesEntriesInsideTheDestination(string name, string? expected)
    {
        var destination = _scratch.At("staging");

        var target = PackageStager.Target(destination, name);

        target.Should().Be(expected is null ? null : Path.GetFullPath(Path.Combine(destination, expected)));
    }

    [Fact]
    public async Task Stage_RefusesAnArchiveThatIsNotOne()
    {
        var path = _scratch.Write("TeensyROM-Suite-1.0.0-beta.2-linux-x64.tar.gz", "this is not gzip");

        var stage = () => Stage("linux-x64", path, Trom("trom 1.0.0-beta.2"));

        (await stage.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("Couldn't unpack");
    }

    [Fact]
    public async Task Stage_WithTooLittleFreeSpace_RefusesBeforeDownloading()
    {
        var archive = Archive("win-x64", PackageBuilder.Entries("win-x64"));
        var client = new CopyingClient(archive);
        _files.Free = new FileInfo(archive).Length * PackageStager.SpaceFactor - 1;

        var stage = () => Stage("win-x64", archive, Trom("trom 1.0.0-beta.2"), client);

        (await stage.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("free disk space");
        client.Downloads.Should().BeEmpty();
    }

    [Fact]
    public async Task Stage_WhenTheDownloadFails_PassesTheFailureOn()
    {
        var archive = Archive("win-x64", PackageBuilder.Entries("win-x64"));
        var client = new CopyingClient(archive, new CliException(CliExitCode.Failed, "does not match its checksum"));

        var stage = () => Stage("win-x64", archive, Trom("trom 1.0.0-beta.2"), client);

        (await stage.Should().ThrowAsync<CliException>()).Which.Message.Should().Be("does not match its checksum");
    }

    // ---- running the staged trom ---------------------------------------------------------------------------

    [Fact]
    public async Task Stage_WhenTheStagedTromReportsAnotherVersion_Refuses()
    {
        var archive = Archive("win-x64", PackageBuilder.Entries("win-x64"));

        var stage = () => Stage("win-x64", archive, Trom("trom 1.0.0-beta.1"));

        (await stage.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("trom 1.0.0-beta.1").And.Contain("instead of trom 1.0.0-beta.2");
    }

    [Fact]
    public async Task Stage_WhenTheStagedTromReportsNoVersion_Refuses()
    {
        var archive = Archive("win-x64", PackageBuilder.Entries("win-x64"));

        var stage = () => Stage("win-x64", archive, Trom("hello"));

        await stage.Should().ThrowAsync<CliException>();
    }

    [Theory]
    [InlineData("exit")]
    [InlineData("timeout")]
    [InlineData("start")]
    public async Task Stage_WhenTheStagedTromWontRun_Refuses(string how)
    {
        var archive = Archive("win-x64", PackageBuilder.Entries("win-x64"));
        var runner = new FakeProcessRunner((_, _) => how switch
        {
            "exit" => new ProcessResult(1, "", "bad"),
            "timeout" => new ProcessResult(-1, "", "", TimedOut: true),
            _ => new ProcessResult(-1, "", "", StartFailure: "%1 is not a valid Win32 application")
        });

        var stage = () => Stage("win-x64", archive, runner);

        (await stage.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("won't run here").And.Contain("nothing was changed");
    }
}
