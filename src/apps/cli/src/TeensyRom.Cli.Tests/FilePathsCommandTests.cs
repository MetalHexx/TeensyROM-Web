using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NSubstitute;
using System.Text.Json;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Storage.Entities;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// <c>trom file favorite|unfavorite|ban</c> through the real tree over a substituted storage service.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class FilePathsCommandTests : IDisposable
{
    private static readonly DeviceSummary Alpha = new("a-1", "Alpha", true, "USB COM3", "Connected", SdAvailable: true, UsbAvailable: true);

    private readonly IStorageService _storage = Substitute.For<IStorageService>();
    private readonly List<TestHost> _hosts = [];
    private TeensyStorageType _storageType = TeensyStorageType.SD;

    public FilePathsCommandTests()
    {
        _storage.StorageType.Returns(_ => _storageType);
        _storage.When(s => s.UseStorage(Arg.Any<TeensyStorageType>())).Do(call => _storageType = call.Arg<TeensyStorageType>());
        _storage.GetFile(Arg.Any<string>()).Returns((ILaunchableItem?)null);
        _storage.BanFile(Arg.Any<string>(), Arg.Any<TeensyStorageType>())
            .Returns(call => new BanResult(Name(call.Arg<string>()), false, $"{Name(call.Arg<string>())} is now banned."));
    }

    public void Dispose()
    {
        foreach (var host in _hosts) host.Dispose();
    }

    private TestHost NewHost(string stdin = "")
    {
        var host = new TestHost(false, services =>
        {
            services.AddSingleton<IDeviceChooser, DeviceChooser>();
            services.Replace(ServiceDescriptor.Singleton(_storage));
            services.AddSingleton<IStdinPaths>(new StdinPaths(new StringReader(stdin), inputIsTerminal: false));
        });
        host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(new[] { Alpha });
        host.Devices.SelectedDevice.Returns(Alpha);
        _hosts.Add(host);
        return host;
    }

    private static string Name(string path) => path[(path.LastIndexOf('/') + 1)..];

    private static SongItem Song(string path) => new() { Name = Name(path), Path = path };

    private void Exists(string path) => _storage.GetFile(path).Returns(Song(path));

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement;

    // ---- ban ---------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Ban_BansEveryPathOnTheChosenStorage_WithoutLookingAnyFileUp()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "ban", "/music/a.sid", "/games/b.prg", "--storage", "usb");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _storage.Received(1).BanFile("/music/a.sid", TeensyStorageType.USB);
        await _storage.Received(1).BanFile("/games/b.prg", TeensyStorageType.USB);
        await _storage.DidNotReceive().GetFile(Arg.Any<string>());
        await _storage.DidNotReceive().GetDirectory(Arg.Any<string>());
    }

    [Fact]
    public async Task Ban_Json_IsAnArrayOfPerPathResults_WithTheBanDetails()
    {
        _storage.BanFile("/music/b.sid", TeensyStorageType.SD).Returns(new BanResult("b.sid", true, "b.sid was already banned."));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "ban", "/music/a.sid", "/music/b.sid", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        var results = Parse(host.Consoles.StdOut).EnumerateArray().ToArray();
        results.Should().HaveCount(2);
        results[0].EnumerateObject().Select(p => p.Name).Should().BeEquivalentTo("path", "ok", "message", "bannedFileName", "alreadyBanned");
        results[0].GetProperty("path").GetString().Should().Be("/music/a.sid");
        results[0].GetProperty("alreadyBanned").GetBoolean().Should().BeFalse();
        results[1].GetProperty("ok").GetBoolean().Should().BeTrue();
        results[1].GetProperty("bannedFileName").GetString().Should().Be("b.sid");
        results[1].GetProperty("alreadyBanned").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task Ban_ADash_BansEveryPathFromStdin_AndPipedWritesThePaths()
    {
        var host = NewHost(stdin: "/music/a.sid\n/music/b.sid\n");

        var exitCode = await host.RunAsync("file", "ban", "-");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _storage.Received(1).BanFile("/music/a.sid", TeensyStorageType.SD);
        await _storage.Received(1).BanFile("/music/b.sid", TeensyStorageType.SD);
        host.Consoles.StdOut.Replace("\r\n", "\n").Should().Be("/music/a.sid\n/music/b.sid\n");
    }

    [Fact]
    public async Task Ban_ANotFoundAmongSuccesses_BansTheRest_AndExitsNotFound()
    {
        _storage.BanFile("/music/gone.sid", Arg.Any<TeensyStorageType>()).Returns<BanResult>(_ => throw new TeensyApiException("No such file.", 404));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "ban", "/music/gone.sid", "/music/a.sid", "--json");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        await _storage.Received(1).BanFile("/music/a.sid", TeensyStorageType.SD);
        var results = Parse(host.Consoles.StdOut).EnumerateArray().ToArray();
        results[0].GetProperty("ok").GetBoolean().Should().BeFalse();
        results[0].GetProperty("message").GetString().Should().Be("No such file.");
        results[1].GetProperty("ok").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task Ban_AnyOtherFailure_WinsOverNotFound()
    {
        _storage.BanFile("/music/gone.sid", Arg.Any<TeensyStorageType>()).Returns<BanResult>(_ => throw new TeensyApiException("No such file.", 404));
        _storage.BanFile("/music/bad.sid", Arg.Any<TeensyStorageType>()).Returns<BanResult>(_ => throw new TeensyApiException("The device is busy.", 500));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "ban", "/music/gone.sid", "/music/bad.sid");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain("2 of 2 paths failed.");
    }

    [Fact]
    public async Task Ban_ABadPath_IsAUsageError_AndBansNothing()
    {
        var host = NewHost(stdin: "/music/a.sid\nmusic/b.sid\n");

        var exitCode = await host.RunAsync("file", "ban", "-");

        exitCode.Should().Be((int)CliExitCode.Usage);
        await _storage.DidNotReceiveWithAnyArgs().BanFile(default!, default);
    }

    // ---- favorite / unfavorite ---------------------------------------------------------------------------------------

    [Fact]
    public async Task Favorite_ResolvesEachPathExactly_ThenTagsIt()
    {
        Exists("/music/a.sid");
        Exists("/music/b.sid");
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "favorite", "/music/a.sid", "/music/b.sid", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _storage.Received(1).SaveFavorite(Arg.Is<ILaunchableItem>(item => item.Path == "/music/a.sid"));
        await _storage.Received(1).SaveFavorite(Arg.Is<ILaunchableItem>(item => item.Path == "/music/b.sid"));
        Parse(host.Consoles.StdOut).EnumerateArray().Select(r => r.GetProperty("ok").GetBoolean()).Should().Equal(true, true);
    }

    [Fact]
    public async Task Favorite_AMissingFile_IsReportedAndTheRestStillTagged_ExitingNotFound()
    {
        Exists("/music/b.sid");
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "favorite", "/music/missing.sid", "/music/b.sid", "--json");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        await _storage.Received(1).SaveFavorite(Arg.Is<ILaunchableItem>(item => item.Path == "/music/b.sid"));
        var results = Parse(host.Consoles.StdOut).EnumerateArray().ToArray();
        results[0].GetProperty("ok").GetBoolean().Should().BeFalse();
        results[0].GetProperty("path").GetString().Should().Be("/music/missing.sid");
    }

    [Fact]
    public async Task Unfavorite_ReadsPathsFromStdin_AndUntagsEachFavorite()
    {
        Exists("/favorites/music/a.sid");
        var host = NewHost(stdin: "/favorites/music/a.sid\n");

        var exitCode = await host.RunAsync("file", "unfavorite", "-");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _storage.Received(1).RemoveFavorite(Arg.Is<ILaunchableItem>(item => item.Path == "/favorites/music/a.sid"));
    }

    [Fact]
    public async Task Unfavorite_AFailureOtherThanNotFound_ExitsFailed()
    {
        Exists("/favorites/music/a.sid");
        _storage.RemoveFavorite(Arg.Any<ILaunchableItem>()).Returns<Task>(_ => throw new TeensyApiException("The device is busy.", 500));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "unfavorite", "/favorites/music/a.sid");

        exitCode.Should().Be((int)CliExitCode.Failed);
    }
}
