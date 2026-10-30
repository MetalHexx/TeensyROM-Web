using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Linq.Expressions;
using System.Text.Json;
using System.Text.RegularExpressions;
using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary
{
    /// <summary>
    /// A DJ set: a named, ordered list of tunes with the memory the set holds for each.
    /// </summary>
    public record DjSetDto
    {
        /// <summary>
        /// The set id: a lowercase GUID in the hyphenated format. Must equal the id in the route.
        /// </summary>
        [Required] public string Id { get; set; } = string.Empty;

        /// <summary>
        /// Display name, 1-64 characters after trimming, with no control characters.
        /// </summary>
        [Required] public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Placeholder name offered for a new set, 1-64 characters after trimming, with no control characters.
        /// </summary>
        [Required] public string Placeholder { get; set; } = string.Empty;

        /// <summary>
        /// The tunes in play order. At most 1000, with unique row ids and each SID at most once.
        /// </summary>
        [Required] public List<DjSetRowDto> Rows { get; set; } = [];

        /// <summary>
        /// When the set was created, as an ISO-8601 timestamp.
        /// </summary>
        [Required] public string Created { get; set; } = string.Empty;

        /// <summary>
        /// When the set was last changed, as an ISO-8601 timestamp.
        /// </summary>
        [Required] public string Updated { get; set; } = string.Empty;
    }

    /// <summary>
    /// One tune in a set, with the memory the set holds for it.
    /// </summary>
    public record DjSetRowDto
    {
        /// <summary>
        /// The row id: a lowercase GUID in the hyphenated format, unique within the set.
        /// </summary>
        [Required] public string Id { get; set; } = string.Empty;

        /// <summary>
        /// The tune this row plays.
        /// </summary>
        [Required] public DjRowTuneDto Tune { get; set; } = new();

        /// <summary>
        /// The tune memory this row's memory was copied from. Its SID hash must equal the tune's. Null when it was not copied.
        /// </summary>
        public DjMemoryLinkDto? CopiedFrom { get; set; }

        /// <summary>
        /// The subtune last played, from 1 up to the tune's subtune count.
        /// </summary>
        [Required] public int LastSubtune { get; set; }

        /// <summary>
        /// Per-subtune memory held by this row. Subtune numbers are unique and within the tune's subtune count.
        /// </summary>
        [Required] public List<DjSubtuneMemoryDto> Subtunes { get; set; } = [];

        /// <summary>
        /// Host-defined data stored and returned verbatim. Null or at most 8192 characters of JSON.
        /// </summary>
        public JsonElement? Host { get; set; }
    }

    /// <summary>
    /// Identifies a tune and describes it for display.
    /// </summary>
    public record DjRowTuneDto
    {
        /// <summary>
        /// The tune's SID hash: 32 lowercase hexadecimal characters.
        /// </summary>
        [Required] public string SidHash { get; set; } = string.Empty;

        /// <summary>
        /// The tune's title, at most 64 characters.
        /// </summary>
        [Required] public string Title { get; set; } = string.Empty;

        /// <summary>
        /// The tune's author, at most 64 characters.
        /// </summary>
        [Required] public string Author { get; set; } = string.Empty;

        /// <summary>
        /// The tune's release information, at most 64 characters.
        /// </summary>
        [Required] public string Released { get; set; } = string.Empty;

        /// <summary>
        /// How many subtunes the tune has, 1-256.
        /// </summary>
        [Required] public int SubtuneCount { get; set; }

        /// <summary>
        /// The size of the tune in bytes, 1-1048576.
        /// </summary>
        [Required] public int ByteLength { get; set; }
    }

    /// <summary>
    /// Points at the tune memory a row's memory was copied from.
    /// </summary>
    public record DjMemoryLinkDto
    {
        /// <summary>
        /// The SID hash of the tune memory copied from: 32 lowercase hexadecimal characters.
        /// </summary>
        [Required] public string SidHash { get; set; } = string.Empty;

        /// <summary>
        /// When that memory was last changed, as an ISO-8601 timestamp.
        /// </summary>
        [Required] public string Updated { get; set; } = string.Empty;
    }

    /// <summary>
    /// The memory kept for one subtune: its loop markers and settings.
    /// </summary>
    public record DjSubtuneMemoryDto
    {
        /// <summary>
        /// The subtune number, from 1 up to the tune's subtune count.
        /// </summary>
        [Required] public int Subtune { get; set; }

        /// <summary>
        /// Loop markers. At most 128, with unique ids.
        /// </summary>
        [Required] public List<DjLoopMarkerDto> Markers { get; set; } = [];

        /// <summary>
        /// Subtune settings stored and returned verbatim. Null or at most 8192 characters of JSON.
        /// </summary>
        public JsonElement? Settings { get; set; }
    }

    /// <summary>
    /// A loop marker: a start, an optional end and the voices it applies to.
    /// </summary>
    public record DjLoopMarkerDto
    {
        /// <summary>
        /// The marker id, 1-64 letters, digits, hyphens or underscores, unique within the subtune.
        /// </summary>
        [Required] public string Id { get; set; } = string.Empty;

        /// <summary>
        /// Display name, 1-48 characters after trimming with no control characters. Null when unnamed.
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Where the loop starts.
        /// </summary>
        [Required] public DjLoopBoundaryDto Start { get; set; } = new();

        /// <summary>
        /// Where the loop ends. Null for an open marker.
        /// </summary>
        public DjLoopBoundaryDto? End { get; set; }

        /// <summary>
        /// The voices the marker applies to: 1-3 distinct values in 0-2.
        /// </summary>
        [Required] public List<int> Voices { get; set; } = [];

        /// <summary>
        /// Marker settings stored and returned verbatim. Null or at most 8192 characters of JSON.
        /// </summary>
        public JsonElement? Settings { get; set; }

        /// <summary>
        /// Whether the marker uses its own settings instead of the subtune's. Null when not set.
        /// </summary>
        public bool? UsesOwnSettings { get; set; }

        /// <summary>
        /// Whether backing a scrubbed record past the loop's start wraps it to the loop's end instead of stopping it there. Null when not set.
        /// </summary>
        public bool? Wraps { get; set; }
    }

    /// <summary>
    /// A position in a tune: a frame plus a fine offset.
    /// </summary>
    public record DjLoopBoundaryDto
    {
        /// <summary>
        /// The frame, 0 or more.
        /// </summary>
        [Required] public int Frame { get; set; }

        /// <summary>
        /// A fine offset in frames, within plus or minus 1000000.
        /// </summary>
        [Required] public int OffsetFrames { get; set; }
    }

    /// <summary>
    /// The memory kept for one tune, shared across sets.
    /// </summary>
    public record DjTuneMemoryDto
    {
        /// <summary>
        /// The tune's SID hash: 32 lowercase hexadecimal characters. Must equal the hash in the route.
        /// </summary>
        [Required] public string SidHash { get; set; } = string.Empty;

        /// <summary>
        /// The subtune last played, 1-256.
        /// </summary>
        [Required] public int LastSubtune { get; set; }

        /// <summary>
        /// Per-subtune memory. Subtune numbers are unique, 1-256.
        /// </summary>
        [Required] public List<DjSubtuneMemoryDto> Subtunes { get; set; } = [];

        /// <summary>
        /// When the memory was last changed, as an ISO-8601 timestamp.
        /// </summary>
        [Required] public string Updated { get; set; } = string.Empty;
    }

    /// <summary>
    /// A set as listed, without its rows.
    /// </summary>
    public record DjSetSummaryDto
    {
        /// <summary>
        /// The set id.
        /// </summary>
        [Required] public string Id { get; set; } = string.Empty;

        /// <summary>
        /// The set's display name.
        /// </summary>
        [Required] public string Name { get; set; } = string.Empty;

        /// <summary>
        /// How many rows the set holds.
        /// </summary>
        [Required] public int RowCount { get; set; }

        /// <summary>
        /// When the set was last changed, as an ISO-8601 timestamp.
        /// </summary>
        [Required] public string Updated { get; set; } = string.Empty;
    }

    /// <summary>
    /// Which set is current.
    /// </summary>
    public record DjLibraryStateDto
    {
        /// <summary>
        /// The id of the current set, or null when none is.
        /// </summary>
        public string? CurrentSetId { get; set; }
    }

    /// <summary>
    /// Bounds the library enforces.
    /// </summary>
    public static class DjLibraryLimits
    {
        public const int MaxSets = DjLibraryService.DefaultMaxSets;
        public const int MaxRowsPerSet = 1000;
        public const int MaxLabelLength = 64;
        public const int MaxTuneTextLength = 64;
        public const int MaxSubtuneCount = 256;
        public const int MaxByteLength = 1_048_576;
        public const int MaxMarkersPerSubtune = 128;
        public const int MaxMarkerNameLength = 48;
        public const int MaxOffsetFrames = 1_000_000;
        public const int MaxVoices = 3;
        public const int MaxVoiceNumber = 2;
        public const int MaxOpaqueLength = 8192;
    }

    /// <summary>
    /// Checks shared by the DJ library validators.
    /// </summary>
    internal static partial class DjLibraryRules
    {
        [GeneratedRegex(@"^[A-Za-z0-9_-]{1,64}\z")]
        private static partial Regex MarkerIdPattern();

        public static bool IsMarkerId(string? id) => id is not null && MarkerIdPattern().IsMatch(id);

        public static bool IsLabel(string? value, int maxLength)
        {
            if (value is null) return false;
            var trimmed = value.Trim();
            return trimmed.Length >= 1 && trimmed.Length <= maxLength && !trimmed.Any(char.IsControl);
        }

        public static bool IsTimestamp(string? value) =>
            value is not null && DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out _);

        public static bool IsBoundedOpaque(JsonElement? value) =>
            value is null || value.Value.ValueKind == JsonValueKind.Undefined || value.Value.GetRawText().Length <= DjLibraryLimits.MaxOpaqueLength;

        /// <summary>
        /// Flags every item whose key was already seen, at <c>{collection}[i]{property}</c>.
        /// </summary>
        public static void FlagDuplicates<TItem, TRoot>(
            IReadOnlyList<TItem?>? items,
            Func<TItem, object?> keyOf,
            string collection,
            string property,
            string message,
            ValidationContext<TRoot> context) where TItem : class
        {
            if (items is null) return;

            var seen = new HashSet<object>();
            for (var i = 0; i < items.Count; i++)
            {
                var item = items[i];
                if (item is null) continue;

                var key = keyOf(item);
                if (key is not null && !seen.Add(key))
                {
                    context.AddFailure($"{collection}[{i}]{property}", message);
                }
            }
        }

        /// <summary>
        /// Adds the rules for a <c>Subtunes</c> list: present, each entry valid within <paramref name="maxSubtune"/>, and unique subtune numbers.
        /// </summary>
        public static void AddSubtuneRules<T>(
            this AbstractValidator<T> validator,
            Expression<Func<T, IEnumerable<DjSubtuneMemoryDto>>> subtunes,
            Func<T, int> maxSubtune)
        {
            var read = subtunes.Compile();

            validator.RuleFor(subtunes).NotNull().WithMessage("Subtunes list is required.");
            validator.RuleForEach(subtunes)
                .NotNull().WithMessage("Subtune entries must not be null.")
                .SetValidator(root => new DjSubtuneMemoryValidator(maxSubtune(root)));
            validator.RuleFor(x => x).Custom((root, context) =>
                FlagDuplicates(read(root)?.ToList(), s => s.Subtune, "Subtunes", ".Subtune", "Subtune is already used by another entry.", context));
        }
    }

    // Validators
    public class DjLoopBoundaryValidator : AbstractValidator<DjLoopBoundaryDto>
    {
        public DjLoopBoundaryValidator()
        {
            RuleFor(x => x.Frame)
                .GreaterThanOrEqualTo(0).WithMessage("Frame must be 0 or more.");

            RuleFor(x => x.OffsetFrames)
                .InclusiveBetween(-DjLibraryLimits.MaxOffsetFrames, DjLibraryLimits.MaxOffsetFrames)
                .WithMessage($"Offset must be within {DjLibraryLimits.MaxOffsetFrames} frames either way.");
        }
    }

    public class DjLoopMarkerValidator : AbstractValidator<DjLoopMarkerDto>
    {
        public DjLoopMarkerValidator()
        {
            RuleFor(x => x.Id)
                .Must(DjLibraryRules.IsMarkerId).WithMessage("Marker ID must be 1-64 letters, digits, hyphens or underscores.");

            RuleFor(x => x.Name)
                .Must(name => name is null || DjLibraryRules.IsLabel(name, DjLibraryLimits.MaxMarkerNameLength))
                .WithMessage($"Marker name must be null, or 1-{DjLibraryLimits.MaxMarkerNameLength} characters with no control characters.");

            RuleFor(x => x.Start).Cascade(CascadeMode.Stop)
                .NotNull().WithMessage("Marker start is required.")
                .SetValidator(new DjLoopBoundaryValidator());

            RuleFor(x => x.End).SetValidator(new DjLoopBoundaryValidator());

            RuleFor(x => x.Voices).Cascade(CascadeMode.Stop)
                .NotNull().WithMessage("Voices list is required.")
                .Must(voices => voices.Count is >= 1 and <= DjLibraryLimits.MaxVoices)
                .WithMessage($"A marker applies to 1-{DjLibraryLimits.MaxVoices} voices.")
                .Must(voices => voices.All(v => v is >= 0 and <= DjLibraryLimits.MaxVoiceNumber))
                .WithMessage($"Voices must be 0-{DjLibraryLimits.MaxVoiceNumber}.")
                .Must(voices => voices.Distinct().Count() == voices.Count)
                .WithMessage("Voices must be distinct.");

            RuleFor(x => x.Settings)
                .Must(DjLibraryRules.IsBoundedOpaque).WithMessage($"Settings must be at most {DjLibraryLimits.MaxOpaqueLength} characters of JSON.");
        }
    }

    /// <summary>
    /// Validates one subtune's memory. The subtune number must be within 1 and <paramref name="maxSubtune"/>.
    /// </summary>
    internal class DjSubtuneMemoryValidator : AbstractValidator<DjSubtuneMemoryDto>
    {
        public DjSubtuneMemoryValidator(int maxSubtune)
        {
            RuleFor(x => x.Subtune)
                .InclusiveBetween(1, maxSubtune).WithMessage($"Subtune must be 1-{maxSubtune}.");

            RuleFor(x => x.Markers).Cascade(CascadeMode.Stop)
                .NotNull().WithMessage("Markers list is required.")
                .Must(markers => markers.Count <= DjLibraryLimits.MaxMarkersPerSubtune)
                .WithMessage($"At most {DjLibraryLimits.MaxMarkersPerSubtune} markers are allowed per subtune.");

            RuleForEach(x => x.Markers)
                .NotNull().WithMessage("Marker entries must not be null.")
                .SetValidator(new DjLoopMarkerValidator());

            RuleFor(x => x).Custom((subtune, context) =>
                DjLibraryRules.FlagDuplicates(subtune.Markers, m => m.Id, "Markers", ".Id", "Marker ID is already used in this subtune.", context));

            RuleFor(x => x.Settings)
                .Must(DjLibraryRules.IsBoundedOpaque).WithMessage($"Settings must be at most {DjLibraryLimits.MaxOpaqueLength} characters of JSON.");
        }
    }

    public class DjRowTuneValidator : AbstractValidator<DjRowTuneDto>
    {
        public DjRowTuneValidator()
        {
            RuleFor(x => x.SidHash)
                .Must(DjLibraryIds.IsSidHash).WithMessage("SID hash must be 32 lowercase hexadecimal characters.");

            RuleFor(x => x.Title)
                .Must(text => text is not null && text.Length <= DjLibraryLimits.MaxTuneTextLength)
                .WithMessage($"Title is required and at most {DjLibraryLimits.MaxTuneTextLength} characters.");

            RuleFor(x => x.Author)
                .Must(text => text is not null && text.Length <= DjLibraryLimits.MaxTuneTextLength)
                .WithMessage($"Author is required and at most {DjLibraryLimits.MaxTuneTextLength} characters.");

            RuleFor(x => x.Released)
                .Must(text => text is not null && text.Length <= DjLibraryLimits.MaxTuneTextLength)
                .WithMessage($"Released is required and at most {DjLibraryLimits.MaxTuneTextLength} characters.");

            RuleFor(x => x.SubtuneCount)
                .InclusiveBetween(1, DjLibraryLimits.MaxSubtuneCount).WithMessage($"Subtune count must be 1-{DjLibraryLimits.MaxSubtuneCount}.");

            RuleFor(x => x.ByteLength)
                .InclusiveBetween(1, DjLibraryLimits.MaxByteLength).WithMessage($"Byte length must be 1-{DjLibraryLimits.MaxByteLength}.");
        }
    }

    public class DjMemoryLinkValidator : AbstractValidator<DjMemoryLinkDto>
    {
        public DjMemoryLinkValidator()
        {
            RuleFor(x => x.SidHash)
                .Must(DjLibraryIds.IsSidHash).WithMessage("SID hash must be 32 lowercase hexadecimal characters.");

            RuleFor(x => x.Updated)
                .Must(DjLibraryRules.IsTimestamp).WithMessage("Updated must be an ISO-8601 timestamp.");
        }
    }

    public class DjSetRowValidator : AbstractValidator<DjSetRowDto>
    {
        public DjSetRowValidator()
        {
            RuleFor(x => x.Id)
                .Must(DjLibraryIds.IsSetId).WithMessage("Row ID must be a lowercase GUID.");

            RuleFor(x => x.Tune).Cascade(CascadeMode.Stop)
                .NotNull().WithMessage("Tune is required.")
                .SetValidator(new DjRowTuneValidator());

            RuleFor(x => x.CopiedFrom).SetValidator(new DjMemoryLinkValidator());

            RuleFor(x => x).Custom((row, context) =>
            {
                if (row.CopiedFrom is not null && row.Tune is not null && row.CopiedFrom.SidHash != row.Tune.SidHash)
                {
                    context.AddFailure("CopiedFrom.SidHash", "Copied-from SID hash must equal the tune's SID hash.");
                }
            });

            RuleFor(x => x.LastSubtune)
                .Must((row, lastSubtune) => lastSubtune >= 1 && lastSubtune <= MaxSubtune(row))
                .WithMessage("Last subtune must be 1 up to the tune's subtune count.");

            this.AddSubtuneRules(x => x.Subtunes, MaxSubtune);

            RuleFor(x => x.Host)
                .Must(DjLibraryRules.IsBoundedOpaque).WithMessage($"Host must be at most {DjLibraryLimits.MaxOpaqueLength} characters of JSON.");
        }

        private static int MaxSubtune(DjSetRowDto row) =>
            row.Tune is { SubtuneCount: >= 1 and <= DjLibraryLimits.MaxSubtuneCount } tune ? tune.SubtuneCount : DjLibraryLimits.MaxSubtuneCount;
    }

    public class DjSetValidator : AbstractValidator<DjSetDto>
    {
        public DjSetValidator()
        {
            RuleFor(x => x.Id)
                .Must(DjLibraryIds.IsSetId).WithMessage("Set ID must be a lowercase GUID.");

            RuleFor(x => x.Name)
                .Must(name => DjLibraryRules.IsLabel(name, DjLibraryLimits.MaxLabelLength))
                .WithMessage($"Name must be 1-{DjLibraryLimits.MaxLabelLength} characters with no control characters.");

            RuleFor(x => x.Placeholder)
                .Must(placeholder => DjLibraryRules.IsLabel(placeholder, DjLibraryLimits.MaxLabelLength))
                .WithMessage($"Placeholder must be 1-{DjLibraryLimits.MaxLabelLength} characters with no control characters.");

            RuleFor(x => x.Created)
                .Must(DjLibraryRules.IsTimestamp).WithMessage("Created must be an ISO-8601 timestamp.");

            RuleFor(x => x.Updated)
                .Must(DjLibraryRules.IsTimestamp).WithMessage("Updated must be an ISO-8601 timestamp.");

            RuleFor(x => x.Rows).Cascade(CascadeMode.Stop)
                .NotNull().WithMessage("Rows list is required.")
                .Must(rows => rows.Count <= DjLibraryLimits.MaxRowsPerSet)
                .WithMessage($"At most {DjLibraryLimits.MaxRowsPerSet} rows are allowed.");

            RuleForEach(x => x.Rows)
                .NotNull().WithMessage("Row entries must not be null.")
                .SetValidator(new DjSetRowValidator());

            RuleFor(x => x).Custom((set, context) =>
            {
                DjLibraryRules.FlagDuplicates(set.Rows, r => r.Id, "Rows", ".Id", "Row ID is already used by another row.", context);
                DjLibraryRules.FlagDuplicates(set.Rows, r => r.Tune?.SidHash, "Rows", ".Tune.SidHash", "This SID is already in the set.", context);
            });
        }
    }

    public class DjTuneMemoryValidator : AbstractValidator<DjTuneMemoryDto>
    {
        public DjTuneMemoryValidator()
        {
            RuleFor(x => x.SidHash)
                .Must(DjLibraryIds.IsSidHash).WithMessage("SID hash must be 32 lowercase hexadecimal characters.");

            RuleFor(x => x.LastSubtune)
                .InclusiveBetween(1, DjLibraryLimits.MaxSubtuneCount).WithMessage($"Last subtune must be 1-{DjLibraryLimits.MaxSubtuneCount}.");

            this.AddSubtuneRules(x => x.Subtunes, _ => DjLibraryLimits.MaxSubtuneCount);

            RuleFor(x => x.Updated)
                .Must(DjLibraryRules.IsTimestamp).WithMessage("Updated must be an ISO-8601 timestamp.");
        }
    }

    public class DjLibraryStateValidator : AbstractValidator<DjLibraryStateDto>
    {
        public DjLibraryStateValidator()
        {
            RuleFor(x => x.CurrentSetId)
                .Must(id => id is null || DjLibraryIds.IsSetId(id)).WithMessage("Current set ID must be null or a lowercase GUID.");
        }
    }
}
