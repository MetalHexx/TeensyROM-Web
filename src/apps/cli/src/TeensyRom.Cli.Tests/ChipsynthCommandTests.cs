using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using System.Text.Json;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// <c>trom chipsynth generate</c> run one-shot: it writes the presets from its options alone, prompts for nothing a
/// script left out, and starts no engine.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class ChipsynthCommandTests : IDisposable
{
    private const string Preset = "<Preset><Settings sc=\"0\" /><Slot id=\"0\" version=\"1\" /></Preset>";

    private readonly TestHost _host = new(configure: services => services.AddSingleton(Substitute.For<IPlayerService>()));
    private readonly string _source = Path.Combine(Path.GetTempPath(), $"chipsynth-{Guid.NewGuid():N}");

    public ChipsynthCommandTests()
    {
        Directory.CreateDirectory(_source);
        File.WriteAllText(Path.Combine(_source, "lead.fermatax"), Preset);
    }

    public void Dispose()
    {
        _host.Dispose();
        if (Directory.Exists(_source)) Directory.Delete(_source, recursive: true);
    }

    private string StdOut => _host.Consoles.StdOut;

    private string StdErr => _host.Consoles.StdErr;

    private string TargetFolder => Path.Combine(_source, "ASID");

    [Fact]
    public async Task Generate_WithAllOptions_WritesThePresets_AndReportsThemAsJson()
    {
        var exitCode = await _host.RunAsync("chipsynth", "generate", "--clock", "ntsc", "--source", _source, "--target", "ASID", "--json");

        exitCode.Should().Be(0);
        File.Exists(Path.Combine(TargetFolder, "lead.fermatax")).Should().BeTrue();

        var result = JsonDocument.Parse(StdOut).RootElement;
        result.GetProperty("clock").GetString().Should().Be("NTSC");
        result.GetProperty("presetsWritten").GetInt32().Should().Be(1);
        result.GetProperty("outputFolder").GetString().Should().Be(TargetFolder);
        await _host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);
    }

    [Fact]
    public async Task Generate_Plain_IsOneSummaryLineOnStdout()
    {
        var exitCode = await _host.RunAsync("chipsynth", "generate", "--clock", "pal", "--source", _source, "--target", "ASID");

        exitCode.Should().Be(0);
        StdOut.Trim().Should().Be($"Generated 1 presets in {TargetFolder}.");
        StdErr.Should().NotContain("Proceed with preset generation?");
    }

    [Fact]
    public async Task Generate_WithAMissingOption_WhenNoTerminalCanAnswer_IsAUsageErrorNamingIt()
    {
        var exitCode = await _host.RunAsync("chipsynth", "generate", "--source", _source, "--target", "ASID");

        exitCode.Should().Be((int)CliExitCode.Usage);
        StdErr.Should().Contain("Missing --clock");
        StdOut.Should().BeEmpty();
        Directory.Exists(TargetFolder).Should().BeFalse();
    }

    [Fact]
    public async Task Generate_WithAnInvalidClock_IsAUsageError_AndWritesNothing()
    {
        var exitCode = await _host.RunAsync("chipsynth", "generate", "--clock", "sega", "--source", _source, "--target", "ASID");

        exitCode.Should().Be((int)CliExitCode.Usage);
        StdErr.Should().Contain("must be 'PAL' or 'NTSC'");
        Directory.Exists(TargetFolder).Should().BeFalse();
    }

    [Fact]
    public async Task Generate_WhenTheSourceHoldsNoPresets_FailsWithExitOne()
    {
        File.Delete(Path.Combine(_source, "lead.fermatax"));

        var exitCode = await _host.RunAsync("chipsynth", "generate", "--clock", "ntsc", "--source", _source, "--target", "ASID");

        exitCode.Should().Be((int)CliExitCode.Failed);
        StdErr.Should().Contain("No .fermatax files found");
    }
}
