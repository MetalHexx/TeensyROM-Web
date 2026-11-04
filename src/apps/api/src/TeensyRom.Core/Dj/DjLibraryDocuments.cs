using System.Text.Json;

namespace TeensyRom.Core.Dj
{
    /// <summary>
    /// A stored DJ set: a named, ordered list of tunes with their memory. Opaque values are kept verbatim.
    /// </summary>
    public record DjSet
    {
        public string Id { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string Placeholder { get; init; } = string.Empty;
        public IReadOnlyList<DjSetRow> Rows { get; init; } = [];
        public string Created { get; init; } = string.Empty;
        public string Updated { get; init; } = string.Empty;
    }

    /// <summary>
    /// One tune in a set, with the memory the set holds for it.
    /// </summary>
    public record DjSetRow
    {
        public string Id { get; init; } = string.Empty;
        public DjRowTune Tune { get; init; } = new();
        public DjMemoryLink? CopiedFrom { get; init; }
        public int LastSubtune { get; init; }
        public IReadOnlyList<DjSubtuneMemory> Subtunes { get; init; } = [];
        public JsonElement? Host { get; init; }
    }

    public record DjRowTune
    {
        public string SidHash { get; init; } = string.Empty;
        public string Title { get; init; } = string.Empty;
        public string Author { get; init; } = string.Empty;
        public string Released { get; init; } = string.Empty;
        public int SubtuneCount { get; init; }
        public int ByteLength { get; init; }
    }

    public record DjMemoryLink
    {
        public string SidHash { get; init; } = string.Empty;
        public string Updated { get; init; } = string.Empty;
    }

    public record DjSubtuneMemory
    {
        public int Subtune { get; init; }
        public IReadOnlyList<DjLoopMarker> Markers { get; init; } = [];
        public JsonElement? Settings { get; init; }
    }

    public record DjLoopMarker
    {
        public string Id { get; init; } = string.Empty;
        public string? Name { get; init; }
        public DjLoopBoundary Start { get; init; } = new();
        public DjLoopBoundary? End { get; init; }
        public IReadOnlyList<int> Voices { get; init; } = [];
        public JsonElement? Settings { get; init; }
        public bool? UsesOwnSettings { get; init; }
        public bool? Wraps { get; init; }
    }

    /// <summary>
    /// A position in a tune. The frame may be fractional; files written when it was a whole number read back unchanged.
    /// </summary>
    public record DjLoopBoundary
    {
        public double Frame { get; init; }
        public int OffsetFrames { get; init; }
    }

    /// <summary>
    /// The memory kept for one tune, keyed by its SID hash.
    /// </summary>
    public record DjTuneMemory
    {
        public string SidHash { get; init; } = string.Empty;
        public int LastSubtune { get; init; }
        public IReadOnlyList<DjSubtuneMemory> Subtunes { get; init; } = [];
        public string Updated { get; init; } = string.Empty;
    }

    /// <summary>
    /// The beat grids a DJ tapped for one tune, keyed by its SID hash: one per subtune, each holding over the whole subtune.
    /// </summary>
    public record DjTuneGrids
    {
        public string SidHash { get; init; } = string.Empty;
        public IReadOnlyList<DjSubtuneGrid> Subtunes { get; init; } = [];
        public string Updated { get; init; } = string.Empty;
    }

    /// <summary>
    /// The beat grid of one subtune: the length of a beat and the frame the first beat falls on.
    /// </summary>
    public record DjSubtuneGrid
    {
        public int Subtune { get; init; }
        public int BeatFrames { get; init; }
        public int BeatOneFrame { get; init; }
    }

    /// <summary>
    /// Which set is current, or null when none is.
    /// </summary>
    public record DjLibraryState
    {
        public string? CurrentSetId { get; init; }
    }

    public record DjSetSummary(string Id, string Name, int RowCount, string Updated);
}
