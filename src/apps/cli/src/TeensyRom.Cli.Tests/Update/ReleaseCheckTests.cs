using System.Text.Json;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Tests.PathSetup;
using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

/// <summary>The daily cached look at the releases, driven by a clock that moves only when told to.</summary>
public sealed class ReleaseCheckTests : IDisposable
{
    private readonly Scratch _scratch = new();
    private readonly FakeTimeProvider _time = new();
    private readonly InMemorySettings _settings = new();
    private readonly StubInspector _inspector = new(new InstallInfo(InstallKind.Release, "cli", "root", null));
    private readonly ScriptedClient _client = new();

    public void Dispose() => _scratch.Dispose();

    private string CachePath => _scratch.At("cli/release-check.json");

    private ReleaseCheck Check(string installed = "1.0.0-beta.1", string? rid = "win-x64") =>
        new(_inspector, _client, _settings, _time, installed, rid, CachePath);

    private sealed class ScriptedClient : IReleaseClient
    {
        public List<ReleaseInfo> Releases { get; set; } =
        [
            ReleaseSelectorTests.Release("v1.0.0-beta.2", true, "win-x64"),
            ReleaseSelectorTests.Release("v0.9.5", false, "win-x64"),
            ReleaseSelectorTests.Release("v0.9.0", false, "win-x64")
        ];

        public Exception? Failure { get; set; }

        public Action? OnLookup { get; set; }

        public List<TimeSpan> Lookups { get; } = [];

        public Task<IReadOnlyList<ReleaseInfo>> GetReleasesAsync(TimeSpan timeout, CancellationToken ct = default)
        {
            Lookups.Add(timeout);
            OnLookup?.Invoke();

            return Failure is null ? Task.FromResult<IReadOnlyList<ReleaseInfo>>(Releases) : throw Failure;
        }

        public Task DownloadVerifiedAsync(ReleaseAsset asset, string destination, IProgress<DownloadProgress>? progress, CancellationToken ct = default) =>
            throw new NotSupportedException();
    }

    private JsonElement OnDisk() => JsonDocument.Parse(File.ReadAllText(CachePath)).RootElement;

    // ---- looking up and remembering ------------------------------------------------------------------------

    [Fact]
    public void Cached_BeforeAnyLookup_IsNull()
    {
        Check().Cached().Should().BeNull();
    }

    [Fact]
    public async Task Refresh_LooksUpTheReleasesAndRemembersTheNewest()
    {
        await Check().RefreshAsync(TimeSpan.FromSeconds(5));

        _client.Lookups.Should().Equal(TimeSpan.FromSeconds(5));
        Check().Cached().Should().Be(new UpdateStatus("1.0.0-beta.1", "1.0.0-beta.2", true, InstallKind.Release, _time.GetUtcNow()));
        OnDisk().GetProperty("latest").GetString().Should().Be("1.0.0-beta.2");
        OnDisk().GetProperty("latestStable").GetString().Should().Be("0.9.5");
        OnDisk().TryGetProperty("attemptedAt", out _).Should().BeFalse();
    }

    [Fact]
    public async Task Cached_ForAStableInstall_ReportsTheNewestStableRelease()
    {
        await Check(installed: "0.9.0").RefreshAsync(TimeSpan.FromSeconds(5));

        var status = Check(installed: "0.9.0").Cached()!;

        status.Latest.Should().Be("0.9.5");
        status.Available.Should().BeTrue();
    }

    [Fact]
    public async Task Cached_WhenTheInstallIsTheNewest_IsNotAvailable()
    {
        await Check(installed: "0.9.5").RefreshAsync(TimeSpan.FromSeconds(5));

        var status = Check(installed: "0.9.5").Cached()!;

        status.Latest.Should().Be("0.9.5");
        status.Available.Should().BeFalse();
    }

    [Fact]
    public async Task Cached_WhenNoReleaseHasAPackageForThisPlatform_HasNoLatest()
    {
        _client.Releases = [ReleaseSelectorTests.Release("v1.0.0", false, "linux-x64")];
        await Check().RefreshAsync(TimeSpan.FromSeconds(5));

        var status = Check().Cached()!;

        status.Latest.Should().BeNull();
        status.Available.Should().BeFalse();
    }

