using NSubstitute;
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
    public async Task Set_AnUnknownKey_IsAUsageError_ListingTheValidSettings_AndChangesNothing()
    {
        var exitCode = await _host.RunAsync("settings", "set", "volume", "11");

        exitCode.Should().Be((int)CliExitCode.Usage);
        StdErr.Should().Contain("Valid settings").And.Contain("storage").And.Contain("always-prompt-storage").And.Contain("debug-logs");
        StdOut.Should().BeEmpty();
        Persisted().Should().BeEquivalentTo(Defaults);
    }

    [Theory]
    [InlineData("storage", "floppy")]
    [InlineData("always-prompt-storage", "maybe")]
    [InlineData("debug-logs", "yes please")]
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
        Save(new TeensySettings { StorageType = TeensyStorageType.USB, AlwaysPromptStorage = false, EnableDebugLogs = true });
        using var host = new TestHost();

        var exitCode = await host.RunAsync("settings", "show");

        exitCode.Should().Be(0);
        host.Consoles.StdOut.Should().Contain("storage: usb").And.Contain("alwaysPromptStorage: false").And.Contain("debugLogs: true");
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
    }
}
