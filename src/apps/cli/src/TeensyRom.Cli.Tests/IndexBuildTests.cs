using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NSubstitute;
using System.Text.Json;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Tests;

/// <summary><c>trom index build</c> through the real tree over a substituted storage service and device log.</summary>
[Collection(ConsoleCollection.Name)]
public sealed class IndexBuildTests : IDisposable
{
    private static readonly DeviceSummary Both = new("a-1", "Alpha", true, "USB COM3", "Connected", SdAvailable: true, UsbAvailable: true);

    private readonly IStorageService _storage = Substitute.For<IStorageService>();
    private readonly IDeviceLogStream _deviceLog = Substitute.For<IDeviceLogStream>();
    private readonly List<(TeensyStorageType Storage, string Path)> _indexed = [];
    private readonly TestHost _host;
    private Action<string> _onLine = _ => { };
    private bool _followStopped;
    private string _stdin = "/from/stdin\n";

    public IndexBuildTests()
    {
        _host = new TestHost(configure: services =>
        {
            services.AddSingleton<IDeviceChooser, DeviceChooser>();
            services.Replace(ServiceDescriptor.Singleton(_storage));
            services.AddSingleton(_deviceLog);
            services.AddSingleton<IStdinPaths>(_ => new StdinPaths(new StringReader(_stdin), inputIsTerminal: false));
        });
        _host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        UseDevice(Both);

        TeensyStorageType current = default;
        _storage.When(s => s.UseStorage(Arg.Any<TeensyStorageType>())).Do(call => current = call.Arg<TeensyStorageType>());
        _storage.Index(Arg.Any<string>()).Returns(call =>
        {
            _indexed.Add((current, call.Arg<string>()));
            _onLine("=> Indexing (SD): /music");
            _onLine("Resetting TeensyROM");
            return Task.CompletedTask;
        });
        _deviceLog.FollowAsync(Arg.Any<Action<string>>(), Arg.Any<CancellationToken>()).Returns(call =>
        {
            _onLine = call.Arg<Action<string>>();
            return Task.FromResult<IAsyncDisposable>(new Stop(() => _followStopped = true));
        });
    }

    public void Dispose() => _host.Dispose();

    private string StdOut => _host.Consoles.StdOut.Replace("\r\n", "\n");

    private string StdErr => _host.Consoles.StdErr;

    private ISettingsService Settings => _host.Services.BuildServiceProvider().GetRequiredService<ISettingsService>();

    private void UseDevice(DeviceSummary device)
    {
        _host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(new[] { device });
        _host.Devices.SelectedDevice.Returns(device);
    }

    private void SetHasIndexed(bool value)
    {
        var settings = Settings.GetSettings();
        settings.HasIndexed = value;
        Settings.SaveSettings(settings);
    }

    [Fact]
    public async Task WithoutAStorage_IndexesEveryAvailableStorage_OneAfterTheOther()
    {
        var exitCode = await _host.RunAsync("index", "build", "/music");

        exitCode.Should().Be(0);
        _indexed.Should().Equal((TeensyStorageType.SD, "/music"), (TeensyStorageType.USB, "/music"));
        StdOut.Should().Be("Indexed sd storage from /music.\nIndexed usb storage from /music.\n");
    }

    [Fact]
    public async Task WithoutAStorage_AndWithoutAPath_IndexesTheWholeStorage()
    {
        await _host.RunAsync("index", "build");

        _indexed.Should().Equal((TeensyStorageType.SD, "/"), (TeensyStorageType.USB, "/"));
    }

    [Fact]
    public async Task WithoutAStorage_SkipsTheOneTheDeviceHasNot()
    {
        UseDevice(Both with { SdAvailable = false });

        await _host.RunAsync("index", "build");

        _indexed.Should().Equal((TeensyStorageType.USB, "/"));
    }

    [Fact]
    public async Task WithNoStorageAvailable_IsNotFound_AndIndexesNothing()
    {
        UseDevice(Both with { SdAvailable = false, UsbAvailable = false });

        var exitCode = await _host.RunAsync("index", "build");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        StdErr.Should().Contain("Alpha has no SD card or USB storage available.");
        _indexed.Should().BeEmpty();
    }

