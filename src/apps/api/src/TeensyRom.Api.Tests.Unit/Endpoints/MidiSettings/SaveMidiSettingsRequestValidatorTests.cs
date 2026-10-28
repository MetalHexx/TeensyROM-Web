using TeensyRom.Api.Endpoints.MidiSettings;
using TeensyRom.Api.Endpoints.MidiSettings.SaveMidiSettings;

namespace TeensyRom.Api.Tests.Unit.Endpoints.MidiSettings;

public class SaveMidiSettingsRequestValidatorTests
{
    private readonly SaveMidiSettingsRequestValidator _validator = new();

    private static KnownMidiControllerDto Controller(string id = "c1") => new()
    {
        Id = id,
        Name = "Launch Control XL",
        LastPortId = "input-3",
        Listening = true
    };

    private static MidiControlMappingDto Mapping(
        string id = "m1",
        string controllerId = "c1",
        int channel = 1,
        string sourceKind = "cc",
        int number = 21,
        string owner = "A",
        string control = "speed",
        string styleKind = "relative-offset",
        double? amount = 0.01) => new()
    {
        Id = id,
        Source = new MidiSourceDto { ControllerId = controllerId, Channel = channel, Kind = sourceKind, Number = number },
        Owner = owner,
        Control = control,
        Style = new MidiMappingStyleDto { Kind = styleKind, Amount = amount }
    };

    private static DeckDeviceBindingDto Binding(string slot = "A", string deviceId = "19277260", string lastSeenName = "TR-2") => new()
    {
        Slot = slot,
        DeviceId = deviceId,
        LastSeenName = lastSeenName
    };

    private static SaveMidiSettingsRequest ValidRequest() => new()
    {
        Controllers = [Controller()],
        Mappings = [Mapping()],
        DeckBindings = [Binding("A", "19277260"), Binding("B", "19277261")]
    };

