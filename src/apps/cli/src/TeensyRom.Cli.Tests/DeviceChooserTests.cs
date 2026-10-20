using NSubstitute;
using Spectre.Console;
using Spectre.Console.Testing;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Tests;

[Collection(ConsoleCollection.Name)]
public sealed class DeviceChooserTests : IDisposable
{
    private readonly IAnsiConsole _originalConsole = AnsiConsole.Console;
    private readonly IDeviceService _devices = Substitute.For<IDeviceService>();

    public void Dispose() => AnsiConsole.Console = _originalConsole;

    private static DeviceSummary Online(string id, string name, string connection = "USB COM3") => new(id, name, true, connection, "Connected");

    private static DeviceSummary Offline(string id, string name) => new(id, name, false, "USB COM9", "ConnectionLost");

    private void TrWebKnows(params DeviceSummary[] known) => _devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(known);

    /// <summary>A chooser whose output can prompt (on <paramref name="consoles"/>' stderr) or not.</summary>
    private DeviceChooser Chooser(TestConsoles consoles, bool canPrompt)
    {
        AnsiConsole.Console = consoles.Err;
        return new DeviceChooser(_devices, new CliOutput(consoles.With(canPrompt, canPrompt, canPrompt)));
    }

    private static async Task<CliException> Rejected(Task<DeviceSummary> choosing)
    {
        Func<Task<DeviceSummary>> act = () => choosing;

        return (await act.Should().ThrowAsync<CliException>()).Which;
    }

    // ---- nobody named a device ----------------------------------------------------------------------------

    [Fact]
    public async Task Online_WithNoDeviceOnline_IsNoDevice_AndSaysHowToFindOne()
    {
        TrWebKnows(Offline("c", "Charlie"));

        var error = await Rejected(Chooser(new TestConsoles(), canPrompt: false).ChooseAsync(null, DeviceScope.Online, default));

        error.Code.Should().Be(CliExitCode.NoDevice);
        error.Message.Should().Be("No TeensyROM is online. Connect one, then run `trom device discover`.");
    }

