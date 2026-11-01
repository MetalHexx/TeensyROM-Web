import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DjLibraryApiService } from '@teensyrom-nx/data-access/api-client';
import type { TuneBeatGrids } from '@teensyrom-nx/application';
import { ApiBeatGridStore } from './api-beat-grid-store';
import { toDjTuneGridsDto } from './dj-library.mapper';

const GRIDS: TuneBeatGrids = {
  sidHash: 'h1',
  updated: '2026-01-03T00:00:00.000Z',
  subtunes: [
    { subtune: 1, beatFrames: 24, beatOneFrame: 6 },
    { subtune: 3, beatFrames: 25.5, beatOneFrame: 0 },
  ],
};

describe('ApiBeatGridStore', () => {
  let store: ApiBeatGridStore;
  let api: { getTuneGrids: ReturnType<typeof vi.fn>; saveTuneGrids: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      getTuneGrids: vi.fn(),
      saveTuneGrids: vi.fn().mockResolvedValue({ message: 'saved' }),
    };
    TestBed.configureTestingModule({
      providers: [ApiBeatGridStore, { provide: DjLibraryApiService, useValue: api }],
    });
    store = TestBed.inject(ApiBeatGridStore);
  });

  it("loads a tune's grids, mapped from their DTO", async () => {
    api.getTuneGrids.mockResolvedValue({ grids: toDjTuneGridsDto(GRIDS) });

    expect(await store.load('h1')).toEqual(GRIDS);
    expect(api.getTuneGrids).toHaveBeenCalledWith({ sidHash: 'h1' });
  });

  it('loads null for a tune with no grids', async () => {
    api.getTuneGrids.mockResolvedValue({ grids: null });

    expect(await store.load('h1')).toBeNull();
  });

  it('saves the grids under their hash', async () => {
    await store.save(GRIDS);

    expect(api.saveTuneGrids).toHaveBeenCalledWith({
      sidHash: 'h1',
      djTuneGridsDto: toDjTuneGridsDto(GRIDS),
    });
  });

  it('lets a failed load and a failed save propagate', async () => {
    api.getTuneGrids.mockRejectedValue(new Error('500'));
    api.saveTuneGrids.mockRejectedValue(new Error('400'));

    await expect(store.load('h1')).rejects.toThrow('500');
    await expect(store.save(GRIDS)).rejects.toThrow('400');
  });
});
