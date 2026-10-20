using Spectre.Console;
using Spectre.Console.Cli;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Errors;

namespace TeensyRom.Cli.Tests;

public class ExitCodeMapperTests
{
    [Fact]
    public void ACliException_KeepsItsCodeAndMessage()
    {
        var original = new CliException(CliExitCode.NoDevice, "No TeensyROM is online.");

        var mapped = ExitCodeMapper.Map(original);

        mapped.Should().BeSameAs(original);
    }

    [Fact]
    public void ASpectreParseError_IsAUsageErrorPointingAtTheNearestHelp()
    {
        var mapped = ExitCodeMapper.Map(ParseError(), "trom engine --help");

        mapped.Code.Should().Be(CliExitCode.Usage);
        mapped.Message.Should().Be("Unknown option 'bogus' — see `trom engine --help`.");
    }

    [Fact]
    public void ASpectreValidationError_IsAUsageError()
    {
        var mapped = ExitCodeMapper.Map(ValidationError());

        mapped.Code.Should().Be(CliExitCode.Usage);
    }

    [Fact]
    public void ATrWeb404_IsNotFound()
    {
        var mapped = ExitCodeMapper.Map(new TeensyApiException("No such file.", 404));

        mapped.Code.Should().Be(CliExitCode.NotFound);
        mapped.Message.Should().Be("No such file.");
    }

    [Fact]
    public void AnEngineThatStoppedAnswering_IsEngineUnavailable()
    {
        var mapped = ExitCodeMapper.Map(new TeensyApiException("tr-web stopped answering.", null, new HttpRequestException("refused")));

        mapped.Code.Should().Be(CliExitCode.EngineUnavailable);
    }

    [Fact]
    public void TrWebRejectingTheRequestAsInvalid_IsAUsageError()
    {
        var mapped = ExitCodeMapper.Map(new TeensyApiException("Path must be a valid Unix path.", 400));

        mapped.Code.Should().Be(CliExitCode.Usage);
        mapped.Message.Should().Be("Path must be a valid Unix path.");
    }

    [Theory]
    [InlineData(503)]
    [InlineData(500)]
    public void AnyOtherTrWebStatus_Fails(int status)
    {
        ExitCodeMapper.Map(new TeensyApiException("tr-web is busy.", status)).Code.Should().Be(CliExitCode.Failed);
    }

    [Fact]
    public void ATrWebFailureWithNoStatusAndNoTransportError_Fails()
    {
        ExitCodeMapper.Map(new TeensyApiException("No TeensyROM is selected.")).Code.Should().Be(CliExitCode.Failed);
    }

    [Fact]
    public void AnythingElse_FailsWithOneSentenceNamingTheLog_AndNeverTheStackTrace()
    {
        var logged = new List<Exception>();
        var boom = new InvalidOperationException("kaboom");

        var mapped = ExitCodeMapper.Map(boom, log: logged.Add);

        mapped.Code.Should().Be(CliExitCode.Failed);
        mapped.Message.Should().Contain(ExitCodeMapper.UnhandledErrorLogPath).And.NotContain("kaboom").And.NotContain(" at ");
        logged.Should().Equal(boom);
    }

    [Fact]
    public void ExpectedFailures_AreNotWrittenToTheUnhandledErrorLog()
    {
        var logged = new List<Exception>();

        ExitCodeMapper.Map(new TeensyApiException("x", 404), log: logged.Add);
        ExitCodeMapper.Map(new CliException(CliExitCode.Failed, "x"), log: logged.Add);
        ExitCodeMapper.Map(ParseError(), log: logged.Add);

        logged.Should().BeEmpty();
    }

    [Theory]
    [InlineData((int)CliExitCode.Success, 0)]
    [InlineData((int)CliExitCode.Failed, 1)]
    [InlineData((int)CliExitCode.Usage, 2)]
    [InlineData((int)CliExitCode.EngineUnavailable, 3)]
    [InlineData((int)CliExitCode.NoDevice, 4)]
    [InlineData((int)CliExitCode.NotFound, 5)]
    public void TheExitCodeNumbersAreAStableContract(int code, int number)
    {
        code.Should().Be(number);
    }

    // Spectre's exceptions have no public constructors, so the real ones are provoked.
    private static Exception ParseError() => Provoke("go", "--bogus");

    private static Exception ValidationError() => Provoke("go", "--invalid");

    private static Exception Provoke(params string[] args)
    {
        var app = new CommandApp();
        app.Configure(config =>
        {
            config.PropagateExceptions();
            config.UseStrictParsing();
            config.AddCommand<GoCommand>("go");
        });

        return Record.Exception(() => app.Run(args)) ?? throw new InvalidOperationException("Spectre accepted the command line.");
    }

    private sealed class GoSettings : CommandSettings
    {
        [CommandOption("--invalid")]
        public bool Invalid { get; set; }

        public override ValidationResult Validate() => Invalid ? ValidationResult.Error("Storage must be 'sd' or 'usb'.") : base.Validate();
    }

    private sealed class GoCommand : Command<GoSettings>
    {
        public override int Execute(CommandContext context, GoSettings settings) => 0;
    }
}
