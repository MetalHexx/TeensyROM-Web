import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DjLibraryApiService } from '@teensyrom-nx/data-access/api-client';
import type { TuneMemory } from '@sidablist/tunes';
import { ApiTuneMemoryStore } from './api-tune-memory-store';
import { toDjTuneMemoryDto } from './dj-library.mapper';

const MEMORY: TuneMemory = {
  sidHash: 'h1',
  lastSubtune: 2,
  updated: '2026-01-03T00:00:00.000Z',
  subtunes: [
    {
      subtune: 2,
      settings: { gain: 1 },
      markers: [{ id: 'm', start: { frame: 1, offsetFrames: 0 }, end: null, voices: [0, 1, 2] }],
    },
  ],
};

describe('ApiTuneMemoryStore', () => {
  let store: ApiTuneMemoryStore;
  let api: { getTuneMemory: ReturnType<typeof vi.fn>; saveTuneMemory: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      getTuneMemory: vi.fn(),
      saveTuneMemory: vi.fn().mockResolvedValue({ message: 'saved' }),
    };
    TestBed.configureTestingModule({
      providers: [ApiTuneMemoryStore, { provide: DjLibraryApiService, useValue: api }],
    });
    store = TestBed.inject(ApiTuneMemoryStore);
  });

  it('loads a tune\'s memory, mapped from its DTO', async () => {
    api.getTuneMemory.mockResolvedValue({ memory: toDjTuneMemoryDto(MEMORY) });

    expect(await store.load('h1')).toEqual(MEMORY);
    expect(api.getTuneMemory).toHaveBeenCalledWith({ sidHash: 'h1' });
  });

  it('loads null for a tune with no memory', async () => {
    api.getTuneMemory.mockResolvedValue({ memory: null });

    expect(await store.load('h1')).toBeNull();
  });

  it('saves a memory under its hash', async () => {
    await store.save(MEMORY);

    expect(api.saveTuneMemory).toHaveBeenCalledWith({
      sidHash: 'h1',
      djTuneMemoryDto: toDjTuneMemoryDto(MEMORY),
    });
  });

  it('lets a failed load and a failed save propagate', async () => {
    api.getTuneMemory.mockRejectedValue(new Error('500'));
    api.saveTuneMemory.mockRejectedValue(new Error('400'));

    await expect(store.load('h1')).rejects.toThrow('500');
    await expect(store.save(MEMORY)).rejects.toThrow('400');
  });
});
