using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Spectre.Console;
using System.Text.Json;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// <c>trom settings show</c> and <c>trom settings set</c> against the throwaway home: what they validate, what they
/// persist, and that neither starts an engine.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class SettingsCommandTests : IDisposable
{
    private readonly TestHost _host;
    private readonly TeensySettings _saved;

    public SettingsCommandTests()
    {
        _saved = Persisted();
        Save(Defaults);
        _host = new TestHost();
    }

    public void Dispose()
    {
        Save(_saved);
        _host.Dispose();
    }

    private string StdOut => _host.Consoles.StdOut;

    private string StdErr => _host.Consoles.StdErr;

    private static TeensySettings Defaults => new() { StorageType = TeensyStorageType.SD, AlwaysPromptStorage = true, EnableDebugLogs = false };

    private static TeensySettings Persisted() => new SettingsService(new CliLoggingService()).GetSettings();

    private static void Save(TeensySettings settings) => new SettingsService(new CliLoggingService()).SaveSettings(settings);

    [Fact]
    public async Task Set_Storage_PersistsTheChange_AndPrintsTheNewValue()
    {
        var exitCode = await _host.RunAsync("settings", "set", "storage", "usb");

        exitCode.Should().Be(0);
        Persisted().StorageType.Should().Be(TeensyStorageType.USB);
        StdOut.Should().Contain("storage: usb");
        await _host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }

    [Fact]
    public async Task Set_Json_IsTheWholeSettingsObjectAfterTheChange()
    {
        var exitCode = await _host.RunAsync("settings", "set", "always-prompt-storage", "false", "--json");

        exitCode.Should().Be(0);
        Persisted().AlwaysPromptStorage.Should().BeFalse();

        var document = JsonDocument.Parse(StdOut).RootElement;
        document.GetProperty("storage").GetString().Should().Be("sd");
        document.GetProperty("alwaysPromptStorage").GetBoolean().Should().BeFalse();
        document.GetProperty("debugLogs").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Set_DebugLogs_PersistsIt_AndSwitchesTheLoggingOnAtOnce()
    {
        _host.Logging.Enabled = false;

        var exitCode = await _host.RunAsync("settings", "set", "debug-logs", "TRUE");

        exitCode.Should().Be(0);
        Persisted().EnableDebugLogs.Should().BeTrue();
        _host.Logging.Enabled.Should().BeTrue();
    }

    [Fact]
    public async Task Set_UpdateCheck_PersistsIt_AndReportsItInTheJson()
    {
        var exitCode = await _host.RunAsync("settings", "set", "update-check", "false", "--json");

        exitCode.Should().Be(0);
        Persisted().UpdateCheck.Should().BeFalse();
        JsonDocument.Parse(StdOut).RootElement.GetProperty("updateCheck").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task TheMenusSettingsScreen_TogglesTheUpdateCheck()
    {
        const int toggleUpdateCheck = 3;
        const int leaveSettings = 4;

        using var host = new TestHost(terminal: true, configure: services => services.AddSingleton(Substitute.For<IPlayerService>()));
        AnsiConsole.Console = host.Consoles.Out;

        foreach (var choice in new[] { toggleUpdateCheck, leaveSettings })
        {
            for (var i = 0; i < choice; i++) host.Consoles.Out.Input.PushKey(ConsoleKey.DownArrow);
            host.Consoles.Out.Input.PushKey(ConsoleKey.Enter);
        }

        var exitCode = await CliHost.CreateTuiApp(host.Composition.Registrar).RunAsync(["settings"]);

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Persisted().UpdateCheck.Should().BeFalse();
        host.Consoles.StdOut.Should().Contain("Update Check");
    }

    [Fact]
    public async Task Set_AnUnknownKey_IsAUsageError_ListingTheValidSettings_AndChangesNothing()
    {
        var exitCode = await _host.RunAsync("settings", "set", "volume", "11");

        exitCode.Should().Be((int)CliExitCode.Usage);
        StdErr.Should().Contain("Valid settings").And.Contain("storage").And.Contain("always-prompt-storage").And.Contain("debug-logs").And.Contain("update-check");
        StdOut.Should().BeEmpty();
        Persisted().Should().BeEquivalentTo(Defaults);
    }

    [Theory]
    [InlineData("storage", "floppy")]
    [InlineData("always-prompt-storage", "maybe")]
    [InlineData("debug-logs", "yes please")]
    [InlineData("update-check", "daily")]
    public async Task Set_ABadValue_IsAUsageError_AndChangesNothing(string key, string value)
    {
        var before = Persisted();

        var exitCode = await _host.RunAsync("settings", "set", key, value);

        exitCode.Should().Be((int)CliExitCode.Usage);
        StdErr.Should().Contain($"isn't a valid value for {key}");
        Persisted().Should().BeEquivalentTo(before);
    }

    [Fact]
    public async Task Show_Plain_IsOneFieldPerLine_WithTheSavedValues()
    {
        Save(new TeensySettings { StorageType = TeensyStorageType.USB, AlwaysPromptStorage = false, EnableDebugLogs = true, UpdateCheck = false });
        using var host = new TestHost();

        var exitCode = await host.RunAsync("settings", "show");

        exitCode.Should().Be(0);
        host.Consoles.StdOut.Should().Contain("storage: usb").And.Contain("alwaysPromptStorage: false").And.Contain("debugLogs: true").And.Contain("updateCheck: false");
        await host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }

    [Fact]
    public async Task Show_Json_IsTheSavedSettingsObject()
    {
        var exitCode = await _host.RunAsync("settings", "show", "--json");

        exitCode.Should().Be(0);

        var document = JsonDocument.Parse(StdOut).RootElement;
        document.GetProperty("storage").GetString().Should().Be("sd");
        document.GetProperty("alwaysPromptStorage").GetBoolean().Should().BeTrue();
        document.GetProperty("debugLogs").GetBoolean().Should().BeFalse();
        document.GetProperty("updateCheck").GetBoolean().Should().BeTrue();
    }
}
