using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.RegularExpressions;
using TeensyRom.Core.Common;

namespace TeensyRom.Api.Endpoints.MidiSettings
{
    /// <summary>
    /// A MIDI controller the app has seen before.
    /// </summary>
    public record KnownMidiControllerDto
    {
        /// <summary>
        /// Stable identifier for the controller, referenced by mappings. 1-64 letters, digits, hyphens or underscores.
        /// </summary>
        [Required] public string Id { get; set; } = string.Empty;

        /// <summary>
        /// Display name of the controller, 1-128 characters.
        /// </summary>
        [Required] public string Name { get; set; } = string.Empty;

        /// <summary>
        /// The browser's MIDI port id the last time the controller was connected, up to 256 characters. Null when unknown.
        /// </summary>
        public string? LastPortId { get; set; }

        /// <summary>
        /// Whether the app is listening to this controller.
        /// </summary>
        [Required] public bool Listening { get; set; }
    }

    /// <summary>
    /// The MIDI message a mapping listens for.
    /// </summary>
    public record MidiSourceDto
    {
        /// <summary>
        /// Id of the controller that sends the message. Must name a controller in the same set.
        /// </summary>
        [Required] public string ControllerId { get; set; } = string.Empty;

        /// <summary>
        /// MIDI channel, 1-16.
        /// </summary>
        [Required] public int Channel { get; set; }

        /// <summary>
        /// Message kind: "note" or "cc".
        /// </summary>
        [Required] public string Kind { get; set; } = string.Empty;

        /// <summary>
        /// Note or controller number, 0-127.
        /// </summary>
        [Required] public int Number { get; set; }
    }

    /// <summary>
    /// How a mapped message drives its control.
    /// </summary>
    public record MidiMappingStyleDto
    {
        /// <summary>
        /// Style kind: press, release, latch, on, off, hold, absolute, relative-offset, relative-signed or step.
        /// </summary>
        [Required] public string Kind { get; set; } = string.Empty;

        /// <summary>
        /// Step size. Required for relative-offset and relative-signed (greater than 0, up to 1) and for step
        /// (-1 to 1, not 0). Optional for hold (greater than 0, up to 1; null holds the voice). Must be null for every other kind.
        /// </summary>
        public double? Amount { get; set; }
    }

    /// <summary>
    /// Binds a MIDI source to a control on a deck.
    /// </summary>
    public record MidiControlMappingDto
    {
        /// <summary>
        /// Unique identifier for the mapping. 1-64 letters, digits, hyphens or underscores.
        /// </summary>
        [Required] public string Id { get; set; } = string.Empty;

        /// <summary>
        /// The MIDI message that drives the control. No two mappings may share a source.
        /// </summary>
        [Required] public MidiSourceDto Source { get; set; } = null!;

        /// <summary>
        /// Who owns the control: "A" or "B" for a deck. "mixer" is accepted as an owner but owns no controls today.
        /// </summary>
        [Required] public string Owner { get; set; } = string.Empty;

        /// <summary>
        /// The control to drive: one of the deck control names in the app's deck control list, for owner "A" or "B".
        /// </summary>
        [Required] public string Control { get; set; } = string.Empty;

        /// <summary>
        /// How the message drives the control.
        /// </summary>
        [Required] public MidiMappingStyleDto Style { get; set; } = null!;
    }

    /// <summary>
    /// Binds a deck slot to a TeensyROM cartridge.
    /// </summary>
    public record DeckDeviceBindingDto
    {
        /// <summary>
        /// The deck slot: "A" or "B". Each slot may be bound once.
        /// </summary>
        [Required] public string Slot { get; set; } = string.Empty;

        /// <summary>
        /// Device id of the cartridge (1-32 letters, digits, hyphens or underscores). The two slots may not share a device.
        /// </summary>
        [Required] public string DeviceId { get; set; } = string.Empty;

        /// <summary>
        /// The device's display name the last time it was seen, up to 128 characters.
        /// </summary>
        [Required] public string LastSeenName { get; set; } = string.Empty;
    }