    [Fact]
    public async Task Refresh_WritesWithoutLeavingTempFiles()
    {
        await Check().RefreshAsync(TimeSpan.FromSeconds(5));

        Directory.GetFiles(Path.GetDirectoryName(CachePath)!).Should().ContainSingle().Which.Should().Be(CachePath);
    }

    // ---- when to look --------------------------------------------------------------------------------------

    [Fact]
    public async Task Refresh_WithinADayOfTheLastLookup_DoesNotLookAgain()
    {
        await Check().RefreshAsync(TimeSpan.FromSeconds(5));
        _time.Advance(TimeSpan.FromHours(23));

        await Check().RefreshAsync(TimeSpan.FromSeconds(5));

        _client.Lookups.Should().HaveCount(1);
    }

    [Fact]
    public async Task Refresh_ADayAfterTheLastLookup_LooksAgain()
    {
        await Check().RefreshAsync(TimeSpan.FromSeconds(5));
        _time.Advance(TimeSpan.FromHours(24));

        await Check().RefreshAsync(TimeSpan.FromSeconds(5));

        _client.Lookups.Should().HaveCount(2);
    }

    [Fact]
    public async Task Refresh_WhenTheClockWasSetBack_TreatsTheLastLookupAsLongAgo()
    {
        await Check().RefreshAsync(TimeSpan.FromSeconds(5));
        _time.Advance(TimeSpan.FromDays(-30));

        await Check().RefreshAsync(TimeSpan.FromSeconds(5));

        _client.Lookups.Should().HaveCount(2);
    }

    [Fact]
    public async Task Refresh_AFailedLookupNeverThrows_AndIsRetriedAfterAnHour()
    {
        _client.Failure = new CliException(CliExitCode.Failed, "GitHub refused the release lookup (rate limit) — try again later.");

        var first = () => Check().RefreshAsync(TimeSpan.FromSeconds(5));
        await first.Should().NotThrowAsync();
        Check().Cached().Should().BeNull();

        _time.Advance(TimeSpan.FromMinutes(59));
        await Check().RefreshAsync(TimeSpan.FromSeconds(5));
        _client.Lookups.Should().HaveCount(1);

        _time.Advance(TimeSpan.FromMinutes(1));
        await Check().RefreshAsync(TimeSpan.FromSeconds(5));
        _client.Lookups.Should().HaveCount(2);
    }

    [Fact]
    public async Task Refresh_AFailureAfterASuccess_KeepsWhatWasKnown()
    {
        await Check().RefreshAsync(TimeSpan.FromSeconds(5));
        _client.Failure = new HttpRequestException("offline");
        _time.Advance(TimeSpan.FromDays(2));

        await Check().RefreshAsync(TimeSpan.FromSeconds(5));

        Check().Cached().Should().Match<UpdateStatus>(status => status.Latest == "1.0.0-beta.2" && status.Available);
    }

    [Fact]
    public async Task Refresh_RecordsTheAttemptBeforeLookingSoACommandThatEndsFirstDoesNotRetryOnEveryRun()
    {
        _client.OnLookup = () => OnDisk().TryGetProperty("attemptedAt", out _).Should().BeTrue();

        await Check().RefreshAsync(TimeSpan.FromSeconds(5));

        _client.Lookups.Should().HaveCount(1);
    }

    [Fact]
    public async Task Refresh_WhenTheRecordCantBeWritten_StillNeverThrows()
    {
        Directory.CreateDirectory(CachePath);

        var refresh = () => Check().RefreshAsync(TimeSpan.FromSeconds(5));

        await refresh.Should().NotThrowAsync();
    }

    // ---- when not to look ----------------------------------------------------------------------------------

    [Fact]
    public async Task WhenTheSettingIsOff_NothingIsLookedUpOrReported()
    {
        await Check().RefreshAsync(TimeSpan.FromSeconds(5));
        var settings = _settings.GetSettings();
        settings.UpdateCheck = false;
        _settings.SaveSettings(settings);
        _time.Advance(TimeSpan.FromDays(2));

        await Check().RefreshAsync(TimeSpan.FromSeconds(5));

        _client.Lookups.Should().HaveCount(1);
        Check().Cached().Should().BeNull();
    }

    [Theory]
    [InlineData(nameof(InstallKind.Source))]
    [InlineData(nameof(InstallKind.Unknown))]
    public async Task ForASourceBuildOrAnUnknownInstall_NothingIsLookedUp(string kindName)
    {
        _inspector.Info = _inspector.Info with { Kind = Enum.Parse<InstallKind>(kindName) };

        await Check().RefreshAsync(TimeSpan.FromSeconds(5));

        _client.Lookups.Should().BeEmpty();
        File.Exists(CachePath).Should().BeFalse();
    }

