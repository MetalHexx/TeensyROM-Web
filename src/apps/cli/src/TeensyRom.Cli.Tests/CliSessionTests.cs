using Microsoft.Extensions.DependencyInjection;
using Spectre.Console;
using Spectre.Console.Cli;
using System.Text.Json;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// The session's pre-parse steps, exit-code mapping and stream discipline, on a small tree of test commands:
/// <c>x paths [PATHS...]</c>, <c>x who</c>, <c>x deny</c> and <c>x boom</c>.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class CliSessionTests : IDisposable
{
    private static readonly Dictionary<string, string[]> Nouns = new() { ["x"] = ["who", "paths"] };

    private readonly IAnsiConsole _originalConsole = AnsiConsole.Console;
    private readonly TestConsoles _consoles = new();
    private readonly List<string> _paths = [];
    private readonly List<string?> _devices = [];
    private bool _jsonSeen;

    public CliSessionTests() => AnsiConsole.Console = _consoles.Out;

    public void Dispose() => AnsiConsole.Console = _originalConsole;

    private CliSession SessionOver(string? stdin = null, bool stdinIsTerminal = false)
    {
        var output = new CliOutput(_consoles.Consoles);
        var services = new ServiceCollection();
        services.AddSingleton<ICliOutput>(output);
        services.AddSingleton<IStdinPaths>(new StdinPaths(new StringReader(stdin ?? string.Empty), stdinIsTerminal));
        services.AddSingleton(this);
        services.AddTransient<PathsCommand>().AddTransient<PathsSettings>();
        services.AddTransient<WhoCommand>().AddTransient<WhoSettings>();
        services.AddTransient<DenyCommand>().AddTransient<TromSettings>();
        services.AddTransient<BoomCommand>();
        services.AddTransient<ChattyCommand>();
        services.AddTransient<TopCommand>();
        var registrar = new TypeRegistrar(services);

        return new CliSession(Tree(registrar, _consoles.Consoles), Tree(registrar, _consoles.Consoles with { Out = _consoles.Err }), output, _consoles.Consoles, Nouns, ["top"]);
    }

    private static CommandApp Tree(ITypeRegistrar registrar, CliConsoles consoles)
    {
        var app = new CommandApp(registrar);
        app.Configure(config =>
        {
            config.PropagateExceptions();
            config.UseStrictParsing();
            config.ConfigureConsole(consoles.Out);
            config.SetApplicationName("trom");
            config.AddCommand<TopCommand>("top").WithDescription("A top-level command.");
            config.AddBranch("x", branch =>
            {
                branch.SetDescription("A test noun.");
                branch.AddCommand<PathsCommand>("paths").WithDescription("Takes paths.");
                branch.AddCommand<WhoCommand>("who").WithDescription("Reports --device.");
                branch.AddCommand<DenyCommand>("deny").WithDescription("Finds no device.");
                branch.AddCommand<BoomCommand>("boom").WithDescription("Throws.");
                branch.AddCommand<ChattyCommand>("chat").WithDescription("Writes through the static console.");
            });
        });
        return app;
    }

    // ---- stdin paths ------------------------------------------------------------------------------------------

    [Fact]
    public async Task ABareDash_GetsThroughParsingAndSettingsValidation_AndIsExpandedBeforeTheCommandValidatesIt()
    {
        var sut = SessionOver(stdin: "/music/a.sid\n/music/b.sid\n");

        var exitCode = await sut.RunAsync(["x", "paths", "-"]);

        exitCode.Should().Be(0);
        _paths.Should().Equal("/music/a.sid", "/music/b.sid");
        _consoles.StdErr.Should().BeEmpty();
    }

    [Fact]
    public async Task APathReadFromStdin_IsValidatedAfterExpansion()
    {
        var sut = SessionOver(stdin: "/music/a.sid\nnot-a-path\n");

        var exitCode = await sut.RunAsync(["x", "paths", "-"]);

        exitCode.Should().Be((int)CliExitCode.Usage);
        _consoles.StdErr.Should().Contain("'not-a-path' is not a valid device path");
        _paths.Should().BeEmpty();
    }

    [Fact]
    public async Task ADashWithNothingPiped_IsAUsageError()
    {
        var sut = SessionOver(stdin: string.Empty, stdinIsTerminal: true);

        var exitCode = await sut.RunAsync(["x", "paths", "-"]);

        exitCode.Should().Be((int)CliExitCode.Usage);
        _consoles.StdErr.Should().Contain("`-` reads paths from a pipe; pass a path instead.");
    }

    // ---- binding ------------------------------------------------------------------------------------------------

    [Fact]
    public async Task JsonAfterTheVerb_BindsToTheVerbsSettings()
    {
        var sut = SessionOver();

        await sut.RunAsync(["x", "paths", "/a.sid", "--json"]);

        _jsonSeen.Should().BeTrue();
    }

    [Fact]
    public async Task OptionValues_DoNotLeakFromOneRunToTheNext()
    {
        var sut = SessionOver();

        await sut.RunAsync(["x", "who", "-d", "foo"]);
        await sut.RunAsync(["x", "who"]);
        await sut.RunAsync(["x", "who", "--device", "bar"]);

        _devices.Should().Equal("foo", null, "bar");
    }

    // ---- usage errors ---------------------------------------------------------------------------------------------

    [Fact]
    public async Task AnUnknownOption_IsAUsageError_WithTheVerbsHelpOnStderrAndNothingOnStdout()
    {
        var sut = SessionOver();

        var exitCode = await sut.RunAsync(["x", "who", "--bogus"]);

        exitCode.Should().Be((int)CliExitCode.Usage);
        _consoles.StdErr.Should().Contain("Unknown option 'bogus'").And.Contain("trom x who --help").And.Contain("USAGE");
        _consoles.StdOut.Should().BeEmpty();
    }

    [Fact]
    public async Task AnUnknownCommand_IsAUsageError_WithTheRootHelpOnStderr()
    {
        var sut = SessionOver();

        var exitCode = await sut.RunAsync(["launch"]);

        exitCode.Should().Be((int)CliExitCode.Usage);
        _consoles.StdErr.Should().Contain("Unknown command 'launch'").And.Contain("trom --help").And.Contain("USAGE");
        _consoles.StdOut.Should().BeEmpty();
    }

    [Theory]
    [InlineData("x")]
    [InlineData("x", "--json")]
    public async Task ABareNoun_IsAUsageError_WithTheNounsHelpOnStderr(params string[] args)
    {
        var sut = SessionOver();

        var exitCode = await sut.RunAsync(args);

        exitCode.Should().Be((int)CliExitCode.Usage);
        _consoles.StdErr.Should().Contain("`trom x` needs a command").And.Contain("COMMANDS");
        _consoles.StdOut.Should().BeEmpty();
    }

    [Fact]
    public async Task ATopLevelCommand_IsNotABareNoun_AndRuns()
    {
        var sut = SessionOver();

        var exitCode = await sut.RunAsync(["top"]);

        exitCode.Should().Be(0);
        _consoles.StdErr.Should().BeEmpty();
    }

    [Fact]
    public async Task AnUnknownOptionOnATopLevelCommand_PointsAtItsHelpOnStderr()
    {
        var sut = SessionOver();

        var exitCode = await sut.RunAsync(["top", "--bogus"]);

        exitCode.Should().Be((int)CliExitCode.Usage);
        _consoles.StdErr.Should().Contain("trom top --help").And.Contain("USAGE");
        _consoles.StdOut.Should().BeEmpty();
    }

    [Fact]
    public async Task HelpForANoun_GoesToStdout_AndSucceeds()
    {
        var sut = SessionOver();

        var exitCode = await sut.RunAsync(["x", "--help"]);

        exitCode.Should().Be(0);
        _consoles.StdOut.Should().Contain("COMMANDS").And.Contain("paths");
        _consoles.StdErr.Should().BeEmpty();
    }

    [Fact]
    public async Task AParseErrorUnderJson_StillEndsStderrWithTheJsonErrorOnOneLine()
    {
        var sut = SessionOver();

        var exitCode = await sut.RunAsync(["x", "who", "--bogus", "--json"]);

        exitCode.Should().Be((int)CliExitCode.Usage);
        var lines = _consoles.StdErr.TrimEnd().Split('\n');
        var error = JsonDocument.Parse(lines[^1]).RootElement.GetProperty("error");
        error.GetProperty("code").GetString().Should().Be("usage");
        error.GetProperty("exitCode").GetInt32().Should().Be(2);
        lines[^2].Should().NotContain("{", "the JSON error is the only JSON line; the sentence precedes it");
        _consoles.StdOut.Should().BeEmpty();
    }

    // ---- other failures --------------------------------------------------------------------------------------------

    [Fact]
    public async Task ACliException_ExitsWithItsCode_AndItsSentenceOnStderr()
    {
        var sut = SessionOver();

        var exitCode = await sut.RunAsync(["x", "deny"]);

        exitCode.Should().Be((int)CliExitCode.NoDevice);
        _consoles.StdErr.Should().Contain("No TeensyROM is online.");
        _consoles.StdOut.Should().BeEmpty();
    }

    [Fact]
    public async Task AnUnexpectedException_ExitsWithOne_NamesTheLog_AndShowsNoStackTrace()
    {
        var sut = SessionOver();

        var exitCode = await sut.RunAsync(["x", "boom", "--json"]);

        exitCode.Should().Be((int)CliExitCode.Failed);
        _consoles.StdErr.Should().Contain(ExitCodeMapper.UnhandledErrorLogPath).And.NotContain("kaboom").And.NotContain("   at ");
        File.ReadAllText(ExitCodeMapper.UnhandledErrorLogPath).Should().Contain("kaboom");
    }

    // ---- streams -------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task EverythingACommandWritesThroughTheStaticConsole_LandsOnStderr()
    {
        var sut = SessionOver();

        var exitCode = await sut.RunAsync(["x", "chat"]);

        exitCode.Should().Be(0);
        _consoles.StdErr.Should().Contain("incidental");
        _consoles.StdOut.Should().Contain("data").And.NotContain("incidental");
    }

    // ---- test commands ----------------------------------------------------------------------------------------------------

    private sealed class PathsSettings : TromSettings
    {
        [CommandArgument(0, "[PATHS]")]
        public string[] Paths { get; set; } = [];
    }

    private sealed class PathsCommand(CliSessionTests probe, IStdinPaths stdin, ICliOutput output) : TromCommand<PathsSettings>(output)
    {
        protected override Task<int> RunAsync(CommandContext context, PathsSettings settings, CancellationToken ct)
        {
            probe._jsonSeen = settings.Json;

            var paths = stdin.Expand(settings.Paths);
            var invalid = paths.FirstOrDefault(path => !path.StartsWith('/'));

            if (invalid is not null) throw new CliException(CliExitCode.Usage, $"'{invalid}' is not a valid device path.");

            probe._paths.AddRange(paths);
            return Task.FromResult(0);
        }
    }

    private sealed class WhoSettings : DeviceSettings;

    private sealed class WhoCommand(CliSessionTests probe, ICliOutput output) : TromCommand<WhoSettings>(output)
    {
        protected override Task<int> RunAsync(CommandContext context, WhoSettings settings, CancellationToken ct)
        {
            probe._devices.Add(settings.Device);
            return Task.FromResult(0);
        }
    }

    private sealed class DenyCommand(ICliOutput output) : TromCommand<TromSettings>(output)
    {
        protected override Task<int> RunAsync(CommandContext context, TromSettings settings, CancellationToken ct) =>
            throw new CliException(CliExitCode.NoDevice, "No TeensyROM is online.");
    }

    private sealed class BoomCommand(ICliOutput output) : TromCommand<TromSettings>(output)
    {
        protected override Task<int> RunAsync(CommandContext context, TromSettings settings, CancellationToken ct) =>
            throw new InvalidOperationException("kaboom");
    }

    private sealed class TopCommand(ICliOutput output) : TromCommand<TromSettings>(output)
    {
        protected override Task<int> RunAsync(CommandContext context, TromSettings settings, CancellationToken ct) => Task.FromResult(0);
    }

    private sealed class ChattyCommand(ICliOutput output) : TromCommand<TromSettings>(output)
    {
        protected override Task<int> RunAsync(CommandContext context, TromSettings settings, CancellationToken ct)
        {
            AnsiConsole.MarkupLine("incidental");
            Output.Lines(["data"]);
            return Task.FromResult(0);
        }
    }
}
