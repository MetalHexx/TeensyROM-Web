import type {
  DjLoopBoundaryDto,
  DjLoopBoundaryDto2,
  DjLoopMarkerDto,
  DjMemoryLinkDto,
  DjRowTuneDto,
  DjSetDto,
  DjSetRowDto,
  DjSetSummaryDto,
  DjSubtuneMemoryDto,
  DjTuneMemoryDto,
} from '@teensyrom-nx/data-access/api-client';
import type {
  LoopBoundary,
  LoopMarker,
  MemoryLink,
  RowTune,
  SetRow,
  SetSummary,
  SubtuneMemory,
  TuneMemory,
  TuneSet,
} from '@sidablist/tunes';

/**
 * The library's documents and the wire's DTOs. The DTOs mark an absent optional field as `null`
 * where the library leaves it off, so the mapper turns one into the other both ways; arrays are
 * copied, and the host's opaque values (a marker's, a subtune's or a row's `settings` or `host`)
 * pass through untouched.
 */

export function toSetSummary(dto: DjSetSummaryDto): SetSummary {
  return { id: dto.id, name: dto.name, rowCount: dto.rowCount, updated: dto.updated };
}

export function toTuneSet(dto: DjSetDto): TuneSet {
  return {
    id: dto.id,
    name: dto.name,
    placeholder: dto.placeholder,
    rows: dto.rows.map(toSetRow),
    created: dto.created,
    updated: dto.updated,
  };
}

export function toDjSetDto(set: TuneSet): DjSetDto {
  return {
    id: set.id,
    name: set.name,
    placeholder: set.placeholder,
    rows: set.rows.map(toSetRowDto),
    created: set.created,
    updated: set.updated,
  };
}

export function toTuneMemory(dto: DjTuneMemoryDto): TuneMemory {
  return {
    sidHash: dto.sidHash,
    lastSubtune: dto.lastSubtune,
    subtunes: dto.subtunes.map(toSubtuneMemory),
    updated: dto.updated,
  };
}

export function toDjTuneMemoryDto(memory: TuneMemory): DjTuneMemoryDto {
  return {
    sidHash: memory.sidHash,
    lastSubtune: memory.lastSubtune,
    subtunes: memory.subtunes.map(toSubtuneMemoryDto),
    updated: memory.updated,
  };
}

function toSetRow(dto: DjSetRowDto): SetRow {
  return {
    id: dto.id,
    tune: toRowTune(dto.tune),
    copiedFrom: dto.copiedFrom == null ? null : toMemoryLink(dto.copiedFrom),
    lastSubtune: dto.lastSubtune,
    subtunes: dto.subtunes.map(toSubtuneMemory),
    ...(dto.host == null ? {} : { host: dto.host }),
  };
}

function toSetRowDto(row: SetRow): DjSetRowDto {
  return {
    id: row.id,
    tune: { ...row.tune },
    copiedFrom: row.copiedFrom === null ? null : { ...row.copiedFrom },
    lastSubtune: row.lastSubtune,
    subtunes: row.subtunes.map(toSubtuneMemoryDto),
    host: row.host ?? null,
  };
}

function toRowTune(dto: DjRowTuneDto): RowTune {
  return {
    sidHash: dto.sidHash,
    title: dto.title,
    author: dto.author,
    released: dto.released,
    subtuneCount: dto.subtuneCount,
    byteLength: dto.byteLength,
  };
}

function toMemoryLink(dto: DjMemoryLinkDto): MemoryLink {
  return { sidHash: dto.sidHash, updated: dto.updated };
}

function toSubtuneMemory(dto: DjSubtuneMemoryDto): SubtuneMemory {
  return {
    subtune: dto.subtune,
    markers: dto.markers.map(toLoopMarker),
    ...(dto.settings == null ? {} : { settings: dto.settings }),
  };
}

function toSubtuneMemoryDto(memory: SubtuneMemory): DjSubtuneMemoryDto {
  return {
    subtune: memory.subtune,
    markers: memory.markers.map(toLoopMarkerDto),
    settings: memory.settings ?? null,
  };
}

function toLoopMarker(dto: DjLoopMarkerDto): LoopMarker {
  return {
    id: dto.id,
    ...(dto.name == null ? {} : { name: dto.name }),
    start: toLoopBoundary(dto.start),
    end: dto.end == null ? null : toLoopBoundary(dto.end),
    voices: [...dto.voices],
    ...(dto.settings == null ? {} : { settings: dto.settings }),
    ...(dto.usesOwnSettings == null ? {} : { usesOwnSettings: dto.usesOwnSettings }),
    ...(dto.wraps == null ? {} : { wraps: dto.wraps }),
  };
}

function toLoopMarkerDto(marker: LoopMarker): DjLoopMarkerDto {
  return {
    id: marker.id,
    name: marker.name ?? null,
    start: toLoopBoundaryDto(marker.start),
    end: marker.end === null ? null : toLoopBoundaryDto(marker.end),
    voices: [...marker.voices],
    settings: marker.settings ?? null,
    usesOwnSettings: marker.usesOwnSettings ?? null,
    wraps: marker.wraps ?? null,
  };
}

function toLoopBoundary(dto: DjLoopBoundaryDto | DjLoopBoundaryDto2): LoopBoundary {
  return { frame: dto.frame, offsetFrames: dto.offsetFrames };
}

function toLoopBoundaryDto(boundary: LoopBoundary): DjLoopBoundaryDto {
  return { frame: boundary.frame, offsetFrames: boundary.offsetFrames };
}
