using TeensyRom.Api.Endpoints.MidiSettings;
using TeensyRom.Api.Endpoints.MidiSettings.GetMidiSettings;
using TeensyRom.Api.Endpoints.MidiSettings.SaveMidiSettings;
using TeensyRom.Core.Settings;
using MidiSettingsEntity = TeensyRom.Core.Settings.MidiSettings;

namespace TeensyRom.Api.Tests.Unit.Endpoints.MidiSettings;

public class MidiSettingsMapperTests
{
    private static SaveMidiSettingsRequest RequestWith(MidiMappingStyleDto style) => new()
    {
        Controllers = [new KnownMidiControllerDto { Id = "c1", Name = "Launch Control XL", Listening = true }],
        Mappings =
        [
            new MidiControlMappingDto
            {
                Id = "m1",
                Source = new MidiSourceDto { ControllerId = "c1", Channel = 1, Kind = "pitch-bend", Number = 0 },
                Owner = "A",
                Control = "seek",
                Style = style
            }
        ]
    };

    [Fact]
    public void Save_ToEntity_CarriesAmountAndGrip()
    {
        var entity = new SaveMidiSettingsMapper().ToEntity(RequestWith(new MidiMappingStyleDto { Kind = "hand", Amount = 0.13, Grip = 0.25 }));

        entity.Mappings.Single().Style.Should().BeEquivalentTo(new MidiMappingStyle { Kind = "hand", Amount = 0.13, Grip = 0.25 });
    }

    [Fact]
    public void Save_ToEntity_LeavesGripNullWhenTheStyleHasNone()
    {
        var entity = new SaveMidiSettingsMapper().ToEntity(RequestWith(new MidiMappingStyleDto { Kind = "relative-offset", Amount = 0.01 }));

        entity.Mappings.Single().Style.Grip.Should().BeNull();
    }

    [Fact]
    public void Get_FromEntity_CarriesAmountAndGrip()
    {
        var entity = new MidiSettingsEntity
        {
            Mappings =
            [
                new MidiControlMapping
                {
                    Id = "m1",
                    Source = new MidiSource { ControllerId = "c1", Channel = 1, Kind = "pitch-bend", Number = 0 },
                    Owner = "A",
                    Control = "seek",
                    Style = new MidiMappingStyle { Kind = "hand", Amount = 0.13, Grip = 0.25 }
                }
            ]
        };

        var response = new GetMidiSettingsMapper().FromEntity(entity);

        response.Mappings.Single().Style.Should().BeEquivalentTo(new MidiMappingStyleDto { Kind = "hand", Amount = 0.13, Grip = 0.25 });
    }

    [Fact]
    public void SaveThenGet_RoundTripsAHandMapping()
    {
        var request = RequestWith(new MidiMappingStyleDto { Kind = "hand", Amount = 0.13, Grip = 0.25 });

        var response = new GetMidiSettingsMapper().FromEntity(new SaveMidiSettingsMapper().ToEntity(request));

        response.Mappings.Should().BeEquivalentTo(request.Mappings);
    }

    [Fact]
    public void SaveThenGet_RoundTripsDeckSettings()
    {
        var request = new SaveMidiSettingsRequest
        {
            DeckSettings =
            [
                new DeckSettingsDto { Slot = "A", Slip = true, LiveLoopBeats = 0.5 },
                new DeckSettingsDto { Slot = "B", Slip = false, LiveLoopBeats = 4 }
            ]
        };

        var entity = new SaveMidiSettingsMapper().ToEntity(request);
        var response = new GetMidiSettingsMapper().FromEntity(entity);

        entity.DeckSettings.Should().BeEquivalentTo(
        [
            new DeckSettings { Slot = "A", Slip = true, LiveLoopBeats = 0.5 },
            new DeckSettings { Slot = "B", Slip = false, LiveLoopBeats = 4 }
        ]);
        response.DeckSettings.Should().BeEquivalentTo(request.DeckSettings);
    }

    [Fact]
    public void Save_ToEntity_SavesAnEmptyListWhenDeckSettingsAreNull()
    {
        var entity = new SaveMidiSettingsMapper().ToEntity(new SaveMidiSettingsRequest { DeckSettings = null });

        entity.DeckSettings.Should().BeEmpty();
    }
}