    [Fact]
    public async Task WithAStorage_IndexesOnlyThatOne_EvenWhenTheDeviceReportsItUnavailable()
    {
        UseDevice(Both with { UsbAvailable = false });

        await _host.RunAsync("index", "build", "--storage", "usb");

        _indexed.Should().Equal((TeensyStorageType.USB, "/"));
    }

    [Fact]
    public async Task ADash_ReadsThePathFromStdin()
    {
        await _host.RunAsync("index", "build", "-", "-s", "sd");

        _indexed.Should().Equal((TeensyStorageType.SD, "/from/stdin"));
    }

    [Fact]
    public async Task ABadPath_IsAUsageError_AndIndexesNothing()
    {
        var exitCode = await _host.RunAsync("index", "build", "music");

        exitCode.Should().Be((int)CliExitCode.Usage);
        _indexed.Should().BeEmpty();
    }

    [Fact]
    public async Task ABadPathFromStdin_IsAUsageError_AndIndexesNothing()
    {
        _stdin = "/bad<path\n";

        var exitCode = await _host.RunAsync("index", "build", "-", "-s", "sd");

        exitCode.Should().Be((int)CliExitCode.Usage);
        StdErr.Should().Contain("'/bad<path' is not a valid unix path");
        _indexed.Should().BeEmpty();
        await _deviceLog.DidNotReceive().FollowAsync(Arg.Any<Action<string>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task IndexingLines_GoToStderr_AndNothingElseDoes()
    {
        await _host.RunAsync("index", "build", "-s", "sd");

        StdErr.Should().Contain("=> Indexing (SD): /music").And.NotContain("Resetting TeensyROM");
        StdOut.Should().NotContain("Indexing (SD)");
        _followStopped.Should().BeTrue();
    }

    [Fact]
    public async Task WhenTheLogCantBeFollowed_SaysSo_AndStillIndexes()
    {
        _deviceLog.FollowAsync(Arg.Any<Action<string>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<IAsyncDisposable>(new TeensyApiException("tr-web would not let this CLI follow its log.")));

        var exitCode = await _host.RunAsync("index", "build", "-s", "sd");

        exitCode.Should().Be(0);
        StdErr.Should().Contain("Indexing will run without showing its progress. tr-web would not let this CLI follow its log.");
        _indexed.Should().HaveCount(1);
    }

    [Fact]
    public async Task WhenIndexingFails_TheStreamStops_AndHasIndexedIsNotSet()
    {
        SetHasIndexed(false);
        _storage.Index(Arg.Any<string>()).Returns(Task.FromException(new TeensyApiException("There was an error indexing.")));

        var exitCode = await _host.RunAsync("index", "build", "-s", "sd");

        exitCode.Should().Be((int)CliExitCode.Failed);
        _followStopped.Should().BeTrue();
        Settings.GetSettings().HasIndexed.Should().BeFalse();
    }

    [Fact]
    public async Task AfterIndexing_HasIndexedIsSet()
    {
        SetHasIndexed(false);

        await _host.RunAsync("index", "build", "-s", "sd");

        Settings.GetSettings().HasIndexed.Should().BeTrue();
    }

    [Fact]
    public async Task Json_IsTheStoragesIndexedAndThePath()
    {
        await _host.RunAsync("index", "build", "/music", "--json");

        var result = JsonDocument.Parse(StdOut).RootElement;
        result.EnumerateObject().Select(p => p.Name).Should().Equal("storages", "path");
        result.GetProperty("storages").EnumerateArray().Select(s => s.GetString()).Should().Equal("sd", "usb");
        result.GetProperty("path").GetString().Should().Be("/music");
    }

    private sealed class Stop(Action onStop) : IAsyncDisposable
    {
        public ValueTask DisposeAsync()
        {
            onStop();
            return ValueTask.CompletedTask;
        }
    }
}
