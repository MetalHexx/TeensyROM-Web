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
    }

    public record DjLoopBoundary
    {
        public int Frame { get; init; }
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
    /// Which set is current, or null when none is.
    /// </summary>
    public record DjLibraryState
    {
        public string? CurrentSetId { get; init; }
    }

    public record DjSetSummary(string Id, string Name, int RowCount, string Updated);
}
