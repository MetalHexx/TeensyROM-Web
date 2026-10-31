using NSubstitute;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Themes;
using static TeensyRom.Cli.Tests.ApiTestSupport;

namespace TeensyRom.Cli.Tests;

public class ThemeServiceTests
{
    private const string BusyBody = """{"title":"Alpha is busy with a transfer.","status":409,"code":"deviceBusyWithTransfer"}""";

    private readonly ITeensyRomApiClient _api = Substitute.For<ITeensyRomApiClient>();
    private readonly ThemeService _sut;

    public ThemeServiceTests() => _sut = new ThemeService(_api);

    private static ThemeDto Theme(string id, string name) => new()
    {
        Id = id,
        Name = name,
        Kind = ThemeKind.Custom,
        Parts = new ThemePartsDto { Device = new ThemeColors(0, 1, 2, 3, 4, 5, 6).ToDto() }
    };

    private static DeviceSummary Device(string id) => new(id, id.ToUpperInvariant(), true, "Serial", "Connected");

    private static readonly IReadOnlyDictionary<ThemeSlot, int> NoOverrides = new Dictionary<ThemeSlot, int>();

    private void ApiHasThemes(params ThemeDto[] themes) =>
        _api.ListThemesAsync(Arg.Any<CancellationToken>()).Returns(new ListThemesResponse { Themes = themes });

    private void DeviceRecordIs(string deviceId, ThemeColors colors, string? themeId) =>
        _api.GetDeviceThemeAsync(deviceId, Arg.Any<CancellationToken>()).Returns(new GetDeviceThemeResponse
        {
            Record = new DeviceThemeRecordDto { DeviceId = deviceId, Colors = colors.ToDto(), ThemeId = themeId, IsRecorded = true }
        });

    private void ApplyAnswers(string deviceId, bool isRecorded) =>
        _api.ApplyDeviceThemeAsync(deviceId, Arg.Any<ApplyDeviceThemeBody>(), Arg.Any<CancellationToken>()).Returns(call => new ApplyDeviceThemeResponse
        {
            Record = new DeviceThemeRecordDto { DeviceId = deviceId, Colors = call.Arg<ApplyDeviceThemeBody>().Colors, IsRecorded = isRecorded }
        });

    private void ApplyFails(string deviceId, ApiException failure) =>
        _api.ApplyDeviceThemeAsync(deviceId, Arg.Any<ApplyDeviceThemeBody>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<ApplyDeviceThemeResponse>(failure));

    private ApplyDeviceThemeBody SentTo(string deviceId) =>
        _api.ReceivedCalls()
            .Where(call => call.GetMethodInfo().Name == nameof(ITeensyRomApiClient.ApplyDeviceThemeAsync) && (string)call.GetArguments()[0]! == deviceId)
            .Select(call => (ApplyDeviceThemeBody)call.GetArguments()[1]!)
            .Single();

    [Fact]
    public async Task Find_ByExactId_ReturnsThatTheme()
    {
        ApiHasThemes(Theme("custom-1", "Night"), Theme("custom-2", "Day"));

        (await _sut.FindAsync("custom-2", default)).Name.Should().Be("Day");
    }

    [Fact]
    public async Task Find_ByNameInAnotherCase_ReturnsThatTheme()
    {
        ApiHasThemes(Theme("custom-1", "Night Owl"));

        (await _sut.FindAsync("  night OWL ", default)).Id.Should().Be("custom-1");
    }

    [Fact]
    public async Task Find_WithNoMatch_IsNotFound()
    {
        ApiHasThemes(Theme("custom-1", "Night"));

        var failure = (await ((Func<Task>)(() => _sut.FindAsync("x", default))).Should().ThrowAsync<CliException>()).Which;

        failure.Code.Should().Be(CliExitCode.NotFound);
        failure.Message.Should().Be("No theme matches 'x'.");
    }

    [Fact]
    public async Task Find_WithTwoCaseVariantNames_IsUsageNamingTheIds()
    {
        ApiHasThemes(Theme("a-1", "Night"), Theme("b-2", "NIGHT"));

        var failure = (await ((Func<Task>)(() => _sut.FindAsync("night", default))).Should().ThrowAsync<CliException>()).Which;

        failure.Code.Should().Be(CliExitCode.Usage);
        failure.Message.Should().Contain("a-1").And.Contain("b-2");
    }

    [Fact]
    public async Task FindByName_MatchesIgnoringCaseAndSpaces_AndIsNullWhenNothingIsNamedThat()
    {
        ApiHasThemes(Theme("custom-1", "Night Owl"));

        (await _sut.FindByNameAsync("  night OWL ", default))!.Id.Should().Be("custom-1");
        (await _sut.FindByNameAsync("custom-1", default)).Should().BeNull();
    }

