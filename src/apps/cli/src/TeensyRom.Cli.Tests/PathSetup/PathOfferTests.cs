using NSubstitute;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.PathSetup;

namespace TeensyRom.Cli.Tests.PathSetup;

[Collection(ConsoleCollection.Name)]
public sealed class PathOfferTests : IDisposable
{
    private readonly PathSandbox _sandbox = new();
    private readonly InMemorySettings _settings = new();
    private readonly FakeUserPathStore _store = new();
    private readonly string _folder;

    public PathOfferTests()
    {
        _folder = _sandbox.InstallFolder("trom");
    }

    public void Dispose() => _sandbox.Dispose();

    private sealed record Offer(PathOffer Subject, TestConsoles Consoles);

    private Offer Create(bool interactive = true, EngineMode mode = EngineMode.Packaged, bool onPath = false, IUserPathStore? store = null)
    {
        var consoles = new TestConsoles(terminal: interactive);
        var locator = Substitute.For<IEngineLocator>();
        locator.Locate().Returns(new EngineLookup(new EngineLocation(mode, _folder), _folder));

        var pathVariable = onPath ? _folder : _sandbox.EmptyFolder("elsewhere");
        var registrar = new PathRegistrar(_sandbox.Environment(_folder, PathPlatform.Windows, pathVariable: pathVariable), store ?? _store, _settings);

        return new Offer(new PathOffer(new CliOutput(consoles.Consoles), _settings, locator, registrar), consoles);
    }

    private static void Answer(Offer offer, char key)
    {
        offer.Consoles.Err.Input.PushCharacter(key);
        offer.Consoles.Err.Input.PushKey(ConsoleKey.Enter);
    }

    [Fact]
    public async Task Yes_AddsTrom_RecordsTheAnswer_AndSaysSoOnStderrOnly()
    {
        var offer = Create();
        Answer(offer, 'y');

        var asked = await offer.Subject.MaybeOfferAsync(["device", "list"]);

        asked.Should().BeTrue();
        _store.Value.Should().Be(_folder);
        _settings.GetSettings().PathOfferAnswered.Should().BeTrue();
        offer.Consoles.StdErr.Should().Contain("New terminals will see it");
        offer.Consoles.StdOut.Should().BeEmpty();
    }

    [Fact]
    public async Task No_ChangesNothing_ButRecordsTheAnswer()
    {
        var offer = Create();
        Answer(offer, 'n');

        var asked = await offer.Subject.MaybeOfferAsync(["device", "list"]);

        asked.Should().BeTrue();
        _store.Writes.Should().Be(0);
        _settings.GetSettings().PathOfferAnswered.Should().BeTrue();
    }

    [Fact]
    public async Task AFailureToAdd_IsOneSentenceOnStderr_AndDoesNotThrow()
    {
        var failing = Substitute.For<IUserPathStore>();
        failing.Read().Returns(_ => throw new UnauthorizedAccessException("Access denied."));
        var offer = Create(store: failing);
        Answer(offer, 'y');

        var act = () => offer.Subject.MaybeOfferAsync([]);

        await act.Should().NotThrowAsync();
        offer.Consoles.StdErr.Should().Contain("Couldn't add trom to your PATH");
        _settings.GetSettings().PathOfferAnswered.Should().BeTrue();
    }

    [Fact]
    public async Task AnAnsweredOffer_IsNeverMadeAgain()
    {
        var settings = _settings.GetSettings();
        settings.PathOfferAnswered = true;
        _settings.SaveSettings(settings);

        await AssertNotOffered(Create(), ["device", "list"]);
    }

    [Fact]
    public Task NotAllStreamsTerminals_SuppressesIt() => AssertNotOffered(Create(interactive: false), ["device", "list"]);

    [Fact]
    public Task ASourceTree_SuppressesIt() => AssertNotOffered(Create(mode: EngineMode.Source), ["device", "list"]);

    [Fact]
    public Task TromAlreadyOnThePath_SuppressesIt() => AssertNotOffered(Create(onPath: true), ["device", "list"]);

    [Theory]
    [InlineData("--help")]
    [InlineData("-h")]
    [InlineData("--version")]
    public Task HelpAndVersion_SuppressIt(string flag) => AssertNotOffered(Create(), [flag]);

    [Fact]
    public Task AVerbsHelp_SuppressesIt() => AssertNotOffered(Create(), ["device", "list", "--help"]);

    [Theory]
    [InlineData("path", "add")]
    [InlineData("path", "status")]
    [InlineData("--json", "path", "status")]
    public Task APathCommand_SuppressesIt(params string[] args) => AssertNotOffered(Create(), args);

    private async Task AssertNotOffered(Offer offer, string[] args)
    {
        var answeredBefore = _settings.GetSettings().PathOfferAnswered;

        var asked = await offer.Subject.MaybeOfferAsync(args);

        asked.Should().BeFalse();
        _settings.GetSettings().PathOfferAnswered.Should().Be(answeredBefore);
        offer.Consoles.StdErr.Should().BeEmpty();
        offer.Consoles.StdOut.Should().BeEmpty();
        _store.Writes.Should().Be(0);
    }
}
