import { describe, it, expect } from 'vitest';
import type { DjSetDto, DjTuneMemoryDto } from '@teensyrom-nx/data-access/api-client';
import type { TuneMemory, TuneSet } from '@sidablist/tunes';
import {
  toDjSetDto,
  toDjTuneMemoryDto,
  toSetSummary,
  toTuneMemory,
  toTuneSet,
} from './dj-library.mapper';

const SETTINGS = { gain: 0.5, nested: [1, 'two', null, { deep: true }] };

const FULL_SET: TuneSet = {
  id: 'set-1',
  name: 'Friday',
  placeholder: 'Set 1',
  created: '2026-01-01T00:00:00.000Z',
  updated: '2026-01-02T00:00:00.000Z',
  rows: [
    {
      id: 'row-1',
      tune: { sidHash: 'h1', title: 'T', author: 'A', released: '1987', subtuneCount: 3, byteLength: 4096 },
      copiedFrom: { sidHash: 'h1', updated: '2026-01-01T12:00:00.000Z' },
      lastSubtune: 2,
      host: { v: 1, source: { path: '/a.sid' } },
      subtunes: [
        {
          subtune: 2,
          settings: SETTINGS,
          markers: [
            {
              id: 'm1',
              name: 'Drop',
              start: { frame: 100, offsetFrames: -2 },
              end: { frame: 200, offsetFrames: 3 },
              voices: [0, 1, 2],
              settings: SETTINGS,
              usesOwnSettings: true,
            },
          ],
        },
      ],
    },
  ],
};

const BARE_SET: TuneSet = {
  id: 'set-2',
  name: 'Bare',
  placeholder: 'Set 2',
  created: '2026-01-01T00:00:00.000Z',
  updated: '2026-01-01T00:00:00.000Z',
  rows: [
    {
      id: 'row-2',
      tune: { sidHash: 'h2', title: 'T', author: 'A', released: '', subtuneCount: 1, byteLength: 10 },
      copiedFrom: null,
      lastSubtune: 1,
      subtunes: [
        {
          subtune: 1,
          markers: [{ id: 'm2', start: { frame: 5, offsetFrames: 0 }, end: null, voices: [0] }],
        },
      ],
    },
  ],
};

describe('dj library mapper', () => {
  it('round-trips a set with every optional field present', () => {
    expect(toTuneSet(toDjSetDto(FULL_SET))).toEqual(FULL_SET);
  });

  it('round-trips a set with every optional field absent', () => {
    expect(toTuneSet(toDjSetDto(BARE_SET))).toEqual(BARE_SET);
  });

  it('sends an absent optional field as null, and reads null back as absent', () => {
    const dto = toDjSetDto(BARE_SET);
    const row = dto.rows[0];
    const marker = row.subtunes[0].markers[0];

    expect(row.copiedFrom).toBeNull();
    expect(row.host).toBeNull();
    expect(row.subtunes[0].settings).toBeNull();
    expect(marker).toMatchObject({ name: null, end: null, settings: null, usesOwnSettings: null });

    const read = toTuneSet(dto);
    expect(read.rows[0]).not.toHaveProperty('host');
    expect(read.rows[0].subtunes[0]).not.toHaveProperty('settings');
    expect(read.rows[0].subtunes[0].markers[0]).not.toHaveProperty('name');
    expect(read.rows[0].subtunes[0].markers[0]).not.toHaveProperty('usesOwnSettings');
  });

  it('reads a DTO whose optional fields are missing rather than null', () => {
    const dto: DjSetDto = {
      id: 's',
      name: 'n',
      placeholder: 'Set 1',
      created: 'c',
      updated: 'u',
      rows: [
        {
          id: 'r',
          tune: { sidHash: 'h', title: 't', author: 'a', released: '', subtuneCount: 1, byteLength: 1 },
          lastSubtune: 1,
          subtunes: [{ subtune: 1, markers: [{ id: 'm', start: { frame: 0, offsetFrames: 0 }, voices: [] }] }],
        },
      ],
    };

    expect(toTuneSet(dto).rows[0]).toMatchObject({
      copiedFrom: null,
      subtunes: [{ markers: [{ end: null }] }],
    });
  });

  it('keeps a falsy opaque value rather than dropping it', () => {
    const set: TuneSet = {
      ...BARE_SET,
      rows: [{ ...BARE_SET.rows[0], host: 0, subtunes: [{ subtune: 1, markers: [], settings: false }] }],
    };

    expect(toTuneSet(toDjSetDto(set))).toEqual(set);
  });

  it('copies arrays and leaves opaque values as they are', () => {
    const dto = toDjSetDto(FULL_SET);

    expect(dto.rows).not.toBe(FULL_SET.rows);
    expect(dto.rows[0].subtunes[0].markers[0].voices).not.toBe(FULL_SET.rows[0].subtunes[0].markers[0].voices);
    expect(dto.rows[0].subtunes[0].settings).toBe(SETTINGS);
    expect(dto.rows[0].host).toBe(FULL_SET.rows[0].host);
  });

  it('round-trips tune memory', () => {
    const memory: TuneMemory = {
      sidHash: 'h1',
      lastSubtune: 2,
      updated: '2026-01-03T00:00:00.000Z',
      subtunes: FULL_SET.rows[0].subtunes,
    };

    expect(toTuneMemory(toDjTuneMemoryDto(memory))).toEqual(memory);
    expect(toTuneMemory({ ...toDjTuneMemoryDto(memory), subtunes: [] } satisfies DjTuneMemoryDto).subtunes).toEqual([]);
  });

  it('reads a set summary', () => {
    expect(toSetSummary({ id: 's', name: 'n', rowCount: 3, updated: 'u' })).toEqual({
      id: 's',
      name: 'n',
      rowCount: 3,
      updated: 'u',
    });
  });
});