    [Fact]
    public async Task Apply_WhenCancelled_PropagatesInsteadOfReportingTheDevicesAsFailed()
    {
        using var cts = new CancellationTokenSource();
        _api.ApplyDeviceThemeAsync("a", Arg.Any<ApplyDeviceThemeBody>(), Arg.Any<CancellationToken>()).Returns(call =>
        {
            cts.Cancel();
            return Task.FromException<ApplyDeviceThemeResponse>(new OperationCanceledException(cts.Token));
        });

        var apply = () => _sut.ApplyAsync([Device("a"), Device("b")], new ThemeApplyRequest(new ThemeColors(0, 0, 0, 0, 0, 0, 0), null, NoOverrides), cts.Token);

        await apply.Should().ThrowAsync<TeensyApiException>();
        await _api.DidNotReceive().ApplyDeviceThemeAsync("b", Arg.Any<ApplyDeviceThemeBody>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Apply_WithoutColors_StartsFromEachDevicesRecordAndChangesOnlyTheOverriddenSlots()
    {
        DeviceRecordIs("a", new ThemeColors(0, 1, 2, 3, 4, 5, 6), "tr-default");
        DeviceRecordIs("b", new ThemeColors(6, 5, 4, 3, 2, 1, 0), "custom-9");
        ApplyAnswers("a", true);
        ApplyAnswers("b", true);

        var outcomes = await _sut.ApplyAsync([Device("a"), Device("b")], new ThemeApplyRequest(null, null, new Dictionary<ThemeSlot, int> { [ThemeSlot.Keys] = 13 }), default);

        outcomes.Select(o => o.Status).Should().Equal(ThemeApplyStatus.Applied, ThemeApplyStatus.Applied);
        SentTo("a").Colors.Should().BeEquivalentTo(new ThemeColors(0, 1, 2, 3, 13, 5, 6).ToDto());
        SentTo("a").ThemeId.Should().Be("tr-default");
        SentTo("b").Colors.Should().BeEquivalentTo(new ThemeColors(6, 5, 4, 3, 13, 1, 0).ToDto());
        SentTo("b").ThemeId.Should().Be("custom-9");
        outcomes[1].Colors.Should().Be(new ThemeColors(6, 5, 4, 3, 13, 1, 0));
    }

    [Fact]
    public async Task Apply_WithColors_SendsThemAndTheRequestedThemeIdWithoutReadingTheRecord()
    {
        ApplyAnswers("a", true);
        var colors = new ThemeColors(1, 1, 1, 1, 1, 1, 1);

        var outcomes = await _sut.ApplyAsync([Device("a")], new ThemeApplyRequest(colors, "custom-3", NoOverrides), default);

        outcomes.Single().Colors.Should().Be(colors);
        SentTo("a").ThemeId.Should().Be("custom-3");
        SentTo("a").Colors.Should().BeEquivalentTo(colors.ToDto());
        await _api.DidNotReceive().GetDeviceThemeAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Apply_CarriesTheEnginesIsRecordedFlag()
    {
        ApplyAnswers("a", false);

        var outcome = (await _sut.ApplyAsync([Device("a")], new ThemeApplyRequest(new ThemeColors(0, 0, 0, 0, 0, 0, 0), null, NoOverrides), default)).Single();

        outcome.Status.Should().Be(ThemeApplyStatus.Applied);
        outcome.IsRecorded.Should().BeFalse();
    }

    [Fact]
    public async Task Apply_MapsBusyAndFailureAndStillTriesTheNextDevice()
    {
        ApplyAnswers("a", true);
        ApplyFails("b", ApiFailure(409, BusyBody));
        ApplyFails("c", ApiFailure(500, """{"title":"The TeensyROM didn't answer.","status":500}"""));
        var colors = new ThemeColors(0, 0, 0, 0, 0, 0, 0);

        var outcomes = await _sut.ApplyAsync([Device("a"), Device("b"), Device("c")], new ThemeApplyRequest(colors, null, NoOverrides), default);

        outcomes.Select(o => o.Status).Should().Equal(ThemeApplyStatus.Applied, ThemeApplyStatus.Busy, ThemeApplyStatus.Failed);
        outcomes.Select(o => o.Device.Id).Should().Equal("a", "b", "c");
        outcomes[2].Message.Should().Be("The TeensyROM didn't answer.");
        await _api.Received(1).ApplyDeviceThemeAsync("c", Arg.Any<ApplyDeviceThemeBody>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Apply_WhenTheRecordCannotBeRead_FailsThatDeviceWithoutColors()
    {
        _api.GetDeviceThemeAsync("a", Arg.Any<CancellationToken>()).Returns(Task.FromException<GetDeviceThemeResponse>(ApiFailure(404, "\"Unknown device.\"")));
        DeviceRecordIs("b", new ThemeColors(0, 0, 0, 0, 0, 0, 0), null);
        ApplyAnswers("b", true);

        var outcomes = await _sut.ApplyAsync([Device("a"), Device("b")], new ThemeApplyRequest(null, null, NoOverrides), default);

        outcomes[1].Status.Should().Be(ThemeApplyStatus.Applied);
        outcomes[0].Status.Should().Be(ThemeApplyStatus.Failed);
        outcomes[0].Colors.Should().BeNull();
        outcomes[0].Message.Should().Be("Unknown device.");
    }

    [Fact]
    public async Task Create_SendsTheNameAndColorsAsTheEnginesSlotNames()
    {
        _api.CreateThemeAsync(Arg.Any<SaveThemeBody>(), Arg.Any<CancellationToken>()).Returns(call => new SaveThemeResponse { Theme = Theme("new-1", call.Arg<SaveThemeBody>().Name) });

        var created = await _sut.CreateAsync("Night", new ThemeColors(0, 1, 2, 3, 4, 5, 6), default);

        created.Name.Should().Be("Night");
        await _api.Received(1).CreateThemeAsync(
            Arg.Is<SaveThemeBody>(body => body.Name == "Night" && body.Device.Option == 4 && body.Device.Name == 6),
            Arg.Any<CancellationToken>());
    }
}