    private void AssertRejectedAt(SaveMidiSettingsRequest request, string propertyName)
    {
        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == propertyName,
            $"errors were: {string.Join("; ", result.Errors.Select(e => e.PropertyName + " " + e.ErrorMessage))}");
    }

    [Fact]
    public void Validate_ValidRequest_Passes()
    {
        var result = _validator.Validate(ValidRequest());

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_EmptySet_Passes()
    {
        var result = _validator.Validate(new SaveMidiSettingsRequest());

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_MaximumSizedSet_Passes()
    {
        var request = new SaveMidiSettingsRequest
        {
            Controllers = Enumerable.Range(0, 64).Select(i => Controller($"c{i}")).ToList(),
            Mappings = Enumerable.Range(0, 1024)
                .Select(i => Mapping($"m{i}", "c0", channel: 1 + i / 128, number: i % 128))
                .ToList()
        };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    #region Lists

    [Fact]
    public void Validate_NullLists_AreRejected()
    {
        var result = _validator.Validate(new SaveMidiSettingsRequest { Controllers = null!, Mappings = null!, DeckBindings = null! });

        result.Errors.Select(e => e.PropertyName).Should().BeEquivalentTo(
            nameof(SaveMidiSettingsRequest.Controllers),
            nameof(SaveMidiSettingsRequest.Mappings),
            nameof(SaveMidiSettingsRequest.DeckBindings));
    }

    [Fact]
    public void Validate_NullEntries_AreRejected()
    {
        var request = ValidRequest();
        request.Controllers.Add(null!);
        request.Mappings.Add(null!);
        request.DeckBindings = [null!];

        var result = _validator.Validate(request);

        result.Errors.Select(e => e.PropertyName).Should().BeEquivalentTo("Controllers[1]", "Mappings[1]", "DeckBindings[0]");
    }

    [Fact]
    public void Validate_TooManyControllers_IsRejected()
    {
        var request = ValidRequest();
        request.Controllers = Enumerable.Range(0, 65).Select(i => Controller($"c{i}")).ToList();

        AssertRejectedAt(request, nameof(SaveMidiSettingsRequest.Controllers));
    }

    [Fact]
    public void Validate_TooManyMappings_IsRejected()
    {
        var request = ValidRequest();
        request.Mappings = Enumerable.Range(0, 1025)
            .Select(i => Mapping($"m{i}", "c1", channel: 1 + i / 128, number: i % 128))
            .ToList();

        AssertRejectedAt(request, nameof(SaveMidiSettingsRequest.Mappings));
    }

    [Fact]
    public void Validate_TooManyDeckBindings_IsRejected()
    {
        var request = ValidRequest();
        request.DeckBindings = [Binding("A", "1"), Binding("B", "2"), Binding("A", "3")];

        AssertRejectedAt(request, nameof(SaveMidiSettingsRequest.DeckBindings));
    }

    #endregion

    #region Controllers

    [Theory]
    [InlineData("")]
    [InlineData("has space")]
    [InlineData("dot.id")]
    [InlineData("trailing-newline\n")]
    [InlineData("0123456789012345678901234567890123456789012345678901234567890123x")]
    public void Validate_ControllerIdOutsideThePattern_IsRejected(string id)
    {
        var request = ValidRequest();
        request.Controllers = [Controller(id)];
        request.Mappings = [];

        AssertRejectedAt(request, "Controllers[0].Id");
    }

    [Fact]
    public void Validate_DuplicateControllerIds_AreRejected()
    {
        var request = ValidRequest();
        request.Controllers = [Controller("c1"), Controller("c1")];

        AssertRejectedAt(request, "Controllers[1].Id");
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Validate_ControllerNameMissing_IsRejected(string? name)
    {
        var request = ValidRequest();
        request.Controllers[0].Name = name!;

        AssertRejectedAt(request, "Controllers[0].Name");
    }

    [Fact]
    public void Validate_ControllerNameTooLong_IsRejected()
    {
        var request = ValidRequest();
        request.Controllers[0].Name = new string('n', 129);

        AssertRejectedAt(request, "Controllers[0].Name");
    }

    [Fact]
    public void Validate_ControllerLastPortId_AllowsNullAndRejectsOver256Characters()
    {
        var request = ValidRequest();
        request.Controllers[0].LastPortId = null;
        _validator.Validate(request).IsValid.Should().BeTrue();

        request.Controllers[0].LastPortId = new string('p', 257);
        AssertRejectedAt(request, "Controllers[0].LastPortId");
    }

    #endregion

    #region Mappings

    [Fact]
    public void Validate_MappingIdOutsideThePattern_IsRejected()
    {
        var request = ValidRequest();
        request.Mappings[0].Id = "bad id!";

        AssertRejectedAt(request, "Mappings[0].Id");
    }

    [Fact]
    public void Validate_DuplicateMappingIds_AreRejected()
    {
        var request = ValidRequest();
        request.Mappings = [Mapping("m1", number: 1), Mapping("m1", number: 2)];

        AssertRejectedAt(request, "Mappings[1].Id");
    }

    [Fact]
    public void Validate_MappingSourceControllerNotInTheRequest_IsRejected()
    {
        var request = ValidRequest();
        request.Mappings[0].Source.ControllerId = "ghost";

        AssertRejectedAt(request, "Mappings[0].Source.ControllerId");
    }

    [Fact]
    public void Validate_TwoMappingsSharingASource_AreRejected()
    {
        var request = ValidRequest();
        request.Mappings = [Mapping("m1", control: "speed"), Mapping("m2", control: "voice-1-coarse", styleKind: "absolute", amount: null)];

        AssertRejectedAt(request, "Mappings[1].Source");
    }

    [Fact]
    public void Validate_MappingsOnDifferentControllersChannelsKindsOrNumbers_DoNotShareASource()
    {
        var request = ValidRequest();
        request.Controllers = [Controller("c1"), Controller("c2")];
        request.Mappings =
        [
            Mapping("m1"),
            Mapping("m2", controllerId: "c2"),
            Mapping("m3", channel: 2),
            Mapping("m4", sourceKind: "note"),
            Mapping("m5", number: 22)
        ];

        _validator.Validate(request).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(0, 21)]
    [InlineData(17, 21)]
    [InlineData(1, -1)]
    [InlineData(1, 128)]
    public void Validate_SourceChannelOrNumberOutOfRange_IsRejected(int channel, int number)
    {
        var request = ValidRequest();
        request.Mappings[0].Source.Channel = channel;
        request.Mappings[0].Source.Number = number;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().OnlyContain(e => e.PropertyName.StartsWith("Mappings[0].Source."));
    }

    [Theory]
    [InlineData("")]
    [InlineData("pitch")]
    [InlineData("CC")]
    public void Validate_SourceKindUnknown_IsRejected(string kind)
    {
        var request = ValidRequest();
        request.Mappings[0].Source.Kind = kind;

        AssertRejectedAt(request, "Mappings[0].Source.Kind");
    }

    [Fact]
    public void Validate_MissingSourceOrStyle_IsRejected()
    {
        var request = ValidRequest();
        request.Mappings[0].Source = null!;
        request.Mappings[0].Style = null!;

        var result = _validator.Validate(request);

        result.Errors.Select(e => e.PropertyName).Should().BeEquivalentTo("Mappings[0].Source", "Mappings[0].Style");
    }

    #endregion

    #region Owner and control

    [Theory]
    [InlineData("a")]
    [InlineData("C")]
    [InlineData("Mixer")]
    [InlineData("Set")]
    [InlineData("deck")]
    [InlineData("")]
    public void Validate_UnknownOwner_IsRejected(string owner)
    {
        var request = ValidRequest();
        request.Mappings[0].Owner = owner;

        AssertRejectedAt(request, "Mappings[0].Owner");
    }

    [Theory]
    [InlineData("A", "play-pause")]
    [InlineData("A", "speed-nudge-up")]
    [InlineData("B", "speed-nudge-down")]
    [InlineData("B", "key")]
    [InlineData("A", "voice-2-coarse")]
    [InlineData("B", "voice-3-wave-pulse")]
    [InlineData("A", "voice-1-filter")]
    [InlineData("B", "filter-low-pass")]
    [InlineData("A", "filter-cutoff")]
    [InlineData("A", "set-previous")]
    [InlineData("B", "set-next")]
    [InlineData("A", "panic")]
    [InlineData("B", "panic")]
    [InlineData("set", "set-select")]
    [InlineData("set", "set-load-a")]
    [InlineData("set", "set-load-b")]
    public void Validate_ControlOnTheOwnersAllowList_Passes(string owner, string control)
    {
        var request = ValidRequest();
        request.Mappings[0].Owner = owner;
        request.Mappings[0].Control = control;
        request.Mappings[0].Style = new MidiMappingStyleDto { Kind = "press" };

        _validator.Validate(request).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("A", "crossfader")]
    [InlineData("B", "volume")]
    [InlineData("B", "clear-voice-mutes")]
    [InlineData("A", "Speed")]
    [InlineData("A", "level")]
    [InlineData("B", "cutoff")]
    [InlineData("A", "resonance")]
    [InlineData("B", "pulse-width")]
    [InlineData("A", "voice-4-coarse")]
    [InlineData("A", "voice-1-level")]
    [InlineData("mixer", "speed")]
    [InlineData("mixer", "crossfader")]
    [InlineData("mixer", "")]
    [InlineData("set", "speed")]
    [InlineData("set", "play-pause")]
    [InlineData("set", "set-previous")]
    [InlineData("set", "Set-Select")]
    [InlineData("set", "")]
    [InlineData("A", "set-select")]
    [InlineData("B", "set-load-a")]
    public void Validate_ControlOffTheOwnersAllowList_IsRejected(string owner, string control)
    {
        var request = ValidRequest();
        request.Mappings[0].Owner = owner;
        request.Mappings[0].Control = control;

        AssertRejectedAt(request, "Mappings[0].Control");
    }

    [Fact]
    public void DeckControls_LoadedFromTheContractFile_HoldsEightyOneNames()
    {
        MidiSettingsAllowLists.DeckControls.Should().HaveCount(81);
        MidiSettingsAllowLists.SetControls.Should().HaveCount(3);
        MidiSettingsAllowLists.MixerControls.Should().BeEmpty();
    }

    #endregion

    #region Style

    [Theory]
    [InlineData("press")]
    [InlineData("release")]
    [InlineData("latch")]
    [InlineData("on")]
    [InlineData("off")]
    [InlineData("absolute")]
    [InlineData("latch-release")]
    [InlineData("on-release")]
    [InlineData("off-release")]
    public void Validate_StyleWithoutAmount_PassesAndRejectsAnAmount(string kind)
    {
        var request = ValidRequest();
        request.Mappings[0].Style = new MidiMappingStyleDto { Kind = kind, Amount = null };
        _validator.Validate(request).IsValid.Should().BeTrue();

        request.Mappings[0].Style.Amount = 0.5;
        AssertRejectedAt(request, "Mappings[0].Style.Amount");
    }

    [Theory]
    [InlineData("")]
    [InlineData("toggle")]
    [InlineData("Press")]
    public void Validate_UnknownStyleKind_IsRejected(string kind)
    {
        var request = ValidRequest();
        request.Mappings[0].Style = new MidiMappingStyleDto { Kind = kind, Amount = null };

        AssertRejectedAt(request, "Mappings[0].Style.Kind");
    }

    [Theory]
    [InlineData("relative-offset", 0.01)]
    [InlineData("relative-offset", 1.0)]
    [InlineData("relative-signed", 0.5)]
    [InlineData("step", 1.0)]
    [InlineData("step", -1.0)]
    [InlineData("step", -0.25)]
    [InlineData("step-release", 1.0)]
    [InlineData("step-release", -1.0)]
    [InlineData("step-release", -0.25)]
    public void Validate_AmountInRange_Passes(string kind, double amount)
    {
        var request = ValidRequest();
        request.Mappings[0].Style = new MidiMappingStyleDto { Kind = kind, Amount = amount };

        _validator.Validate(request).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("relative-offset", null)]
    [InlineData("relative-offset", 0.0)]
    [InlineData("relative-offset", -0.5)]
    [InlineData("relative-offset", 1.01)]
    [InlineData("relative-signed", null)]
    [InlineData("relative-signed", 0.0)]
    [InlineData("relative-signed", -0.1)]
    [InlineData("relative-signed", 2.0)]
    [InlineData("step", null)]
    [InlineData("step", 0.0)]
    [InlineData("step", 1.5)]
    [InlineData("step", -1.5)]
    [InlineData("step-release", null)]
    [InlineData("step-release", 0.0)]
    [InlineData("step-release", 1.5)]
    [InlineData("step-release", -1.5)]
    [InlineData("relative-offset", double.NaN)]
    [InlineData("relative-signed", double.PositiveInfinity)]
    [InlineData("step", double.NegativeInfinity)]
    [InlineData("step-release", double.NegativeInfinity)]
    public void Validate_AmountMissingOutOfRangeOrNotFinite_IsRejected(string kind, double? amount)
    {
        var request = ValidRequest();
        request.Mappings[0].Style = new MidiMappingStyleDto { Kind = kind, Amount = amount };

        AssertRejectedAt(request, "Mappings[0].Style.Amount");
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0.05)]
    [InlineData(1.0)]
    public void Validate_HoldAmountAbsentOrInRange_Passes(double? amount)
    {
        var request = ValidRequest();
        request.Mappings[0].Style = new MidiMappingStyleDto { Kind = "hold", Amount = amount };

        _validator.Validate(request).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(0.0)]
    [InlineData(-0.05)]
    [InlineData(1.5)]
    [InlineData(double.NaN)]
    public void Validate_HoldAmountOutOfRangeOrNotFinite_IsRejected(double amount)
    {
        var request = ValidRequest();
        request.Mappings[0].Style = new MidiMappingStyleDto { Kind = "hold", Amount = amount };

        AssertRejectedAt(request, "Mappings[0].Style.Amount");
    }

    #endregion

    #region Deck bindings

    [Theory]
    [InlineData("")]
    [InlineData("C")]
    [InlineData("a")]
    public void Validate_UnknownSlot_IsRejected(string slot)
    {
        var request = ValidRequest();
        request.DeckBindings = [Binding(slot)];

        AssertRejectedAt(request, "DeckBindings[0].Slot");
    }

    [Fact]
    public void Validate_DuplicateSlots_AreRejected()
    {
        var request = ValidRequest();
        request.DeckBindings = [Binding("A", "1"), Binding("A", "2")];

        AssertRejectedAt(request, "DeckBindings[1].Slot");
    }

    [Theory]
    [InlineData("")]
    [InlineData("192.168.1.37:2112")]
    [InlineData("!!not-a-device!!")]
    [InlineData("012345678901234567890123456789012")]
    public void Validate_InvalidDeviceId_IsRejected(string deviceId)
    {
        var request = ValidRequest();
        request.DeckBindings = [Binding("A", deviceId)];

        AssertRejectedAt(request, "DeckBindings[0].DeviceId");
    }

    [Fact]
    public void Validate_BothSlotsNamingTheSameDevice_IsRejected()
    {
        var request = ValidRequest();
        request.DeckBindings = [Binding("A", "19277260"), Binding("B", "19277260")];

        AssertRejectedAt(request, "DeckBindings[1].DeviceId");
    }

    [Fact]
    public void Validate_LastSeenName_AllowsEmptyAndRejectsOver128Characters()
    {
        var request = ValidRequest();
        request.DeckBindings = [Binding(lastSeenName: "")];
        _validator.Validate(request).IsValid.Should().BeTrue();

        request.DeckBindings = [Binding(lastSeenName: new string('n', 129))];
        AssertRejectedAt(request, "DeckBindings[0].LastSeenName");
    }

    #endregion
}
