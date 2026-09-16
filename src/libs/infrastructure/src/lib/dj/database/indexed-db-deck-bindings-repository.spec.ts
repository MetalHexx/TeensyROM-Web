import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { DeckBinding } from '@teensyrom-nx/application';
import { ALERT_SERVICE, IAlertService } from '@teensyrom-nx/domain';
import { DjDatabase, DJ_DATABASE_NAME, DECK_BINDINGS_STORE } from './dj-database';
import { IndexedDbDeckBindingsRepository } from './indexed-db-deck-bindings-repository';

function buildBinding(slot: 'A' | 'B'): DeckBinding {
  return { slot, midiPortId: `midi-${slot}`, midiPortName: `MIDI ${slot}` };
}

describe('IndexedDbDeckBindingsRepository', () => {
  let mockAlertService: Partial<IAlertService>;
  let currentDb: IDBDatabase | null = null;

  beforeEach(() => {
    mockAlertService = { warning: vi.fn() };
    currentDb = null;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        DjDatabase,
        IndexedDbDeckBindingsRepository,
        { provide: ALERT_SERVICE, useValue: mockAlertService },
      ],
    });
  });

  afterEach(async () => {
    currentDb?.close();
    currentDb = null;
    vi.restoreAllMocks();

    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(DJ_DATABASE_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });

  it('round-trips a binding by slot and loadAll returns both', async () => {
    const database = TestBed.inject(DjDatabase);
    const repository = TestBed.inject(IndexedDbDeckBindingsRepository);

    await repository.save(buildBinding('A'));
    await repository.save(buildBinding('B'));
    currentDb = await database.open();

    const loadedA = await repository.load('A');
    expect(loadedA).toEqual(buildBinding('A'));

    const all = await repository.loadAll();
    expect(all.map((binding) => binding.slot).sort()).toEqual(['A', 'B']);
  });

  it('load and loadAll narrow a stale record that still carries extra device fields', async () => {
    const database = TestBed.inject(DjDatabase);
    const repository = TestBed.inject(IndexedDbDeckBindingsRepository);
    currentDb = await database.open();

    await database.put(DECK_BINDINGS_STORE, {
      slot: 'A',
      midiPortId: 'midi-A',
      midiPortName: 'MIDI A',
      deviceId: 'device-A',
      deviceName: 'Device A',
    });

    expect(await repository.load('A')).toEqual(buildBinding('A'));
    expect(await repository.loadAll()).toEqual([buildBinding('A')]);
  });

  it('resolves null when a slot has no saved binding', async () => {
    const database = TestBed.inject(DjDatabase);
    const repository = TestBed.inject(IndexedDbDeckBindingsRepository);

    await expect(repository.load('A')).resolves.toBeNull();
    currentDb = await database.open();
  });

  describe('when the database is degraded', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        const request = {} as IDBOpenDBRequest;
        queueMicrotask(() => {
          Object.defineProperty(request, 'error', {
            value: new Error('boom'),
            configurable: true,
          });
          request.onerror?.(new Event('error'));
        });
        return request;
      });
    });

    it('answers empty and no-ops instead of throwing', async () => {
      const repository = TestBed.inject(IndexedDbDeckBindingsRepository);

      await expect(repository.load('A')).resolves.toBeNull();
      await expect(repository.loadAll()).resolves.toEqual([]);
      await expect(repository.save(buildBinding('A'))).resolves.toBeUndefined();
    });
  });
});
