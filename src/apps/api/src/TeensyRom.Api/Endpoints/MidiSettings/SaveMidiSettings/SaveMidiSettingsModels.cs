using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.MidiSettings.SaveMidiSettings
{
    /// <summary>
    /// Request model for saving the whole MIDI settings set. The stored set is replaced as a whole.
    /// </summary>
    public record SaveMidiSettingsRequest
    {
        /// <summary>
        /// MIDI controllers the app has seen before. At most 64, with unique ids.
        /// </summary>
        [Required] public List<KnownMidiControllerDto> Controllers { get; set; } = [];

        /// <summary>
        /// Mappings from MIDI messages to deck and mixer controls. At most 1024, with unique ids and unique sources.
        /// </summary>
        [Required] public List<MidiControlMappingDto> Mappings { get; set; } = [];

        /// <summary>
        /// Which TeensyROM cartridge each deck slot is bound to. At most one binding per slot, and the slots must name different devices.
        /// </summary>
        [Required] public List<DeckDeviceBindingDto> DeckBindings { get; set; } = [];
    }

    /// <summary>
    /// Response model for the result of saving the MIDI settings set.
    /// </summary>
    public record SaveMidiSettingsResponse
    {
        /// <summary>
        /// A message indicating the result of the save operation.
        /// </summary>
        [Required] public string Message { get; set; } = "MIDI settings saved successfully.";
    }

    // Validators
    public class SaveMidiSettingsRequestValidator : AbstractValidator<SaveMidiSettingsRequest>
    {
        public SaveMidiSettingsRequestValidator()
        {
            RuleFor(x => x.Controllers).Cascade(CascadeMode.Stop)
                .NotNull().WithMessage("Controllers list is required.")
                .Must(controllers => controllers.Count <= MidiSettingsAllowLists.MaxControllers)
                .WithMessage($"At most {MidiSettingsAllowLists.MaxControllers} controllers are allowed.");

            RuleFor(x => x.Mappings).Cascade(CascadeMode.Stop)
                .NotNull().WithMessage("Mappings list is required.")
                .Must(mappings => mappings.Count <= MidiSettingsAllowLists.MaxMappings)
                .WithMessage($"At most {MidiSettingsAllowLists.MaxMappings} mappings are allowed.");

            RuleFor(x => x.DeckBindings).Cascade(CascadeMode.Stop)
                .NotNull().WithMessage("Deck bindings list is required.")
                .Must(bindings => bindings.Count <= MidiSettingsAllowLists.MaxDeckBindings)
                .WithMessage($"At most {MidiSettingsAllowLists.MaxDeckBindings} deck bindings are allowed.");

            RuleForEach(x => x.Controllers)
                .NotNull().WithMessage("Controller entries must not be null.")
                .SetValidator(new KnownMidiControllerValidator());

            RuleForEach(x => x.Mappings)
                .NotNull().WithMessage("Mapping entries must not be null.")
                .SetValidator(new MidiControlMappingValidator());

            RuleForEach(x => x.DeckBindings)
                .NotNull().WithMessage("Deck binding entries must not be null.")
                .SetValidator(new DeckDeviceBindingValidator());

            RuleFor(x => x).Custom(ValidateAcrossEntries);
        }

        /// <summary>
        /// Rules that compare entries with each other: unique ids, unique sources, mapping-to-controller
        /// references, and one distinct device per deck slot.
        /// </summary>
        private static void ValidateAcrossEntries(SaveMidiSettingsRequest request, ValidationContext<SaveMidiSettingsRequest> context)
        {
            var controllers = request.Controllers ?? [];
            var mappings = request.Mappings ?? [];
            var deckBindings = request.DeckBindings ?? [];

            FlagDuplicates(controllers, c => c.Id, "Controllers", ".Id", "Controller ID is already used by another controller.", context);
            FlagDuplicates(mappings, m => m.Id, "Mappings", ".Id", "Mapping ID is already used by another mapping.", context);
            FlagDuplicates(
                mappings,
                m => m.Source is null ? null : (m.Source.ControllerId, m.Source.Channel, m.Source.Kind, m.Source.Number),
                "Mappings", ".Source",
                "Another mapping already uses this controller, channel, kind and number. A source drives one control.",
                context);
            FlagDuplicates(deckBindings, b => b.Slot, "DeckBindings", ".Slot", "Deck slot is already bound.", context);
            FlagDuplicates(deckBindings, b => b.DeviceId, "DeckBindings", ".DeviceId", "Device is already bound to the other deck slot.", context);

            var controllerIds = controllers
                .Where(c => c?.Id is not null)
                .Select(c => c.Id)
                .ToHashSet(StringComparer.Ordinal);

            for (var i = 0; i < mappings.Count; i++)
            {
                var source = mappings[i]?.Source;
                if (source is null) continue;

                if (source.ControllerId is null || !controllerIds.Contains(source.ControllerId))
                {
                    context.AddFailure($"Mappings[{i}].Source.ControllerId", "Source controller ID must name a controller in the same request.");
                }
            }
        }

        private static void FlagDuplicates<TItem>(
            List<TItem> items,
            Func<TItem, object?> keyOf,
            string collection,
            string property,
            string message,
            ValidationContext<SaveMidiSettingsRequest> context) where TItem : class?
        {
            var seen = new HashSet<object>();
            for (var i = 0; i < items.Count; i++)
            {
                if (items[i] is null) continue;

                var key = keyOf(items[i]);
                if (key is not null && !seen.Add(key))
                {
                    context.AddFailure($"{collection}[{i}]{property}", message);
                }
            }
        }
    }
}
