using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using System.Text.Json;
using TeensyRom.Cli.PathSetup;

namespace TeensyRom.Cli.Tests.PathSetup;

/// <summary>
/// <c>trom path add|remove|status</c> through the real command tree, over a fake Windows user PATH and in-memory
/// settings.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class PathCommandTests : IDisposable
{
    private readonly PathSandbox _sandbox = new();
    private readonly FakeUserPathStore _store = new(@"C:\Tools");
    private readonly PathRegistrar _registrar;
    private readonly string _folder;

    public PathCommandTests()
    {
        _folder = _sandbox.InstallFolder("trom");
        _registrar = new PathRegistrar(_sandbox.Environment(_folder, PathPlatform.Windows, pathVariable: string.Empty), _store, new InMemorySettings());
    }

    public void Dispose() => _sandbox.Dispose();

    /// <summary>One invocation on its own host, so each has its own stdout.</summary>
    private async Task<(int ExitCode, TestHost Host)> RunAsync(params string[] args)
    {
        var host = new TestHost(configure: services => services.AddSingleton(_registrar));
        var exitCode = await host.RunAsync(args);

        await host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);

        return (exitCode, host);
    }

    private async Task<JsonElement> RunJsonAsync(params string[] args)
    {
        var (exitCode, host) = await RunAsync([.. args, "--json"]);
        using var _ = host;

        exitCode.Should().Be(0);
        return JsonDocument.Parse(host.Consoles.StdOut).RootElement.Clone();
    }

    [Fact]
    public async Task AddThenStatusThenRemove_PutsTheEntryInAndTakesExactlyThatOut()
    {
        (await RunJsonAsync("path", "add")).GetProperty("changed").GetBoolean().Should().BeTrue();
        _store.Value.Should().Be($@"C:\Tools;{_folder}");

        var status = await RunJsonAsync("path", "status");
        status.GetProperty("onPath").GetBoolean().Should().BeFalse();
        var entry = status.GetProperty("entries").EnumerateArray().Single();
        entry.GetProperty("folder").GetString().Should().Be(_folder);
        entry.GetProperty("stale").GetBoolean().Should().BeFalse();

        (await RunJsonAsync("path", "remove")).GetProperty("changed").GetBoolean().Should().BeTrue();
        _store.Value.Should().Be(@"C:\Tools");
    }

    [Fact]
    public async Task AddAgain_ReportsNoChange()
    {
        await RunJsonAsync("path", "add");
        var writes = _store.Writes;

        var change = await RunJsonAsync("path", "add");

        _store.Writes.Should().Be(writes);
        change.GetProperty("changed").GetBoolean().Should().BeFalse();
        change.GetProperty("folder").GetString().Should().Be(_folder);
        change.GetProperty("locations").GetArrayLength().Should().Be(1);
    }

    [Fact]
    public async Task Add_SaysWhatChangedOnStderr_AndPlainStdoutCarriesTheFields()
    {
        var (exitCode, host) = await RunAsync("path", "add");
        using var _ = host;

        exitCode.Should().Be(0);
        host.Consoles.StdErr.Should().Contain("Windows user PATH").And.Contain("New terminals will see it");
        host.Consoles.StdOut.Should().Contain("changed: true").And.Contain($"folder: {_folder}");
    }

    [Fact]
    public async Task Status_Plain_IsOneFieldPerLine()
    {
        _registrar.Add();

        var (exitCode, host) = await RunAsync("path", "status");
        using var _ = host;

        exitCode.Should().Be(0);
        host.Consoles.StdOut.Should().Contain("onPath: false").And.Contain("entry: ").And.Contain(_folder);
    }
}