    [Fact]
    public async Task ForAHomebrewInstall_TheLookupIsMadeLikeAnyOther()
    {
        _inspector.Info = _inspector.Info with { Kind = InstallKind.Homebrew };

        await Check().RefreshAsync(TimeSpan.FromSeconds(5));

        Check().Cached()!.InstallKind.Should().Be(InstallKind.Homebrew);
    }

    [Theory]
    [InlineData("Unknown version", "win-x64")]
    [InlineData("1.0.0-beta.1", null)]
    public async Task WithoutAComparableVersionOrAPlatform_NothingIsLookedUp(string installed, string? rid)
    {
        await Check(installed, rid).RefreshAsync(TimeSpan.FromSeconds(5));

        _client.Lookups.Should().BeEmpty();
    }

    // ---- the file ------------------------------------------------------------------------------------------

    [Theory]
    [InlineData("")]
    [InlineData("{ not json")]
    [InlineData("[1, 2]")]
    [InlineData("null")]
    public async Task ACorruptFile_ReadsAsNothing_AndTheNextRefreshReplacesIt(string content)
    {
        _scratch.Write("cli/release-check.json", content);

        Check().Cached().Should().BeNull();
        Check().NotifiedAt().Should().BeNull();

        await Check().RefreshAsync(TimeSpan.FromSeconds(5));

        Check().Cached().Should().NotBeNull();
    }

    [Fact]
    public async Task Record_KeepsWhenTheNoticeWasLastPrinted()
    {
        var check = Check();
        await check.RefreshAsync(TimeSpan.FromSeconds(5));
        check.MarkNotified();
        var notified = _time.GetUtcNow();
        _time.Advance(TimeSpan.FromDays(2));

        await check.RefreshAsync(TimeSpan.FromSeconds(5));

        check.NotifiedAt().Should().Be(notified);
        check.Cached()!.CheckedAt.Should().Be(_time.GetUtcNow());
    }

    [Fact]
    public async Task MarkNotified_RemembersWhenWithoutChangingWhatWasFound()
    {
        var check = Check();
        await check.RefreshAsync(TimeSpan.FromSeconds(5));
        var found = check.Cached();
        _time.Advance(TimeSpan.FromHours(3));

        check.MarkNotified();

        check.NotifiedAt().Should().Be(_time.GetUtcNow());
        check.Cached().Should().Be(found);
    }

    [Fact]
    public void MarkNotified_WithNothingRecorded_WritesNothing()
    {
        Check().MarkNotified();

        File.Exists(CachePath).Should().BeFalse();
    }

    // ---- the current status --------------------------------------------------------------------------------

    [Fact]
    public async Task Current_LooksUpThenReports()
    {
        var status = await Check().CurrentAsync(TimeSpan.FromSeconds(3));

        status.Should().Be(new UpdateStatus("1.0.0-beta.1", "1.0.0-beta.2", true, InstallKind.Release, _time.GetUtcNow()));
        _client.Lookups.Should().Equal(TimeSpan.FromSeconds(3));
    }

    [Fact]
    public async Task Current_WhenTheLookupFailsAndNothingIsKnown_SaysSoWithoutALatestVersion()
    {
        _client.Failure = new HttpRequestException("offline");

        var status = await Check().CurrentAsync(TimeSpan.FromSeconds(3));

        status.Should().Be(new UpdateStatus("1.0.0-beta.1", null, false, InstallKind.Release, null));
    }

    [Fact]
    public async Task Current_ForASourceBuild_ReportsItsKindAndMakesNoLookup()
    {
        _inspector.Info = _inspector.Info with { Kind = InstallKind.Source };

        var status = await Check().CurrentAsync(TimeSpan.FromSeconds(3));

        status.Should().Be(new UpdateStatus("1.0.0-beta.1", null, false, InstallKind.Source, null));
        _client.Lookups.Should().BeEmpty();
    }

    [Fact]
    public async Task Current_KeepsAnUnreadableVersionAsItIs()
    {
        var status = await Check(installed: "Unknown version").CurrentAsync(TimeSpan.FromSeconds(3));

        status.Installed.Should().Be("Unknown version");
    }
}