    /// <summary>
    /// What the save request accepts. Anything outside these lists is rejected rather than stored.
    /// </summary>
    public static class MidiSettingsAllowLists
    {
        public const int MaxControllers = 64;
        public const int MaxMappings = 1024;
        public const int MaxDeckBindings = 2;

        public const string MixerOwner = "mixer";
        public const string StepStyleKind = "step";
        public const string HoldStyleKind = "hold";

        public static readonly Regex IdPattern = new(@"^[A-Za-z0-9_-]{1,64}\z", RegexOptions.CultureInvariant);

        public static readonly IReadOnlySet<string> SourceKinds = new HashSet<string>(StringComparer.Ordinal) { "note", "cc" };

        public static readonly IReadOnlySet<string> Slots = new HashSet<string>(StringComparer.Ordinal) { "A", "B" };

        public static readonly IReadOnlySet<string> Owners = new HashSet<string>(StringComparer.Ordinal) { "A", "B", MixerOwner };

        /// <summary>
        /// The deck control names, loaded from the generated contract file embedded in this assembly.
        /// The app's own test regenerates that file from its deck control list, so the two cannot drift.
        /// </summary>
        public static readonly IReadOnlySet<string> DeckControls = LoadDeckControls();

        /// <summary>
        /// The controls the mixer owns. It owns none today.
        /// </summary>
        public static readonly IReadOnlySet<string> MixerControls = new HashSet<string>(StringComparer.Ordinal);

        public static readonly IReadOnlySet<string> StyleKinds = new HashSet<string>(StringComparer.Ordinal)
        {
            "press", "release", "latch", "on", "off", "hold", "absolute", "relative-offset", "relative-signed", StepStyleKind
        };

        public static readonly IReadOnlySet<string> PositiveAmountStyleKinds = new HashSet<string>(StringComparer.Ordinal)
        {
            "relative-offset", "relative-signed"
        };

        public static bool IsValidId(string? id) => id is not null && IdPattern.IsMatch(id);

        private static HashSet<string> LoadDeckControls()
        {
            const string resourceName = "TeensyRom.Api.DeckControlIds.json";

            using var stream = typeof(MidiSettingsAllowLists).Assembly.GetManifestResourceStream(resourceName)
                ?? throw new InvalidOperationException($"Embedded resource '{resourceName}' is missing from the build.");

            var names = JsonSerializer.Deserialize<string[]>(stream)
                ?? throw new InvalidOperationException($"Embedded resource '{resourceName}' holds no control list.");

            return new HashSet<string>(names, StringComparer.Ordinal);
        }
    }

    // Validators
    public class KnownMidiControllerValidator : AbstractValidator<KnownMidiControllerDto>
    {
        public KnownMidiControllerValidator()
        {
            RuleFor(x => x.Id)
                .Must(MidiSettingsAllowLists.IsValidId).WithMessage("Controller ID must be 1-64 letters, digits, hyphens, or underscores.");

            RuleFor(x => x.Name)
                .NotNull().WithMessage("Controller name is required.")
                .Length(1, 128).WithMessage("Controller name must be 1-128 characters.");

            RuleFor(x => x.LastPortId)
                .MaximumLength(256).WithMessage("Last port ID must be at most 256 characters.");
        }
    }

    public class MidiSourceValidator : AbstractValidator<MidiSourceDto>
    {
        public MidiSourceValidator()
        {
            RuleFor(x => x.Channel)
                .InclusiveBetween(1, 16).WithMessage("Source channel must be between 1 and 16.");

            RuleFor(x => x.Kind)
                .Must(kind => kind is not null && MidiSettingsAllowLists.SourceKinds.Contains(kind))
                .WithMessage("Source kind must be 'note' or 'cc'.");

            RuleFor(x => x.Number)
                .InclusiveBetween(0, 127).WithMessage("Source number must be between 0 and 127.");
        }
    }

