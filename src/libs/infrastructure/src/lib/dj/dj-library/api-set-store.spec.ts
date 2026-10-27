import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DjLibraryApiService } from '@teensyrom-nx/data-access/api-client';
import { ApiSetStore } from './api-set-store';
import { toDjSetDto } from './dj-library.mapper';
import type { TuneSet } from '@sidablist/tunes';

const SET: TuneSet = {
  id: 'set-1',
  name: 'Friday',
  placeholder: 'Set 1',
  created: '2026-01-01T00:00:00.000Z',
  updated: '2026-01-02T00:00:00.000Z',
  rows: [
    {
      id: 'row-1',
      tune: { sidHash: 'h1', title: 'T', author: 'A', released: '', subtuneCount: 1, byteLength: 10 },
      copiedFrom: null,
      lastSubtune: 1,
      subtunes: [],
    },
  ],
};

describe('ApiSetStore', () => {
  let store: ApiSetStore;
  let api: {
    listDjSets: ReturnType<typeof vi.fn>;
    getDjSet: ReturnType<typeof vi.fn>;
    saveDjSet: ReturnType<typeof vi.fn>;
    deleteDjSet: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      listDjSets: vi.fn(),
      getDjSet: vi.fn(),
      saveDjSet: vi.fn().mockResolvedValue({ message: 'saved' }),
      deleteDjSet: vi.fn().mockResolvedValue({ message: 'deleted' }),
    };
    TestBed.configureTestingModule({
      providers: [ApiSetStore, { provide: DjLibraryApiService, useValue: api }],
    });
    store = TestBed.inject(ApiSetStore);
  });

  it('lists the saved sets as summaries', async () => {
    api.listDjSets.mockResolvedValue({
      sets: [{ id: 's', name: 'n', rowCount: 2, updated: 'u' }],
    });

    expect(await store.list()).toEqual([{ id: 's', name: 'n', rowCount: 2, updated: 'u' }]);
  });

  it('loads a set, mapped from its DTO', async () => {
    api.getDjSet.mockResolvedValue({ set: toDjSetDto(SET) });

    expect(await store.load('set-1')).toEqual(SET);
    expect(api.getDjSet).toHaveBeenCalledWith({ setId: 'set-1' });
  });

  it('loads null for a set the server does not hold', async () => {
    api.getDjSet.mockResolvedValue({ set: null });

    expect(await store.load('missing')).toBeNull();
  });

  it('saves a set under its id', async () => {
    await store.save(SET);

    expect(api.saveDjSet).toHaveBeenCalledWith({ setId: 'set-1', djSetDto: toDjSetDto(SET) });
  });

  it('deletes a set by id', async () => {
    await store.delete('set-1');

    expect(api.deleteDjSet).toHaveBeenCalledWith({ setId: 'set-1' });
  });

  it.each([
    ['list', () => store.list(), 'listDjSets'],
    ['load', () => store.load('s'), 'getDjSet'],
    ['save', () => store.save(SET), 'saveDjSet'],
    ['delete', () => store.delete('s'), 'deleteDjSet'],
  ])('lets a failed %s propagate', async (_name, call, method) => {
    api[method as keyof typeof api].mockRejectedValue(new Error('500'));

    await expect(call()).rejects.toThrow('500');
  });
});
