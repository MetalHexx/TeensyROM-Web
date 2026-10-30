using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Endpoints.DjLibrary
{
    /// <summary>
    /// Maps between the DJ library DTOs and the stored documents, shared by the action mappers.
    /// </summary>
    internal static class DjLibraryMapping
    {
        public static DjSet ToDocument(DjSetDto dto) => new()
        {
            Id = dto.Id,
            Name = dto.Name,
            Placeholder = dto.Placeholder,
            Rows = dto.Rows.Select(ToDocument).ToList(),
            Created = dto.Created,
            Updated = dto.Updated
        };

        public static DjTuneMemory ToDocument(DjTuneMemoryDto dto) => new()
        {
            SidHash = dto.SidHash,
            LastSubtune = dto.LastSubtune,
            Subtunes = dto.Subtunes.Select(ToDocument).ToList(),
            Updated = dto.Updated
        };

        public static DjLibraryState ToDocument(DjLibraryStateDto dto) => new() { CurrentSetId = dto.CurrentSetId };

        public static DjSetDto ToDto(DjSet document) => new()
        {
            Id = document.Id,
            Name = document.Name,
            Placeholder = document.Placeholder,
            Rows = (document.Rows ?? []).Select(ToDto).ToList(),
            Created = document.Created,
            Updated = document.Updated
        };

        public static DjTuneMemoryDto ToDto(DjTuneMemory document) => new()
        {
            SidHash = document.SidHash,
            LastSubtune = document.LastSubtune,
            Subtunes = (document.Subtunes ?? []).Select(ToDto).ToList(),
            Updated = document.Updated
        };

        public static DjSetSummaryDto ToDto(DjSetSummary summary) => new()
        {
            Id = summary.Id,
            Name = summary.Name,
            RowCount = summary.RowCount,
            Updated = summary.Updated
        };

        private static DjSetRow ToDocument(DjSetRowDto dto) => new()
        {
            Id = dto.Id,
            Tune = new DjRowTune
            {
                SidHash = dto.Tune.SidHash,
                Title = dto.Tune.Title,
                Author = dto.Tune.Author,
                Released = dto.Tune.Released,
                SubtuneCount = dto.Tune.SubtuneCount,
                ByteLength = dto.Tune.ByteLength
            },
            CopiedFrom = dto.CopiedFrom is null ? null : new DjMemoryLink { SidHash = dto.CopiedFrom.SidHash, Updated = dto.CopiedFrom.Updated },
            LastSubtune = dto.LastSubtune,
            Subtunes = dto.Subtunes.Select(ToDocument).ToList(),
            Host = dto.Host
        };

        private static DjSubtuneMemory ToDocument(DjSubtuneMemoryDto dto) => new()
        {
            Subtune = dto.Subtune,
            Markers = dto.Markers.Select(ToDocument).ToList(),
            Settings = dto.Settings
        };

        private static DjLoopMarker ToDocument(DjLoopMarkerDto dto) => new()
        {
            Id = dto.Id,
            Name = dto.Name,
            Start = ToDocument(dto.Start),
            End = dto.End is null ? null : ToDocument(dto.End),
            Voices = [.. dto.Voices],
            Settings = dto.Settings,
            UsesOwnSettings = dto.UsesOwnSettings,
            Wraps = dto.Wraps
        };

        private static DjLoopBoundary ToDocument(DjLoopBoundaryDto dto) => new() { Frame = dto.Frame, OffsetFrames = dto.OffsetFrames };

        private static DjSetRowDto ToDto(DjSetRow document) => new()
        {
            Id = document.Id,
            Tune = new DjRowTuneDto
            {
                SidHash = document.Tune.SidHash,
                Title = document.Tune.Title,
                Author = document.Tune.Author,
                Released = document.Tune.Released,
                SubtuneCount = document.Tune.SubtuneCount,
                ByteLength = document.Tune.ByteLength
            },
            CopiedFrom = document.CopiedFrom is null ? null : new DjMemoryLinkDto { SidHash = document.CopiedFrom.SidHash, Updated = document.CopiedFrom.Updated },
            LastSubtune = document.LastSubtune,
            Subtunes = (document.Subtunes ?? []).Select(ToDto).ToList(),
            Host = document.Host
        };

        private static DjSubtuneMemoryDto ToDto(DjSubtuneMemory document) => new()
        {
            Subtune = document.Subtune,
            Markers = (document.Markers ?? []).Select(ToDto).ToList(),
            Settings = document.Settings
        };

        private static DjLoopMarkerDto ToDto(DjLoopMarker document) => new()
        {
            Id = document.Id,
            Name = document.Name,
            Start = ToDto(document.Start),
            End = document.End is null ? null : ToDto(document.End),
            Voices = [.. document.Voices ?? []],
            Settings = document.Settings,
            UsesOwnSettings = document.UsesOwnSettings,
            Wraps = document.Wraps
        };

        private static DjLoopBoundaryDto ToDto(DjLoopBoundary document) => new() { Frame = document.Frame, OffsetFrames = document.OffsetFrames };
    }
}