    public class MidiMappingStyleValidator : AbstractValidator<MidiMappingStyleDto>
    {
        public MidiMappingStyleValidator()
        {
            RuleFor(x => x.Kind)
                .Must(kind => kind is not null && MidiSettingsAllowLists.StyleKinds.Contains(kind))
                .WithMessage("Style kind must be one of: " + string.Join(", ", MidiSettingsAllowLists.StyleKinds.Order()) + ".");

            RuleFor(x => x.Amount)
                .Custom((amount, context) =>
                {
                    var kind = context.InstanceToValidate.Kind;
                    if (kind is null || !MidiSettingsAllowLists.StyleKinds.Contains(kind)) return;

                    if (MidiSettingsAllowLists.PositiveAmountStyleKinds.Contains(kind))
                    {
                        if (amount is not { } a || !double.IsFinite(a) || a <= 0 || a > 1)
                        {
                            context.AddFailure($"Amount is required for style '{kind}' and must be greater than 0 and at most 1.");
                        }
                    }
                    else if (kind == MidiSettingsAllowLists.StepStyleKind)
                    {
                        if (amount is not { } a || !double.IsFinite(a) || a < -1 || a > 1 || a == 0)
                        {
                            context.AddFailure("Amount is required for style 'step' and must be between -1 and 1, and not 0.");
                        }
                    }
                    else if (kind == MidiSettingsAllowLists.HoldStyleKind)
                    {
                        if (amount is { } a && (!double.IsFinite(a) || a <= 0 || a > 1))
                        {
                            context.AddFailure("Amount for style 'hold' must be null, or greater than 0 and at most 1.");
                        }
                    }
                    else if (amount is not null)
                    {
                        context.AddFailure($"Amount must be null for style '{kind}'.");
                    }
                });
        }
    }

    public class MidiControlMappingValidator : AbstractValidator<MidiControlMappingDto>
    {
        public MidiControlMappingValidator()
        {
            RuleFor(x => x.Id)
                .Must(MidiSettingsAllowLists.IsValidId).WithMessage("Mapping ID must be 1-64 letters, digits, hyphens, or underscores.");

            RuleFor(x => x.Source)
                .NotNull().WithMessage("Mapping source is required.")
                .SetValidator(new MidiSourceValidator());

            RuleFor(x => x.Owner)
                .Must(owner => owner is not null && MidiSettingsAllowLists.Owners.Contains(owner))
                .WithMessage("Mapping owner must be 'A', 'B', or 'mixer'.");

            RuleFor(x => x.Control)
                .Custom((control, context) =>
                {
                    var owner = context.InstanceToValidate.Owner;
                    if (owner is null || !MidiSettingsAllowLists.Owners.Contains(owner)) return;

                    var allowed = owner == MidiSettingsAllowLists.MixerOwner
                        ? MidiSettingsAllowLists.MixerControls
                        : MidiSettingsAllowLists.DeckControls;

                    if (control is null || !allowed.Contains(control))
                    {
                        context.AddFailure($"Control is not a recognised control for owner '{owner}'.");
                    }
                });

            RuleFor(x => x.Style)
                .NotNull().WithMessage("Mapping style is required.")
                .SetValidator(new MidiMappingStyleValidator());
        }
    }

    public class DeckDeviceBindingValidator : AbstractValidator<DeckDeviceBindingDto>
    {
        public DeckDeviceBindingValidator()
        {
            RuleFor(x => x.Slot)
                .Must(slot => slot is not null && MidiSettingsAllowLists.Slots.Contains(slot))
                .WithMessage("Deck slot must be 'A' or 'B'.");

            RuleFor(x => x.DeviceId)
                .Must(deviceId => deviceId.IsValidDeviceId()).WithMessage("Device ID must be 1-32 letters, digits, hyphens, or underscores.");

            RuleFor(x => x.LastSeenName)
                .NotNull().WithMessage("Last seen name is required.")
                .MaximumLength(128).WithMessage("Last seen name must be at most 128 characters.");
        }
    }
}
