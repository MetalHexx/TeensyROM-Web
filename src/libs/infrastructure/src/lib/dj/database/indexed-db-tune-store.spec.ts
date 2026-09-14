import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { TuneIndexRecord } from '@sidablist/analysis';
import { ALERT_SERVICE, IAlertService } from '@teensyrom-nx/domain';
import { DjDatabase, DJ_DATABASE_NAME } from './dj-database';
import { IndexedDbTuneStore } from './indexed-db-tune-store';

function buildIndexRecord(sidHash: string, subtune: number): TuneIndexRecord {
  return {
    sidHash,
    subtune,
    loopStartFrame: null,
    loopPeriodFrames: null,
    endedAtFrame: null,
    sectionBoundaries: [],
    detectedMoments: [],
    tonic: null,
    mode: null,
    camelot: null,
    tuningReferenceHz: null,
    tuningCents: null,
    keyConfidence: 'none',
    scalePitchClasses: [],
    dominantIntervalFrames: null,
    pulseConfidence: 'none',
    nativeTempo: null,
    callsPerFrame: 50,
    exactCallsPerFrame: 50,
    timingMode: 'exact',
    formatVersion: 5,
    computedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('IndexedDbTuneStore', () => {
  let mockAlertService: Partial<IAlertService>;
  let currentDb: IDBDatabase | null = null;

  beforeEach(() => {
    mockAlertService = { warning: vi.fn() };
    currentDb = null;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        DjDatabase,
        IndexedDbTuneStore,
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

  it('round-trips bytes by hash as an equal Uint8Array', async () => {
    const database = TestBed.inject(DjDatabase);
    const store = TestBed.inject(IndexedDbTuneStore);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);

    await store.putBytes('hash-1', bytes);
    currentDb = await database.open();

    const result = await store.getBytes('hash-1');
    expect(result).toEqual(bytes);
  });

  it('resolves null bytes for an unknown hash', async () => {
    const database = TestBed.inject(DjDatabase);
    const store = TestBed.inject(IndexedDbTuneStore);

    await expect(store.getBytes('unknown')).resolves.toBeNull();
    currentDb = await database.open();
  });

  it('round-trips an index by hash and subtune, landing a second subtune beside the first', async () => {
    const database = TestBed.inject(DjDatabase);
    const store = TestBed.inject(IndexedDbTuneStore);

    await store.putBytes('hash-1', new Uint8Array([9]));
    await store.putIndex(buildIndexRecord('hash-1', 0));
    await store.putIndex(buildIndexRecord('hash-1', 1));
    currentDb = await database.open();

    const first = await store.getIndex('hash-1', 0);
    const second = await store.getIndex('hash-1', 1);

    expect(first?.subtune).toBe(0);
    expect(second?.subtune).toBe(1);

    const bytes = await store.getBytes('hash-1');
    expect(bytes).toEqual(new Uint8Array([9]));
  });

  it('rejects putIndex when no row holds the bytes yet', async () => {
    const database = TestBed.inject(DjDatabase);
    const store = TestBed.inject(IndexedDbTuneStore);

    await expect(store.putIndex(buildIndexRecord('missing-hash', 0))).rejects.toThrow();
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

    it('still round-trips bytes and an index through the in-memory fallback', async () => {
      const store = TestBed.inject(IndexedDbTuneStore);
      const bytes = new Uint8Array([7, 8, 9]);

      await store.putBytes('hash-1', bytes);
      await store.putIndex(buildIndexRecord('hash-1', 0));

      await expect(store.getBytes('hash-1')).resolves.toEqual(bytes);
      const record = await store.getIndex('hash-1', 0);
      expect(record?.subtune).toBe(0);
    });

    it('does not share the fallback across a second store instance', async () => {
      const store = TestBed.inject(IndexedDbTuneStore);
      await store.putBytes('hash-1', new Uint8Array([1]));

      // A fresh root injector stands in for a second, independent app instance — the fallback
      // Map lives on the instance, so it must not survive into this new one.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          DjDatabase,
          IndexedDbTuneStore,
          { provide: ALERT_SERVICE, useValue: mockAlertService },
        ],
      });
      const otherStore = TestBed.inject(IndexedDbTuneStore);

      await expect(otherStore.getBytes('hash-1')).resolves.toBeNull();
    });
  });
});