    [Fact]
    public async Task Known_WithNoDeviceKnown_IsNoDevice_AndSaysHowToFindOne()
    {
        TrWebKnows();

        var error = await Rejected(Chooser(new TestConsoles(), canPrompt: false).ChooseAsync(null, DeviceScope.Known, default));

        error.Code.Should().Be(CliExitCode.NoDevice);
        error.Message.Should().Be("tr-web doesn't know any TeensyROM yet. Connect one, then run `trom device discover`.");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task TheOnlyCandidate_IsChosenWithoutPrompting(bool known)
    {
        var alpha = Online("a", "Alpha");
        TrWebKnows(alpha);

        var chosen = await Chooser(new TestConsoles(), canPrompt: false).ChooseAsync(null, known ? DeviceScope.Known : DeviceScope.Online, default);

        chosen.Should().Be(alpha);
    }

    [Fact]
    public async Task Online_IgnoresOfflineDevicesWhenCountingCandidates()
    {
        var alpha = Online("a", "Alpha");
        TrWebKnows(Offline("c", "Charlie"), alpha);

        var chosen = await Chooser(new TestConsoles(), canPrompt: false).ChooseAsync(null, DeviceScope.Online, default);

        chosen.Should().Be(alpha);
    }

    [Fact]
    public async Task Known_CountsOfflineDevicesToo()
    {
        TrWebKnows(Online("a", "Alpha"), Offline("c", "Charlie"));
        var consoles = new TestConsoles(terminal: true);
        consoles.Err.Input.PushKey(ConsoleKey.DownArrow);
        consoles.Err.Input.PushKey(ConsoleKey.Enter);

        var chosen = await Chooser(consoles, canPrompt: true).ChooseAsync(null, DeviceScope.Known, default);

        chosen.Name.Should().Be("Charlie");
    }

    [Fact]
    public async Task SeveralCandidates_WhenThePromptCanBeAnswered_AskOnStderr()
    {
        var bravo = Online("b", "Bravo", "Ethernet 10.0.0.7");
        TrWebKnows(Online("a", "Alpha"), bravo, Offline("c", "Charlie"));
        var consoles = new TestConsoles(terminal: true);
        consoles.Err.Input.PushKey(ConsoleKey.DownArrow);
        consoles.Err.Input.PushKey(ConsoleKey.Enter);

        var chosen = await Chooser(consoles, canPrompt: true).ChooseAsync(null, DeviceScope.Online, default);

        chosen.Should().Be(bravo);
        consoles.StdErr.Should().Contain("Alpha (USB COM3)").And.Contain("Bravo (Ethernet 10.0.0.7)").And.NotContain("Charlie");
        consoles.StdOut.Should().BeEmpty();
    }

    [Fact]
    public async Task SeveralCandidates_WhenThereIsNoTerminal_ListThemAndSuggestDevice()
    {
        TrWebKnows(Online("a", "Alpha"), Online("b", "Bravo", "Ethernet 10.0.0.7"));

        var error = await Rejected(Chooser(new TestConsoles(), canPrompt: false).ChooseAsync(null, DeviceScope.Online, default));

        error.Code.Should().Be(CliExitCode.NoDevice);
        error.Message.Should().Contain("Alpha (USB COM3)").And.Contain("Bravo (Ethernet 10.0.0.7)").And.Contain("--device");
    }

    [Fact]
    public async Task SeveralCandidates_WhenThePromptThrowsNotSupported_AreTreatedAsCannotPrompt()
    {
        TrWebKnows(Online("a", "Alpha"), Online("b", "Bravo"));
        var consoles = new TestConsoles();

        var error = await Rejected(Chooser(consoles, canPrompt: true).ChooseAsync(null, DeviceScope.Online, default));

        error.Code.Should().Be(CliExitCode.NoDevice);
        error.Message.Should().Contain("--device");
    }

    // ---- a device was named -----------------------------------------------------------------------------------

    [Fact]
    public async Task ANameMatchesInAnyCase_AndAnIdMatchesExactly()
    {
        var bravo = Online("b-123", "Bravo");
        TrWebKnows(Online("a", "Alpha"), bravo);
        var chooser = Chooser(new TestConsoles(), canPrompt: false);

        (await chooser.ChooseAsync("bRaVo", DeviceScope.Online, default)).Should().Be(bravo);
        (await chooser.ChooseAsync("b-123", DeviceScope.Online, default)).Should().Be(bravo);
        (await Rejected(chooser.ChooseAsync("B-123", DeviceScope.Online, default))).Code.Should().Be(CliExitCode.NotFound);
    }

    [Fact]
    public async Task ANamedDevice_IsChosenEvenWhenSeveralAreOnline_WithoutPrompting()
    {
        var alpha = Online("a", "Alpha");
        TrWebKnows(alpha, Online("b", "Bravo"));

        var chosen = await Chooser(new TestConsoles(), canPrompt: false).ChooseAsync("alpha", DeviceScope.Online, default);

        chosen.Should().Be(alpha);
    }

    [Fact]
    public async Task ANameThatMatchesNothing_IsNotFound_ListingTheCandidates()
    {
        TrWebKnows(Online("a", "Alpha"), Online("b", "Bravo"), Offline("c", "Charlie"));

        var error = await Rejected(Chooser(new TestConsoles(), canPrompt: false).ChooseAsync("delta", DeviceScope.Online, default));

        error.Code.Should().Be(CliExitCode.NotFound);
        error.Message.Should().Contain("'delta'").And.Contain("Alpha").And.Contain("Bravo").And.NotContain("Charlie");
    }

    [Fact]
    public async Task ANameThatMatchesNothing_WhenNothingIsKnown_StillSaysHowToFindADevice()
    {
        TrWebKnows();

        var error = await Rejected(Chooser(new TestConsoles(), canPrompt: false).ChooseAsync("delta", DeviceScope.Known, default));

        error.Code.Should().Be(CliExitCode.NotFound);
        error.Message.Should().Contain("trom device discover");
    }

    [Fact]
    public async Task AKnownButOfflineDevice_UnderOnline_IsNoDevice_AndSaysToReconnectIt()
    {
        TrWebKnows(Online("a", "Alpha"), Offline("c", "Charlie"));

        var error = await Rejected(Chooser(new TestConsoles(), canPrompt: false).ChooseAsync("charlie", DeviceScope.Online, default));

        error.Code.Should().Be(CliExitCode.NoDevice);
        error.Message.Should().Be("Charlie is offline. Run `trom device reconnect --device Charlie`.");
    }

    [Fact]
    public async Task AKnownButOfflineDevice_UnderKnown_IsChosen()
    {
        var charlie = Offline("c", "Charlie");
        TrWebKnows(Online("a", "Alpha"), charlie);

        var chosen = await Chooser(new TestConsoles(), canPrompt: false).ChooseAsync("Charlie", DeviceScope.Known, default);

        chosen.Should().Be(charlie);
    }

    [Fact]
    public async Task TwoDevicesWithOneName_AreAUsageErrorUnlessTheIdIsGiven()
    {
        var first = Online("a", "Rig");
        TrWebKnows(first, Online("b", "rig"));
        var chooser = Chooser(new TestConsoles(), canPrompt: false);

        (await Rejected(chooser.ChooseAsync("RIG", DeviceScope.Online, default))).Code.Should().Be(CliExitCode.Usage);
        (await chooser.ChooseAsync("a", DeviceScope.Online, default)).Should().Be(first);
    }

    // ---- the rate limit ---------------------------------------------------------------------------------------

    [Fact]
    public async Task EveryChoice_AsksTrWebForItsDevicesExactlyOnce()
    {
        TrWebKnows(Online("a", "Alpha"));

        await Chooser(new TestConsoles(), canPrompt: false).ChooseAsync("alpha", DeviceScope.Online, default);

        await _devices.Received(1).GetDevicesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task WhenTrWebIsBusy_TheFailureCarriesItsSentenceThrough()
    {
        _devices.GetDevicesAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromException<IReadOnlyList<DeviceSummary>>(new TeensyApiException("tr-web is busy listing devices — try again in a few seconds.", 503)));

        var act = () => Chooser(new TestConsoles(), canPrompt: false).ChooseAsync(null, DeviceScope.Online, default);

        (await act.Should().ThrowAsync<TeensyApiException>()).Which.Message.Should().Contain("busy listing devices");
    }
}
