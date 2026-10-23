using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NSubstitute;
using System.Text.Json;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// <c>trom file banned</c> and <c>trom file unban</c> through the real tree over a substituted storage service.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class FileBanListCommandTests : IDisposable
{
    private readonly IStorageService _storage = Substitute.For<IStorageService>();
    private readonly IDeviceChooser _chooser = Substitute.For<IDeviceChooser>();
    private readonly List<TestHost> _hosts = [];

    public FileBanListCommandTests()
    {
        _storage.GetBansAsync(Arg.Any<CancellationToken>()).Returns(new BanEntry[]
        {
            new("/games/bad", BanEntryKind.Folder),
            new("Commando.sid", BanEntryKind.File),
            new("Delta.sid", BanEntryKind.File)
        });
        _storage.LiftBanAsync(Arg.Any<string>(), Arg.Any<BanEntryKind>(), Arg.Any<CancellationToken>())
            .Returns(call => new LiftBanResult(call.Arg<string>(), call.Arg<BanEntryKind>(), true, $"{call.Arg<string>()} is no longer banned."));
    }

    public void Dispose()
    {
        foreach (var host in _hosts) host.Dispose();
    }

    private TestHost NewHost(string stdin = "", bool terminal = false)
    {
        var host = new TestHost(terminal, services =>
        {
            services.AddSingleton(_chooser);
            services.Replace(ServiceDescriptor.Singleton(_storage));
            services.AddSingleton<IStdinPaths>(new StdinPaths(new StringReader(stdin), inputIsTerminal: false));
        });
        host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        _hosts.Add(host);
        return host;
    }

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement;

    private static string[] Lines(string text) => text.Replace("\r\n", "\n").Split('\n', StringSplitOptions.RemoveEmptyEntries);

    private void NoDeviceChosen() => _chooser.ReceivedCalls().Should().BeEmpty();

    // ---- banned ------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Banned_Json_ListsFoldersThenFiles_WithLowercaseKinds_AndChoosesNoDevice()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "banned", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        var bans = Parse(host.Consoles.StdOut).EnumerateArray().ToArray();
        bans.Select(b => (b.GetProperty("entry").GetString(), b.GetProperty("kind").GetString()))
            .Should().Equal(("/games/bad", "folder"), ("Commando.sid", "file"), ("Delta.sid", "file"));
        NoDeviceChosen();
    }

    [Fact]
    public async Task Banned_Piped_WritesEachEntryAsStored_OnePerLine()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "banned");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Lines(host.Consoles.StdOut).Should().Equal("/games/bad", "Commando.sid", "Delta.sid");
    }

    [Fact]
    public async Task Banned_Human_ShowsATableOfEntryAndKind()
    {
        var host = NewHost(terminal: true);

        var exitCode = await host.RunAsync("file", "banned");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        host.Consoles.StdOut.Should().Contain("Entry").And.Contain("Kind").And.Contain("/games/bad").And.Contain("folder").And.Contain("Commando.sid");
    }

    [Fact]
    public async Task Banned_WithNothingBanned_ExitsZero_PlainIsEmpty_JsonIsAnEmptyArray_HumanSaysSo()
    {
        _storage.GetBansAsync(Arg.Any<CancellationToken>()).Returns(Array.Empty<BanEntry>());

        var plain = NewHost();
        (await plain.RunAsync("file", "banned")).Should().Be(0);
        plain.Consoles.StdOut.Should().BeEmpty();

        var json = NewHost();
        (await json.RunAsync("file", "banned", "--json")).Should().Be(0);
        Parse(json.Consoles.StdOut).GetArrayLength().Should().Be(0);

        var human = NewHost(terminal: true);
        (await human.RunAsync("file", "banned")).Should().Be(0);
        (human.Consoles.StdOut + human.Consoles.StdErr).Should().Contain("Nothing is banned.");
    }

    // ---- unban -------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Unban_ABareName_IsAFile_AndChoosesNoDevice()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "unban", "Commando.sid");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _storage.Received(1).LiftBanAsync("Commando.sid", BanEntryKind.File, Arg.Any<CancellationToken>());
        NoDeviceChosen();
    }

    [Fact]
    public async Task Unban_ADevicePath_LiftsTheFilesLastSegment()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "unban", "/music/Commando.sid");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _storage.Received(1).LiftBanAsync("Commando.sid", BanEntryKind.File, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("/games/bad")]
    [InlineData("/games/bad/")]
    [InlineData("/GAMES/BAD")]
    public async Task Unban_AnExactBannedFolder_IsAFolder_LiftedAsStored(string entry)
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "unban", entry);

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _storage.Received(1).LiftBanAsync("/games/bad", BanEntryKind.Folder, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Unban_APathBelowABannedFolder_IsAFile_NotTheFolder()
    {
        var host = NewHost();

        await host.RunAsync("file", "unban", "/games/bad/x.prg");

        await _storage.Received(1).LiftBanAsync("x.prg", BanEntryKind.File, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Unban_ANotBannedEntry_IsOk_SaysSo_AndDoesNotFail()
    {
        _storage.LiftBanAsync("Nope.sid", BanEntryKind.File, Arg.Any<CancellationToken>())
            .Returns(new LiftBanResult("Nope.sid", BanEntryKind.File, false, "engine wording"));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "unban", "Nope.sid", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        var result = Parse(host.Consoles.StdOut).EnumerateArray().Single();
        result.EnumerateObject().Select(p => p.Name).Should().BeEquivalentTo("entry", "kind", "ok", "lifted", "message");
        result.GetProperty("ok").GetBoolean().Should().BeTrue();
        result.GetProperty("lifted").GetBoolean().Should().BeFalse();
        result.GetProperty("message").GetString().Should().Be("Nope.sid is not banned.");
    }

    [Fact]
    public async Task Unban_Piped_WritesTheLiftedEntries_AndNoticesTheNotBannedOnes()
    {
        _storage.LiftBanAsync("Nope.sid", BanEntryKind.File, Arg.Any<CancellationToken>())
            .Returns(new LiftBanResult("Nope.sid", BanEntryKind.File, false, "engine wording"));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "unban", "Commando.sid", "Nope.sid", "/games/bad");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Lines(host.Consoles.StdOut).Should().Equal("Commando.sid", "/games/bad");
        host.Consoles.StdErr.Should().Contain("Nope.sid is not banned.");
    }

    [Fact]
    public async Task Unban_ADash_LiftsEveryEntryFromStdin_AndReadsTheBansOnce()
    {
        var host = NewHost(stdin: "/games/bad\nCommando.sid\nDelta.sid\n");

        var exitCode = await host.RunAsync("file", "unban", "-");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        await _storage.Received(1).LiftBanAsync("/games/bad", BanEntryKind.Folder, Arg.Any<CancellationToken>());
        await _storage.Received(1).LiftBanAsync("Commando.sid", BanEntryKind.File, Arg.Any<CancellationToken>());
        await _storage.Received(1).LiftBanAsync("Delta.sid", BanEntryKind.File, Arg.Any<CancellationToken>());
        await _storage.Received(1).GetBansAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Unban_APartialFailure_LiftsTheRest_AndExitsFailed()
    {
        _storage.LiftBanAsync("Commando.sid", BanEntryKind.File, Arg.Any<CancellationToken>())
            .Returns<LiftBanResult>(_ => throw new TeensyApiException("Settings could not be saved.", 500));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "unban", "Commando.sid", "Delta.sid", "--json");

        exitCode.Should().Be((int)CliExitCode.Failed);
        await _storage.Received(1).LiftBanAsync("Delta.sid", BanEntryKind.File, Arg.Any<CancellationToken>());
        var results = Parse(host.Consoles.StdOut).EnumerateArray().ToArray();
        results[0].GetProperty("ok").GetBoolean().Should().BeFalse();
        results[1].GetProperty("lifted").GetBoolean().Should().BeTrue();
        host.Consoles.StdErr.Should().Contain("1 of 2 entries failed.");
    }
}
